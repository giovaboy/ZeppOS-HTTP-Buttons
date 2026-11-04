// EXPERIMENT (test mode only): record audio on the watch and POST it from the
// phone, to learn what can be done. A test-suite button with `audio_test`
// records (@zos/media RECORDER, OPUS only), moves the bytes to the phone as
// base64 parts over ZML messaging (the side service can't read a file it
// receives, nor upload one), and the phone tries the standard ways a service
// takes audio against an echo server (app-side/audio-test.js): raw binary
// body, multipart/form-data, base64 in JSON. The verdict per way is shown on
// the watch and logged.
//
// It goes to production only if all three ways work. Not in the settings page
// nor in the config schema until then.
//
// Logged (trace): recorder events and times, the file's size, bytes/s, its
// first bytes (is it an Ogg file?), each part's transfer time, memory. Never
// the audio itself.
import { createWidget, deleteWidget, widget, prop, align, text_style, event } from '@zos/ui'
import { create, id, codec } from '@zos/media'
import { statSync, readFileSync, rmSync } from '@zos/fs'
import { getDeviceInfo } from '@zos/device'
import { bytesToBase64, hexHead } from './base64.js'
import { playAudioFile, isAudioPlaying, stopAudioPlay, noteRecorderMade, releasePlayerForRecorder, releaseMedia, mediaMethods, availableText, setRecordingCheck, recordingOver } from './audio-play.js'
import { parseOpusFrames } from './opus-frames.js'
import { COLOR_BLACK, COLOR_WHITE, COLOR_BRIGHT_RED, COLOR_GRAY, SYSTEM_MODAL } from './constants.js'
import { devLog, infoLog, warnLog } from './remote-log.js'
import { memoryUsage, errorText, sizeText } from './memory.js'

const AUDIO_FILE = 'audio_test.opus'
const DEFAULT_SECONDS = 5
const MAX_SECONDS = 30
// Bytes per message to the phone (a multiple of 3: the parts' base64 joins
// into one text). ~12 KB of base64 each: 6 KB parts took 0.7–3 s each, the
// time going to the messages more than their size
const PART_BYTES = 9000
// No STOP event this long after stop(): the file is read anyway
const STOP_WAIT_MS = 3000
const NO_EVENTS_WAIT_MS = 800
// The phone's tests (several POSTs of the recording): the RPC window
const TESTS_RPC_MS = 120000

// The test running on this page (one at a time: the button's press queue
// holds the others), so the page's onDestroy can stop it
let current = null

// The recorder holds the microphone from the start until its file is read:
// meanwhile a file to play waits (utils/audio-play.js)
setRecordingCheck(() => !!current && !current.finished && !current.read)

export function runAudioTest(vm, button, pageid, label, done) {
  if (current) {
    warnLog(`[audio] ${label}: another recording is running`)
    vm.showResult('A recording is already running', pageid, true, SYSTEM_MODAL)
    return done()
  }
  const opts = button.audio_test || {}
  const seconds = Math.min(MAX_SECONDS, Math.max(1, Number(opts.seconds) || DEFAULT_SECONDS))
  const tag = `[audio] ${label}`
  const run = current = { vm, tag, button, pageid, t0: Date.now(), tStart: 0, tStop: 0, stopped: false, finished: false, widgets: [], timers: [], recorder: null }
  devLog(`${tag}: test asked, ${seconds}s max; ${memoryUsage()}`)

  const finish = (text, isError) => {
    if (run.finished) return
    run.finished = true
    cleanup(run)
    if (current === run) current = null
    recordingOver()
    if (text) vm.showResult(text, pageid, isError, SYSTEM_MODAL)
    done()
  }
  run.finish = finish

  // The last recording's file would be read if this one writes nothing
  try { if (statSync({ path: AUDIO_FILE })) rmSync({ path: AUDIO_FILE }) } catch (e) { /* not there */ }

  drawOverlay(run, seconds, () => stopRecording(run, 'tap'))

  let recorder
  try {
    recorder = run.recorder = getRecorder(tag)
  } catch (e) {
    warnLog(`${tag}: recorder not created: ${errorText(e)}`)
    // e.g. PERMISSION_DENIED device:os.mic without the app.json permission
    return finish('Recorder not available:\n' + errorText(e), true)
  }
  const start = () => {
    if (run.finished) return
    try {
      recorder.setFormat(codec.OPUS, { target_file: 'data://' + AUDIO_FILE })
      recorder.start()
      devLog(`${tag}: start() called, status ${statusText(recorder)}`)
    } catch (e) {
      warnLog(`${tag}: recording failed to start: ${errorText(e)}`)
      return finish('Recording failed to start:\n' + errorText(e), true)
    }
    // The stop at the limit, from the start (the START event resets it). A
    // 10 s test stopped at 14.4 s on the 200 ms ticks below while a file
    // was coming in: its own timer
    run.limitTimer = setTimeout(() => stopRecording(run, 'limit'), seconds * 1000)
    run.timers.push(run.limitTimer)
  }
  // Playing while the recorder starts: the player then refused the next
  // file (status 7). Playback stops first, the recorder starts a moment later
  if (isAudioPlaying()) {
    devLog(`${tag}: playback stopped for the recording`)
    stopAudioPlay('a recording starts')
    run.timers.push(setTimeout(start, 400))
  } else {
    start()
  }
  run.seconds = seconds

  // The time on screen
  run.timers.push(setInterval(() => {
    if (run.stopped) return
    const from = run.tStart || run.t0
    const s = Math.min(seconds, (Date.now() - from) / 1000)
    if (run.timeText) run.timeText.setProperty(prop.TEXT, `${s.toFixed(1)} s / ${seconds} s`)
  }, 200))
}

