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
// service; start() inside PREPARE is fine. One file loads at a time (zeppamp:
// two loads overlapping gave silence): a file asked while one loads waits for
// its PLAY, at most 3 s, the latest wins. After each stop, release() (not in
// the API docs; a page-level player library calls it after every stop and
// after a refused file, and its "sound wasn't playing after the first play"
// fix): called only where the object has it, and logged.
import { createWidget, deleteWidget, widget, prop, align, text_style, event } from '@zos/ui'
import { create, id } from '@zos/media'
import { statSync, openSync, readSync, closeSync, rmSync, O_RDONLY } from '@zos/fs'
import { getDeviceInfo } from '@zos/device'
import { hexHead } from './base64.js'
import { COLOR_BLACK, COLOR_WHITE, COLOR_GRAY, COLOR_GREEN, CUSTOM_TOAST } from './constants.js'
import { devLog, infoLog, warnLog } from './remote-log.js'
import { memoryUsage, errorText, sizeText } from './memory.js'

// The progress bar's track
const COLOR_BAR_BACK = 0x333333

// No PREPARE event this long after prepare(): given up
const PREPARE_WAIT_MS = 10000
// After a stop, before the next file is set (see playAudioFile)
const SWITCH_WAIT_MS = 400

// A file asked while another loads waits this long at most for its PLAY
const LOAD_WAIT_MS = 3000
// A file asked during a recording waits for its end, this long at most
const RECORDING_WAIT_MS = 60000

let player = null
let current = null
let pending = null
let pendingTimer = null

// The functions a media object really has, for the log: the API docs list
// some, the objects may have more (release)
export function mediaMethods(o) {
  const names = new Set()
  try {
    for (let p = o; p && p !== Object.prototype; p = Object.getPrototypeOf(p)) {
      Object.getOwnPropertyNames(p).forEach((n) => { try { if (n !== 'constructor' && typeof o[n] === 'function') names.add(n) } catch (e) { /* getter */ } })
    }
  } catch (e) { return `? (${errorText(e)})` }
  return [...names].sort().join(',') || 'none'
}

// release() where the object has it
export function releaseMedia(o, tag, what) {
  if (!o || typeof o.release !== 'function') return false
  try {
    o.release()
    devLog(`${tag}: ${what}.release() called`)
    return true
  } catch (e) {
    warnLog(`${tag}: ${what}.release() failed: ${errorText(e)}`)
    return false
  }
}

function runPending() {
  if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null }
  const p = pending
  pending = null
  if (p) playAudioFile(...p)
}

