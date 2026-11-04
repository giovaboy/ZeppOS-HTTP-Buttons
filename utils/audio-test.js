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
import { playAudioFile } from './audio-play.js'
import { COLOR_BLACK, COLOR_WHITE, COLOR_BRIGHT_RED, COLOR_GRAY, SYSTEM_MODAL } from './constants.js'
import { devLog, infoLog, warnLog } from './remote-log.js'
import { memoryUsage, errorText, sizeText } from './memory.js'

const AUDIO_FILE = 'audio_test.opus'
const DEFAULT_SECONDS = 5
const MAX_SECONDS = 30
// Bytes per message to the phone (a multiple of 3: the parts' base64 joins
// into one text). ~6 KB of base64 each
const PART_BYTES = 4500
// No STOP event this long after stop(): the file is read anyway
const STOP_WAIT_MS = 3000
// The phone's tests (several POSTs of the recording): the RPC window
const TESTS_RPC_MS = 120000

// The test running on this page (one at a time: the button's press queue
// holds the others), so the page's onDestroy can stop it
let current = null

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
    if (text) vm.showResult(text, pageid, isError, SYSTEM_MODAL)
    done()
  }
  run.finish = finish

  // The last recording's file would be read if this one writes nothing
  try { if (statSync({ path: AUDIO_FILE })) rmSync({ path: AUDIO_FILE }) } catch (e) { /* not there */ }

  drawOverlay(run, seconds, () => stopRecording(run, 'tap'))

  let recorder
  try {
    recorder = run.recorder = create(id.RECORDER)
  } catch (e) {
    warnLog(`${tag}: recorder not created: ${errorText(e)}`)
    // e.g. PERMISSION_DENIED device:os.mic without the app.json permission
    return finish('Recorder not available:\n' + errorText(e), true)
  }
  try {
    recorder.addEventListener(recorder.event.START, (result) => {
      run.tStart = Date.now()
      devLog(`${tag}: START event (result ${result}) ${run.tStart - run.t0}ms after the press, status ${statusText(recorder)}`)
      if (result === false) {
        warnLog(`${tag}: the recorder did not start (permission? microphone busy?)`)
        finish('The recorder did not start', true)
      }
    })
    recorder.addEventListener(recorder.event.STOP, (result) => {
      devLog(`${tag}: STOP event (result ${result}) ${run.tStop ? Date.now() - run.tStop : '?'}ms after stop()`)
      afterStop(run, 'STOP event')
    })
    recorder.setFormat(codec.OPUS, { target_file: 'data://' + AUDIO_FILE })
    recorder.start()
    devLog(`${tag}: start() called, status ${statusText(recorder)}`)
  } catch (e) {
    warnLog(`${tag}: recording failed to start: ${errorText(e)}`)
    return finish('Recording failed to start:\n' + errorText(e), true)
  }

  // The timer on screen, and the stop at the limit
  run.timers.push(setInterval(() => {
    if (run.stopped) return
    const from = run.tStart || run.t0
    const s = (Date.now() - from) / 1000
    if (run.timeText) run.timeText.setProperty(prop.TEXT, `${s.toFixed(1)} s / ${seconds} s`)
    if (s >= seconds) stopRecording(run, 'limit')
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

// The page goes away: the recording stops, nothing is sent
export function stopAudioTest() {
  const run = current
  if (!run) return
  devLog(`${run.tag}: page closed during the test`)
  run.finished = true
  cleanup(run)
  current = null
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
  // The file is read on the STOP event, or after this wait without one
  run.timers.push(setTimeout(() => afterStop(run, `no STOP event in ${STOP_WAIT_MS}ms`), STOP_WAIT_MS))
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
  const { vm, tag } = run
  const tRead = Date.now()
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
  run.widgets.forEach((w) => w.addEventListener(event.CLICK_UP, onTap))
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