// The last recording, played on the watch: the player with the watch's own
// OPUS, no phone involved (utils/audio-play.js)
export function playLastRecording(vm, pageid, label, done) {
  if (current) {
    vm.showResult('A recording is running', pageid, true, SYSTEM_MODAL)
    return done()
  }
  let st = null
  try { st = statSync({ path: AUDIO_FILE }) } catch (e) { st = null }
  if (!st || !st.size) {
    vm.showResult('No recording yet: record one with 🎤 first', pageid, true, SYSTEM_MODAL)
    return done()
  }
  playAudioFile(vm, 'data://' + AUDIO_FILE, { tag: `[play] ${label}`, pageid, remove: false, label: 'Last recording' })
  done()
}

// The page goes away: the recording stops, nothing is sent. The recorder is
// kept for the next page, as the player is: the player made on one page
// played on the next one
export function stopAudioTest() {
  const run = current
  if (!run) return
  devLog(`${run.tag}: page closed during the test`)
  run.finished = true
  cleanup(run)
  current = null
}

// One recorder: on the watch a second create(id.RECORDER) on the same page
// gave nothing ("cannot read property 'addEventListener' of undefined").
// Its events go to the test running
let recorder = null
function getRecorder(tag) {
  if (recorder) return recorder
  let r = create(id.RECORDER)
  // Nothing: the player may hold the audio (on the Balance only one of the two
  // could exist). It lets go (release(), where it has it), and again
  if (!r && releasePlayerForRecorder(tag)) {
    r = create(id.RECORDER)
    devLog(`${tag}: ${r ? 'recorder made after the player\'s release()' : 'still no recorder after the player\'s release()'}`)
  }
  if (!r) throw new Error('create(id.RECORDER) gave nothing')
  // The player, if it can't be made later, has the recorder let go: then a
  // new recorder is made for the next test
  noteRecorderMade((t) => {
    if (!recorder || current) return false
    const done = releaseMedia(recorder, t, 'recorder')
    recorder = null
    return done
  })
  devLog(`${tag}: recorder's functions: ${mediaMethods(r)}; ${availableText(r)}`)
  r.addEventListener(r.event.START, (result) => {
    const run = current
    if (!run || run.finished) return
    run.tStart = Date.now()
    devLog(`${run.tag}: START event (result ${result}) ${run.tStart - run.t0}ms after the press, status ${statusText(r)}`)
    if (result === false) {
      warnLog(`${run.tag}: the recorder did not start (permission? microphone busy?)`)
      return run.finish('The recorder did not start', true)
    }
    // The limit counts from here
    if (run.limitTimer && !run.stopped) {
      clearTimeout(run.limitTimer)
      run.limitTimer = setTimeout(() => stopRecording(run, 'limit'), (run.seconds || DEFAULT_SECONDS) * 1000)
      run.timers.push(run.limitTimer)
    }
  })
  r.addEventListener(r.event.STOP, (result) => {
    const run = current
    if (!run || run.finished) return
    devLog(`${run.tag}: STOP event (result ${result}) ${run.tStop ? Date.now() - run.tStop : '?'}ms after stop(), file ${fileSize()} B`)
    afterStop(run, 'STOP event')
  })
  recorder = r
  devLog(`${tag}: recorder created`)
  return r
}

function fileSize() {
  try { const st = statSync({ path: AUDIO_FILE }); return (st && st.size) || 0 } catch (e) { return 0 }
}