// `path`: the file (data://… or a path under /data). `remove`: delete it
// after (a received file; not the recording, which can be played again)
export function playAudioFile(vm, path, opts = {}) {
  // onEnd(why): playback is over ('complete', 'tap', 'failed', 'page closed',
  // 'another file to play', …), called just after (page/run goes back)
  // duration (seconds): when the caller knows it (the watch's recording, for
  // which getDuration() gives 0), for the progress bar
  const { tag = '[play]', pageid = 0, remove = false, label = '', onEnd = null, duration = 0 } = opts
  const src = String(path || '')
  const dataPath = src.startsWith('data://') ? src.slice('data://'.length) : src.replace(/^\/?data\//, '')
  // A recording running: the file waits for its end (on the Cheetah the
  // player refused two files, PREPARE false, while the recorder ran)
  if (isRecording && isRecording()) {
    if (!pending) devLog(`${tag}: waits for the recording to end`)
    else devLog(`${tag}: waits for the recording to end (in place of the file waiting)`)
    if (pendingTimer) clearTimeout(pendingTimer)
    pendingTimer = setTimeout(runPending, RECORDING_WAIT_MS)
    pending = [vm, path, opts]
    return
  }
  // One load at a time: this file waits for the one loading to play
  if (current && !current.done && current.loading && !current.tPlay) {
    if (!pending) {
      devLog(`${tag}: waits for the file loading (${LOAD_WAIT_MS} ms at most)`)
      pendingTimer = setTimeout(runPending, LOAD_WAIT_MS)
    }
    pending = [vm, path, opts]
    return
  }
  let switching = false
  if (current) {
    // The new file came to the same name: removing the old one would remove
    // it (seen on the watch: "Not audio" found 0 B after a 20 s file)
    if (current.dataPath === dataPath) current.remove = false
    switching = true
    finish(current, 'another file to play')
  }
  const file = 'data://' + dataPath
  const run = current = { vm, tag, pageid, remove, dataPath, onEnd, durationHint: Number(duration) || 0, t0: Date.now(), tPlay: 0, duration: 0, widgets: [], timers: [], done: false, prepared: false }

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
      run.loading = true
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

// The recorder was made (utils/audio-test.js): for the log when no player can
// be made after it, and to let it go then (`release`: releases the recorder,
// true if it could)
let recorderMade = false
let releaseRecorder = null
export const noteRecorderMade = (release) => { recorderMade = true; releaseRecorder = release || null }

// Whether a recording runs (utils/audio-test.js sets it), and its end: a
// file that waited for it plays then, a moment later
let isRecording = null
export const setRecordingCheck = (fn) => { isRecording = fn }
export function recordingOver() {
  if (!pending) return
  if (pendingTimer) clearTimeout(pendingTimer)
  pendingTimer = setTimeout(runPending, SWITCH_WAIT_MS)
}

// checkAvailable() (not in the API docs; the recorder and the player both
// have it on the Cheetah): what it says, for the log
export function availableText(o) {
  if (!o || typeof o.checkAvailable !== 'function') return 'no checkAvailable'
  try {
    const r = o.checkAvailable()
    let s
    try { s = JSON.stringify(r) } catch (e) { s = String(r) }
    return `checkAvailable() → ${typeof r} ${String(s).slice(0, 80)}`
  } catch (e) {
    return `checkAvailable() threw: ${errorText(e)}`
  }
}

// The recorder could not be made: the player lets go of the audio (on the
// Balance only one of the two could exist). True if it was released
export function releasePlayerForRecorder(tag) {
  if (!player) return false
  dropPending()
  if (current) finish(current, 'the recorder needs the audio')
  try { player.stop() } catch (e) { /* not playing */ }
  const done = releaseMedia(player, tag, 'player')
  player = null
  appMedia().player = null
  return done
}

// Playback stops: the page goes away, or the recorder needs the audio (a
// recording started during playback left the player refusing the next file)
// A key stopped it (page/run: SELECT, as a tap): true if a file was playing
export function stopPlaybackNow() {
  const r = current
  if (!r || r.done) return false
  setTimeout(() => finish(r, 'tap'), 0)
  return true
}

export function stopAudioPlay(why = 'page closed') {
  dropPending()
  if (current) finish(current, why)
}

function dropPending() {
  if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null }
  pending = null
}

// The media objects kept by the app (globalData), for every page: each page
// starts its modules afresh, and a recorder made on an earlier page, gone,
// still held the audio (Cheetah: no player could be made on the next page,
// "no recorder made yet" there). The same objects are used again instead,
// as on one page, where the recorder and the player lived together
export function appMedia() {
  try {
    const a = getApp()
    if (!a.globalData) a.globalData = {}
    return a.globalData.media || (a.globalData.media = {})
  } catch (e) {
    return {}
  }
}

// One player for the app, its events handed to the file playing
function getPlayer(run) {
  if (player) return player
  const kept = appMedia().player
  if (kept) {
    // An object gone with its page throws ("hmMedia object expected", as the
    // recorder did): then a new one
    try {
      listenPlayer(kept)
      player = kept
      devLog(`${run.tag}: player from an earlier page used again; ${availableText(player)}`)
      return player
    } catch (e) {
      warnLog(`${run.tag}: the player kept from an earlier page is gone (${errorText(e)}): a new one`)
      appMedia().player = null
    }
  }
  try {
    player = create(id.PLAYER)
  } catch (e) {
    warnLog(`${run.tag}: player not created: ${errorText(e)}`)
    player = null
    return null
  }
  // create() gave nothing (no throw): on the Balance every time once the
  // recorder had been made, and once on the Cheetah. The recorder lets go of
  // the audio (release(), where it has it), and the player is asked again
  if (!player) {
    warnLog(`${run.tag}: create(id.PLAYER) gave nothing${recorderMade ? ' (the recorder was made before it, in this run of the app)' : ' (no recorder made yet)'}`)
    if (releaseRecorder && releaseRecorder(run.tag)) {
      try { player = create(id.PLAYER) } catch (e) { player = null }
      if (player) devLog(`${run.tag}: player made after the recorder's release()`)
      else warnLog(`${run.tag}: still no player after the recorder's release()`)
    }
    if (!player) return null
  }
  devLog(`${run.tag}: player created; its functions: ${mediaMethods(player)}; ${availableText(player)}`)
  appMedia().player = player
  return listenPlayer(player)
}

// The player made now, on the recorder's page, for the pages after: there a
// new one could not be made while that recorder lived (Cheetah), but on one
// page the two lived together. Made after the recorder, never before (on
// the Balance one object kept the other from being made: the recording
// comes first)
export function makePlayerAhead(tag) {
  if (player || appMedia().player) return
  let p = null
  try { p = create(id.PLAYER) } catch (e) { p = null }
  if (!p) {
    devLog(`${tag}: no player could be made next to the recorder`)
    return
  }
  player = p
  appMedia().player = p
  listenPlayer(p)
  devLog(`${tag}: player made next to the recorder, for the pages after`)
}

// This page's listeners on the player (one per event: a page-level player
// library sets new ones to clear the old)
function listenPlayer(p) {
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
    // 0 for the watch's own recording: the length the caller worked out
    if (!r.duration && r.durationHint) r.duration = r.durationHint
    let volume = '?', mute = '?'
    try { volume = p.getVolume() } catch (e) { /* not there */ }
    try { mute = typeof p.getMute === 'function' ? p.getMute() : 'n/a' } catch (e) { mute = errorText(e) }
    devLog(`${r.tag}: PREPARE ok in ${ms}ms, duration ${r.duration}s, volume ${volume}, mute ${mute}, ${availableText(p)}`)
    // start() inside PREPARE is fine (field-notes.md)
    try { p.start() } catch (e) { warnLog(`${r.tag}: start() failed: ${errorText(e)}`) }
  })
  p.addEventListener(p.event.PLAY, (result) => {
    const r = current
    if (!r || r.done) return
    r.tPlay = Date.now()
    infoLog(`${r.tag}: playing (PLAY ${result}) ${r.tPlay - r.t0}ms after the file was ready, ${r.duration}s long`)
    if (result === false) setTimeout(() => fail(r, 'Playback did not start'), 0)
    // A file asked while this one loaded: now, out of this event
    else if (pending) setTimeout(runPending, 0)
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
  // stop(), then release() (where the player has it), after whatever was
  // loaded: played to the end, refused, stopped
  if (player && run.loading) {
    try { player.stop() } catch (e) { if (why !== 'complete' && why !== 'failed') warnLog(`${run.tag}: stop() failed: ${errorText(e)}`) }
    releaseMedia(player, run.tag, 'player')
  }
  run.widgets.forEach((w) => { try { deleteWidget(w) } catch (e) { /* gone */ } })
  run.widgets = []
  run.timeText = run.barFill = null
  if (run.remove) {
    try { rmSync({ path: run.dataPath }) } catch (e) { /* not there */ }
  }
  devLog(`${run.tag}: playback over (${why}) ${Date.now() - run.t0}ms after the file was ready${run.remove ? ', file removed' : ''}; ${memoryUsage()}`)
  // A file waiting for this one (refused or stopped before playing)
  if (pending && why !== 'another file to play') setTimeout(runPending, 0)
  if (typeof run.onEnd === 'function') { const cb = run.onEnd; setTimeout(() => cb(why), 0) }
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
    x: 0, y: Math.round(H * 0.38), w: W, h: Math.round(H * 0.14),
    text: 'Loading…', text_size: Math.round(H * 0.075), color: COLOR_WHITE,
    align_h: align.CENTER_H, align_v: align.CENTER_V, text_style: text_style.NONE,
  })
  // The progress: a bar when the duration is known (an MP3), the time alone
  // otherwise (the watch's own recording: getDuration() 0)
  const bar = { x: Math.round(W * 0.2), y: Math.round(H * 0.555), w: Math.round(W * 0.6), h: Math.max(6, Math.round(H * 0.016)) }
  add(widget.FILL_RECT, { ...bar, radius: Math.floor(bar.h / 2), color: COLOR_BAR_BACK })
  run.barFill = add(widget.FILL_RECT, { ...bar, w: bar.h, radius: Math.floor(bar.h / 2), color: COLOR_GREEN })
  add(widget.TEXT, {
    x: 0, y: Math.round(H * 0.62), w: W, h: Math.round(H * 0.1),
    text: 'Tap to stop', text_size: Math.round(H * 0.05), color: COLOR_GRAY,
    align_h: align.CENTER_H, align_v: align.CENTER_V, text_style: text_style.NONE,
  })
  run.widgets.forEach((w) => w.addEventListener(event.CLICK_DOWN, () => setTimeout(() => finish(run, 'tap'), 0)))
  run.timers.push(setInterval(() => {
    if (!run.timeText || !run.tPlay) return
    // The clock: getCurrentTime() (not in the API docs) is logged once to
    // learn its unit, the screen doesn't depend on it
    const s = (Date.now() - run.tPlay) / 1000
    if (!run.loggedTime && s >= 1) {
      run.loggedTime = true
      let t = '?'
      try { t = typeof player.getCurrentTime === 'function' ? player.getCurrentTime() : 'no getCurrentTime' } catch (e) { t = errorText(e) }
      devLog(`${run.tag}: getCurrentTime() at ${s.toFixed(2)} s of playback: ${t}`)
    }
    const d = Number(run.duration) || 0
    run.timeText.setProperty(prop.TEXT, d ? `${Math.min(s, d).toFixed(1)} / ${d.toFixed(1)} s` : `${s.toFixed(1)} s`)
    if (d && run.barFill) {
      const w = Math.max(bar.h, Math.round(bar.w * Math.min(1, s / d)))
      run.barFill.setProperty(prop.MORE, { x: bar.x, y: bar.y, w, h: bar.h })
    }
  }, 250))
}
