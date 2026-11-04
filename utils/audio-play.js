// EXPERIMENT (test mode only): play an audio file on the watch (@zos/media
// PLAYER: MP3, and OPUS recorded by the watch). Used for a file the phone
// downloaded and sent (a test-suite button with `request.audio_play`, through
// the image queue: utils/button-request.js, app-side "kind: audio") and for
// the last recording of the audio test (utils/audio-test.js).
//
// Full screen while playing: the time, a tap anywhere stops. Logged (trace):
// the file's size and first bytes (MP3 frame / ID3 / Ogg), the player's
// events and times, the duration, the volume, memory.
//
// The player is commanded outside its own events (field-notes.md, "App
// service"): a stop/setSource/prepare inside an event killed zeppamp's
// service; start() inside PREPARE is fine.
import { createWidget, deleteWidget, widget, prop, align, text_style, event } from '@zos/ui'
import { create, id } from '@zos/media'
import { statSync, openSync, readSync, closeSync, rmSync, O_RDONLY } from '@zos/fs'
import { getDeviceInfo } from '@zos/device'
import { hexHead } from './base64.js'
import { COLOR_BLACK, COLOR_WHITE, COLOR_GRAY, COLOR_GREEN, CUSTOM_TOAST } from './constants.js'
import { devLog, infoLog, warnLog } from './remote-log.js'
import { memoryUsage, errorText, sizeText } from './memory.js'

// No PREPARE event this long after prepare(): given up
const PREPARE_WAIT_MS = 10000
// After a stop, before the next file is set (see playAudioFile)
const SWITCH_WAIT_MS = 400

let player = null
let current = null