function statusText(recorder) {
  try {
    const s = recorder.getStatus()
    const st = recorder.state || {}
    const name = Object.keys(st).find((k) => st[k] === s)
    return name ? `${name} (${s})` : String(s)
  } catch (e) {
    return `? (${errorText(e)})`
  }
}

function stopRecording(run, why) {
  if (run.stopped || run.finished) return
  run.stopped = true
  run.tStop = Date.now()
  const recMs = run.tStop - (run.tStart || run.t0)
  run.recMs = recMs
  devLog(`${run.tag}: stop (${why}) after ${recMs}ms of recording${run.tStart ? '' : ' (no START event yet)'}`)
  if (run.timeText) run.timeText.setProperty(prop.TEXT, 'Sending…')
  if (run.hintText) run.hintText.setProperty(prop.TEXT, '')
  try { run.recorder.stop() } catch (e) { warnLog(`${run.tag}: stop() failed: ${errorText(e)}`) }
  // The file is read on the STOP event, or after this wait without one. A
  // recorder that sent no START sends no STOP either (an API 3 watch, whose
  // recorder has no getStatus): a short wait, then the size must hold
  const wait = run.tStart ? STOP_WAIT_MS : NO_EVENTS_WAIT_MS
  run.timers.push(setTimeout(() => afterStop(run, `no STOP event in ${wait}ms`), wait))
}

function afterStop(run, why) {
  if (run.read || run.finished) return
  // The STOP event can come without a stop() (the recorder gave up)
  if (!run.stopped) {
    run.stopped = true
    run.tStop = Date.now()
    run.recMs = run.tStop - (run.tStart || run.t0)
    warnLog(`${run.tag}: recording stopped by itself after ${run.recMs}ms`)
  }
  run.read = true
  waitForFile(run, why)
}

// On the watch the file was still being written after the STOP event (67 B
// read 9 ms after it, 4.7 KB a few seconds later for 3 s): read once its
// size held for two checks in a row
const SETTLE_CHECK_MS = 150
const SETTLE_MAX_MS = 5000
function waitForFile(run, why) {
  const t0 = Date.now()
  const sizes = [fileSize()]
  let same = 0
  const check = () => {
    if (run.finished) return
    const s = fileSize()
    if (s !== sizes[sizes.length - 1]) { sizes.push(s); same = 0 } else same++
    const waited = Date.now() - t0
    if ((same >= 2 && s > 0) || waited >= SETTLE_MAX_MS) {
      devLog(`${run.tag}: file ${sizes.join(' → ')} B, ${same >= 2 ? 'settled' : 'still changing'} after ${waited}ms`)
      return readRecording(run, why)
    }
    run.timers.push(setTimeout(check, SETTLE_CHECK_MS))
  }
  run.timers.push(setTimeout(check, SETTLE_CHECK_MS))
}

function readRecording(run, why) {
  const { vm, tag } = run
  const tRead = Date.now()
  // The file is final: the microphone is free, a file waiting can play
  recordingOver()
  let bytes
  try {
    const st = statSync({ path: AUDIO_FILE })
    if (!st || !st.size) {
      warnLog(`${tag}: no recording on file (${why}): ${st ? 'empty' : 'no file'}`)
      return run.finish('Nothing was recorded', true)
    }
    const buf = readFileSync({ path: AUDIO_FILE })
    if (!buf) throw new Error('file not read')
    bytes = new Uint8Array(buf)
  } catch (e) {
    warnLog(`${tag}: recording not read: ${errorText(e)}`)
    return run.finish('Recording not read:\n' + errorText(e), true)
  }
  const recS = (run.recMs || 0) / 1000
  const ogg = bytes.length >= 4 && bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53
  run.ogg = ogg
  infoLog(`${tag}: recorded ${recS.toFixed(1)}s, ${sizeText(bytes.length)} (${recS > 0 ? Math.round(bytes.length / recS) : '?'} B/s), ` +
    `${ogg ? 'an Ogg file' : 'NOT an Ogg file'}; read in ${Date.now() - tRead}ms (${why})`)
  devLog(`${tag}: first bytes ${hexHead(bytes, 32)}; ${memoryUsage()}`)
  if (!ogg) {
    // Length + range + packet, over and over (utils/opus-frames.js)?
    const f = parseOpusFrames(bytes)
    devLog(`${tag}: as length-prefixed Opus packets: ${f.packets} packets, ${f.ms} ms of audio, ${f.configs || 'none'}` +
      `${f.stereo ? ', stereo' : ', mono'}; ${f.parsed === f.total ? 'the whole file reads so' : `breaks at byte ${f.parsed} of ${f.total}`}`)
  }
  sendParts(run, bytes)
}