// `path`: the file (data://… or a path under /data). `remove`: delete it
// after (a received file; not the recording, which can be played again)
export function playAudioFile(vm, path, { tag = '[play]', pageid = 0, remove = false, label = '' } = {}) {
  const src = String(path || '')
  const dataPath = src.startsWith('data://') ? src.slice('data://'.length) : src.replace(/^\/?data\//, '')
  let switching = false
  if (current) {
    // The new file came to the same name: removing the old one would remove
    // it (seen on the watch: "Not audio" found 0 B after a 20 s file)
    if (current.dataPath === dataPath) current.remove = false
    switching = true
    finish(current, 'another file to play')
  }
  const file = 'data://' + dataPath
  const run = current = { vm, tag, pageid, remove, dataPath, t0: Date.now(), tPlay: 0, duration: 0, widgets: [], timers: [], done: false, prepared: false }

  let size = 0
  try {
    const st = statSync({ path: dataPath })
    size = (st && st.size) || 0
    // Only the first bytes: the whole file would sit in the JS memory
    const head = size ? readHead(dataPath, 16) : new Uint8Array(0)
    devLog(`${tag}: playing ${file}, ${sizeText(size)}, ${kindOf(head)} (${hexHead(head, 12)}); ${memoryUsage()}`)
  } catch (e) {
    warnLog(`${tag}: file not read before playing: ${errorText(e)}`)
  }
  if (!size) {
    warnLog(`${tag}: nothing to play at ${file}`)
    return fail(run, 'No audio file to play')
  }

  drawOverlay(run, label)
  const load = () => {
    if (run.done) return
    const p = getPlayer(run)
    if (!p) return fail(run, 'No player available')
    try {
      const before = statusText(p)
      p.setSource(p.source.FILE, { file })
      let info = {}
      try { info = p.getMediaInfo() || {} } catch (e) { /* not there */ }
      devLog(`${tag}: source set, status ${before} → ${statusText(p)}${info.title ? `, title of ${String(info.title).length} chars` : ''}`)
      p.prepare()
    } catch (e) {
      warnLog(`${tag}: setSource/prepare failed: ${errorText(e)}`)
      return fail(run, 'Player failed: ' + errorText(e))
    }
    run.timers.push(setTimeout(() => {
      if (run.prepared || run.done) return
      warnLog(`${tag}: no PREPARE event in ${PREPARE_WAIT_MS}ms (status ${statusText(p)})`)
      fail(run, 'The player did not load the file')
    }, PREPARE_WAIT_MS))
  }
  // Right after stopping a file, the next one was refused (status 7 after
  // setSource, then PREPARE false): give the player a moment
  if (switching) run.timers.push(setTimeout(load, SWITCH_WAIT_MS))
  else load()
}

// A file is playing (or loading)
export const isAudioPlaying = () => !!current

// The recorder was made (utils/audio-test.js), for the log when no player
// can be made after it
let recorderMade = false
export const noteRecorderMade = () => { recorderMade = true }

// Playback stops: the page goes away, or the recorder needs the audio (a
// recording started during playback left the player refusing the next file)
export function stopAudioPlay(why = 'page closed') {
  if (current) finish(current, why)
}

// One player for the app, its events handed to the file playing
function getPlayer(run) {
  if (player) return player
  try {
    player = create(id.PLAYER)
  } catch (e) {
    warnLog(`${run.tag}: player not created: ${errorText(e)}`)
    player = null
    return null
  }
  // create() gave nothing (no throw): on an API 3 watch every time once the
  // recorder had been made, and once on the Cheetah. The recorder can't be
  // let go (no API for it)
  if (!player) {
    warnLog(`${run.tag}: create(id.PLAYER) gave nothing${recorderMade ? ' (the recorder was made before it, in this run of the app)' : ' (no recorder made yet)'}`)
    return null
  }
  devLog(`${run.tag}: player created`)
  const p = player
  p.addEventListener(p.event.PREPARE, (result) => {
    const r = current
    if (!r || r.done) return
    r.prepared = true
    const ms = Date.now() - r.t0
    if (!result) {
      warnLog(`${r.tag}: the player refused the file (PREPARE ${result}) after ${ms}ms: format or bitrate not supported?`)
      setTimeout(() => fail(r, 'Audio format not supported'), 0)
      return
    }
    try { r.duration = p.getDuration() || 0 } catch (e) { r.duration = 0 }
    let volume = '?'
    try { volume = p.getVolume() } catch (e) { /* not there */ }
    devLog(`${r.tag}: PREPARE ok in ${ms}ms, duration ${r.duration}s, volume ${volume}`)
    // start() inside PREPARE is fine (field-notes.md)
    try { p.start() } catch (e) { warnLog(`${r.tag}: start() failed: ${errorText(e)}`) }
  })
  p.addEventListener(p.event.PLAY, (result) => {
    const r = current
    if (!r || r.done) return
    r.tPlay = Date.now()
    infoLog(`${r.tag}: playing (PLAY ${result}) ${r.tPlay - r.t0}ms after the file was ready, ${r.duration}s long`)
    if (result === false) setTimeout(() => fail(r, 'Playback did not start'), 0)
  })
  p.addEventListener(p.event.COMPLETE, () => {
    const r = current
    if (!r || r.done) return
    const played = r.tPlay ? Date.now() - r.tPlay : 0
    devLog(`${r.tag}: COMPLETE after ${played}ms of playback (duration ${r.duration}s)`)
    setTimeout(() => finish(r, 'complete'), 0)
  })
  p.addEventListener(p.event.STOP, () => {
    const r = current
    if (r && !r.done) devLog(`${r.tag}: STOP event`)
  })
  return p
}

function readHead(path, n) {
  const fd = openSync({ path, flag: O_RDONLY })
  try {
    const buf = new ArrayBuffer(n)
    const got = readSync({ fd, buffer: buf })
    return new Uint8Array(buf, 0, Math.max(0, Math.min(n, got || 0)))
  } finally {
    closeSync(fd)
  }
}

function kindOf(h) {
  if (h.length >= 4 && h[0] === 0x4f && h[1] === 0x67 && h[2] === 0x67 && h[3] === 0x53) return 'Ogg'
  if (h.length >= 3 && h[0] === 0x49 && h[1] === 0x44 && h[2] === 0x33) return 'MP3 with ID3 tag'
  if (h.length >= 2 && h[0] === 0xff && (h[1] & 0xe0) === 0xe0) {
    const ver = (h[1] >> 3) & 3
    return `MP3 frame (MPEG ${ver === 3 ? '1' : ver === 2 ? '2' : ver === 0 ? '2.5' : '?'})`
  }
  return 'unknown format'
}

function statusText(p) {
  try {
    const s = p.getStatus()
    const st = p.state || {}
    const name = Object.keys(st).find((k) => st[k] === s)
    return name ? `${name} (${s})` : String(s)
  } catch (e) {
    return `? (${errorText(e)})`
  }
}

function fail(run, text) {
  const { vm, pageid } = run
  finish(run, 'failed')
  vm.showResult(text, pageid, true, CUSTOM_TOAST)
}

function finish(run, why) {
  if (run.done) return
  run.done = true
  if (current === run) current = null
  run.timers.forEach((t) => { clearTimeout(t); clearInterval(t) })
  run.timers = []
  if (player && why !== 'complete' && why !== 'failed') {
    try { player.stop() } catch (e) { warnLog(`${run.tag}: stop() failed: ${errorText(e)}`) }
  } else if (player && why === 'complete') {
    try { player.stop() } catch (e) { /* already stopped */ }
  }
  run.widgets.forEach((w) => { try { deleteWidget(w) } catch (e) { /* gone */ } })
  run.widgets = []
  run.timeText = null
  if (run.remove) {
    try { rmSync({ path: run.dataPath }) } catch (e) { /* not there */ }
  }
  devLog(`${run.tag}: playback over (${why}) ${Date.now() - run.t0}ms after the file was ready${run.remove ? ', file removed' : ''}; ${memoryUsage()}`)
}

function drawOverlay(run, label) {
  const { width: W, height: H } = getDeviceInfo()
  const add = (type, o) => { const w = createWidget(type, o); run.widgets.push(w); return w }
  add(widget.FILL_RECT, { x: 0, y: 0, w: W, h: H, color: COLOR_BLACK })
  add(widget.TEXT, {
    x: 0, y: Math.round(H * 0.24), w: W, h: Math.round(H * 0.12),
    text: '♪ ' + (label || 'Playing'), text_size: Math.round(H * 0.07), color: COLOR_GREEN,
    align_h: align.CENTER_H, align_v: align.CENTER_V, text_style: text_style.ELLIPSIS,
  })
  run.timeText = add(widget.TEXT, {
    x: 0, y: Math.round(H * 0.42), w: W, h: Math.round(H * 0.14),
    text: 'Loading…', text_size: Math.round(H * 0.075), color: COLOR_WHITE,
    align_h: align.CENTER_H, align_v: align.CENTER_V, text_style: text_style.NONE,
  })
  add(widget.TEXT, {
    x: 0, y: Math.round(H * 0.6), w: W, h: Math.round(H * 0.1),
    text: 'Tap to stop', text_size: Math.round(H * 0.05), color: COLOR_GRAY,
    align_h: align.CENTER_H, align_v: align.CENTER_V, text_style: text_style.NONE,
  })
  run.widgets.forEach((w) => w.addEventListener(event.CLICK_DOWN, () => setTimeout(() => finish(run, 'tap'), 0)))
  run.timers.push(setInterval(() => {
    if (!run.timeText || !run.tPlay) return
    const s = (Date.now() - run.tPlay) / 1000
    run.timeText.setProperty(prop.TEXT, run.duration ? `${s.toFixed(1)} / ${Number(run.duration).toFixed(1)} s` : `${s.toFixed(1)} s`)
  }, 250))
}