// The recording to the phone, one part after the other
function sendParts(run, bytes) {
  const { vm, tag } = run
  const total = bytes.length
  const n = Math.ceil(total / PART_BYTES)
  const testId = String(Date.now())
  const tSend = Date.now()
  let i = 0
  const next = () => {
    if (run.finished) return
    if (i >= n) return runTests(run, testId, total, Date.now() - tSend)
    const from = i * PART_BYTES
    const data = bytesToBase64(bytes, from, Math.min(total, from + PART_BYTES))
    const tPart = Date.now()
    vm.request({ method: 'AUDIO_PART', params: { id: testId, i, n, data } })
      .then((r) => {
        if (!r || !r.ok) throw new Error((r && r.error) || 'refused')
        devLog(`${tag}: part ${i + 1}/${n} (${sizeText(data.length)} base64) in ${Date.now() - tPart}ms`)
        i++
        next()
      })
      .catch((e) => {
        warnLog(`${tag}: part ${i + 1}/${n} failed after ${Date.now() - tPart}ms: ${errorText(e)}`)
        run.finish(`Sending to the phone failed (part ${i + 1}/${n})`, true)
      })
  }
  devLog(`${tag}: sending ${sizeText(total)} in ${n} parts`)
  next()
}

function runTests(run, testId, total, sendMs) {
  const { vm, tag } = run
  const button = run.button || {}
  const request = button.request || {}
  infoLog(`${tag}: ${sizeText(total)} on the phone in ${sendMs}ms (${sendMs > 0 ? Math.round(total * 1000 / sendMs) : '?'} B/s); phone tests start`)
  const tTests = Date.now()
  vm.request({
    method: 'AUDIO_TEST',
    params: { id: testId, size: total, url: request.url, field: (button.audio_test && button.audio_test.field) || 'file', ogg: run.ogg },
  }, { timeout: TESTS_RPC_MS })
    .then((r) => {
      devLog(`${tag}: phone tests answered in ${Date.now() - tTests}ms; ${memoryUsage()}`)
      const head = `${((run.recMs || 0) / 1000).toFixed(1)}s, ${sizeText(total)}, ${run.ogg ? 'Ogg' : 'not Ogg'}\nto phone ${(sendMs / 1000).toFixed(1)}s`
      if (!r || !r.ok) return run.finish(`${head}\n${(r && r.error) || 'Tests failed on the phone'}`, true)
      run.finish(`${head}\n${r.summary || ''}`, !r.allOk)
    })
    .catch((e) => {
      warnLog(`${tag}: phone tests failed after ${Date.now() - tTests}ms: ${errorText(e)}`)
      run.finish('Phone tests failed:\n' + errorText(e), true)
    })
}

// Full screen while recording: the time, and a tap anywhere stops
function drawOverlay(run, seconds, onTap) {
  const { width: W, height: H } = getDeviceInfo()
  const add = (type, o) => { const w = createWidget(type, o); run.widgets.push(w); return w }
  add(widget.FILL_RECT, { x: 0, y: 0, w: W, h: H, color: COLOR_BLACK })
  add(widget.TEXT, {
    x: 0, y: Math.round(H * 0.26), w: W, h: Math.round(H * 0.12),
    text: '● REC', text_size: Math.round(H * 0.08), color: COLOR_BRIGHT_RED,
    align_h: align.CENTER_H, align_v: align.CENTER_V, text_style: text_style.NONE,
  })
  run.timeText = add(widget.TEXT, {
    x: 0, y: Math.round(H * 0.42), w: W, h: Math.round(H * 0.14),
    text: `0.0 s / ${seconds} s`, text_size: Math.round(H * 0.075), color: COLOR_WHITE,
    align_h: align.CENTER_H, align_v: align.CENTER_V, text_style: text_style.NONE,
  })
  run.hintText = add(widget.TEXT, {
    x: 0, y: Math.round(H * 0.6), w: W, h: Math.round(H * 0.1),
    text: 'Tap to stop', text_size: Math.round(H * 0.05), color: COLOR_GRAY,
    align_h: align.CENTER_H, align_v: align.CENTER_V, text_style: text_style.NONE,
  })
  // A tap on a text is the text's: each one stops
  run.widgets.forEach((w) => w.addEventListener(event.CLICK_DOWN, onTap))
}

function cleanup(run) {
  run.timers.forEach((t) => { clearTimeout(t); clearInterval(t) })
  run.timers = []
  if (run.recorder && !run.stopped) {
    run.stopped = true
    try { run.recorder.stop() } catch (e) { /* already stopped */ }
  }
  run.widgets.forEach((w) => { try { deleteWidget(w) } catch (e) { /* gone */ } })
  run.widgets = []
  run.timeText = run.hintText = null
}
