// The page that runs one button: opened by the shortcut card
// (app-widget/index.js) for any button, and by the buttons page for an audio
// button (from: 'page'). From the card: the button's name as the title, the
// app's loading animation while its request runs (utils/button-request.js,
// as on the buttons page), then the result in the page's body (a check for
// "no notification"), and back to the card by itself (a tap goes back at
// once). From the buttons page: only the audio screens, the result handed
// back to that page (handOver). The button is read from the watch's copy
// of the config: nothing to wait for before the press. Once the result is
// shown the phone is asked for its config, to keep the copy (and so the card)
// up to date; asked before, it held up the press in the queue.
// An image button: the phone sends the picture as a file, which the app hands
// to the page registered in globalData.onIncomingFile (this one while it is
// open, the buttons page's handler put back after); it shows full screen until
// a tap, or IMAGE_STAY_MS.
import { BasePage } from '@zeppos/zml/base-page'
import { createWidget, deleteWidget, widget, align, text_style, prop, event, anim_status, getTextLayout } from '@zos/ui'
import { rmSync } from '@zos/fs'
import { getDeviceInfo, SCREEN_SHAPE_ROUND } from '@zos/device'
import { back } from '@zos/router'
import { setPageBrightTime, resetPageBrightTime, pauseDropWristScreenOff, resetDropWristScreenOff } from '@zos/display'
import { onKey, offKey, KEY_SELECT, KEY_EVENT_CLICK } from '@zos/interaction'
import { getText } from '@zos/i18n'
import { requestMethods, parseJSON, capText, cachedSessions, clearSessionCache } from '../utils/button-request.js'
import { readConfigCopy, writeConfigCopy } from '../utils/config-copy.js'
import { stopAllLoaders } from '../utils/button-loader.js'
import { isSystemKeyboardAvailable, openSystemKeyboard } from '../utils/keyboard.js'
import { openAppKeyboard } from '../utils/app-keyboard.js'
import { kb_lowercase, kb_uppercase, kb_numbers, kb_symbols, KEY_SYMB, KEY_NUM, KEY_ABC, KEY_abc, KEY_SEND, KEY_CANCEL, KEY_BACKSPACE } from 'zosLoader:./keyboard.[pf].layout.js'
import { cardAllowed } from '../utils/card.js'
import { progressScreen } from '../utils/progress-screen.js'
import { runAudioTest, playLastRecording, stopAudioTest, stopRecordingNow, sendAudioParts } from '../utils/audio-test.js'
import { playAudioFile, stopAudioPlay, stopPlaybackNow } from '../utils/audio-play.js'
import { COLOR_BLACK, COLOR_WHITE, NO_NOTIFICATION, SHOW_IMAGE, PLAY_AUDIO, AUDIO_DEFAULT, REQUEST_TIMEOUT_RPC_MARGIN_MS } from '../utils/constants.js'
import { infoLog, warnLog, devLog, LOG_TRACE } from '../utils/remote-log.js'
import { errorText } from '../utils/memory.js'

const { width: W, height: H, screenShape } = getDeviceInfo()
// This screen's key layouts, for the keyboard the app draws
const KEYS = { kb_lowercase, kb_uppercase, kb_numbers, kb_symbols, KEY_SYMB, KEY_NUM, KEY_ABC, KEY_abc, KEY_SEND, KEY_CANCEL, KEY_BACKSPACE }
const ROUND = screenShape === SCREEN_SHAPE_ROUND

// The page, as the audio screens (utils/progress-screen.js) and the design
// guide: the button's name as the title at the top, the waiting animation in
// the middle with "Sending…" under it, then the result in the page's body
const TITLE_Y = Math.round(H * (ROUND ? 0.085 : 0.05))
const TITLE_H = Math.round(H * (ROUND ? 0.11 : 0.12))
const TITLE_W = Math.round(W * (ROUND ? 0.64 : 0.84))
const BODY_X = Math.round(W * (ROUND ? 0.10 : 0.06))
const BODY_W = W - 2 * BODY_X
const BODY_Y = Math.round(H * 0.22)
const BODY_H = Math.round(H * (ROUND ? 0.62 : 0.70))
const RESULT_SIZE = 34
// The app's loading animation (assets/anim/loading_*.png, as at the app's
// start): its frames are 155 px, not scaled
const SPIN = 155
const SPIN_Y = Math.round(H * 0.42 - SPIN / 2)
const RESULT_MAX = 300           // characters shown (a few lines)
const COLOR_ERROR = 0xff5a5a
const COLOR_DONE = 0x3cb371
const COLOR_NOTE = 0xdddddd

// How long the result stays before going back: a short "done", or a time
// that grows with the text (a tap goes back at once)
const DONE_MS = 1000
// A picture is looked at: it stays until a tap, at most this long
const IMAGE_STAY_MS = 30000
// The screen kept on (keepAwake): after a recording's longest time, for
// sending it and showing the result; for a playback
const AWAKE_AFTER_RECORDING_S = 90
const AWAKE_PLAYBACK_MS = 5 * 60 * 1000
const closeDelay = (text, isError) =>
  Math.min(8000, 2500 + 40 * String(text || '').length) + (isError ? 1500 : 0)

// Params from the card: {"p":0,"r":1,"b":2}
function parseParams(params) {
  try {
    const o = typeof params === 'string' ? JSON.parse(params) : params
    if (o && [o.p, o.r, o.b].every((n) => Number.isInteger(n) && n >= 0)) return o
  } catch (e) { /* bad params */ }
  return null
}

Page(
  BasePage({
    // executeButtonRequest and the rest of a button's run
    ...requestMethods,

    state: {},

    onInit(params) {
      this.where = parseParams(params)
      // Opened by the buttons page (an audio button) or by the card
      this.fromPage = !!(this.where && this.where.from === 'page')
      this.tag = this.fromPage ? '[run]' : '[card]'
      this.destroyed = false
      this.audio = false
      this.awake = false
      this.pendingResult = null
      this.bg = null
      this.closed = false
      this.closeTimer = null
      this.pollsCancelled = false
      this.pollTimers = null
      this.inFlight = 0
      this.shown = null
      // The buttons page keeps the watch's copy up to date itself
      this.refreshed = this.fromPage
      this.state.config = null
      this.isImage = false
      this.imageShown = false
      this.imageWaitTimer = null
      this.pendingImageRun = null
      // Files pushed by the phone come here while this page is open; the
      // handler before (the buttons page's, if it is open below) comes back
      // in onDestroy
      this.fileHandler = (file) => this.handleIncomingFile(file)
      if (this.globalData) {
        this.prevFileHandler = this.globalData.onIncomingFile
        this.globalData.onIncomingFile = this.fileHandler
      }
    },

    build() {
      // Under everything: a black button the size of the screen, so a tap
      // anywhere goes back (texts and shapes on top are made not to take taps)
      // EXPERIMENT (audio): SELECT stops a recording (and sends it) or a
      // playback, as a tap does. Other keys keep their default; while audio
      // runs they are logged, to learn the codes of each watch's keys
      onKey({
        callback: (key, keyEvent) => {
          if (!this.audio) return false
          if (key === KEY_SELECT && keyEvent === KEY_EVENT_CLICK) {
            const stopped = stopRecordingNow('SELECT key') || stopPlaybackNow()
            if (LOG_TRACE) devLog(`${this.tag} ${this.label}: SELECT ${stopped ? 'stopped it' : 'with nothing to stop'}`)
            return stopped
          }
          if (LOG_TRACE) devLog(`${this.tag} ${this.label}: key ${key} event ${keyEvent} during audio (left to the system)`)
          return false
        },
      })
      this.bg = createWidget(widget.BUTTON, {
        x: 0, y: 0, w: W, h: H, text: '', radius: 0,
        normal_color: COLOR_BLACK, press_color: COLOR_BLACK,
        click_func: () => this.close()
      })
      // The result, in the page's body (showResult)
      this.status = this.passThrough(createWidget(widget.TEXT, {
        x: BODY_X, y: BODY_Y, w: BODY_W, h: BODY_H,
        color: COLOR_WHITE, text_size: RESULT_SIZE,
        align_h: align.CENTER_H, align_v: align.CENTER_V,
        text_style: text_style.WRAP, text: ''
      }))

      const config = parseJSON(readConfigCopy())
      const w = this.where
      const page = config && config.pages && w && config.pages[w.p]
      const row = page && page.rows && page.rows[w.r]
      const button = row && row.buttons && row.buttons[w.b]
      if (!button) {
        warnLog(`[card] button ${w ? `p${w.p}r${w.r}b${w.b}` : '(no params)'} not in the watch's copy of the config`)
        return this.message(getText('run_missing'), true)
      }
      this.state.config = config
      this.label = (this.fromPage ? '' : 'card ') + 'p' + w.p + 'r' + w.r + 'b' + w.b + (button.text ? ' ' + String(button.text).slice(0, 20) : '')
      this.buttonText = button.text || ''
      // Opened by the buttons page (an audio button): no screen of its own,
      // only the audio's (REC, player), kept until it goes back; drawn
      // here, the button flashed between the audio screen and the way back
      if (!this.fromPage) this.drawTitle(button)
      if (!cardAllowed(button)) return this.message(getText('run_in_app'), true)

      // EXPERIMENT (test mode): record and send, or play the last recording
      // Record, then send (request.audio), or the test suite's experiments
      if (button.audio_test || button.audio_last || (button.request && button.request.audio)) return this.runAudio(button)

      // The typed text fires the button; a cancel goes back
      if (button.input) return this.askInput(button, (text) => this.fire(button, text))
      this.fire(button, null)
    },

    // An input button's text: the system keyboard, or before API 4.0 the one
    // the app draws, as on the buttons page (utils/app-keyboard.js). A cancel
    // goes back (to the buttons page or the card)
    askInput(button, onText) {
      if (isSystemKeyboardAvailable()) {
        return openSystemKeyboard(this, button, this.where.p, onText, () => this.close())
      }
      if (LOG_TRACE) devLog(`${this.tag} ${this.label}: no system keyboard, the app's keyboard`)
      this.appKeyboard = openAppKeyboard({
        keys: KEYS, keyboardType: button.keyboard_type, y: 0,
        onSubmit: (text) => { this.appKeyboard = null; onText(text) },
        onCancel: () => { this.appKeyboard = null; this.close() },
      })
    },

    // A text or shape on top of the background button must not take its taps
    passThrough(wd) {
      try { if (wd && typeof wd.setEnable === 'function') wd.setEnable(false) } catch (e) { /* older API */ }
      return wd
    },

    // Waiting for a file to play (opened by the buttons page): "♪ name",
    // "Loading…", as the player's screen then shows them
    // (utils/progress-screen.js, as the player's: the empty bar; a swipe back
    // cancels, a tap does nothing)
    drawLoading() {
      progressScreen({ title: '♪ ' + (this.buttonText || ''), value: getText('play_loading'), note: getText('play_getting') })
    },

    // The pressed button, with its colors, radius and text
    // The button's name, as the audio screens' title
    drawTitle(button) {
      this.passThrough(createWidget(widget.TEXT, {
        x: Math.round((W - TITLE_W) / 2), y: TITLE_Y, w: TITLE_W, h: TITLE_H,
        color: COLOR_WHITE, text_size: 40,
        align_h: align.CENTER_H, align_v: align.CENTER_V,
        text_style: text_style.ELLIPSIS, text: button.text || ''
      }))
    },

    // Waiting for the answer: the app's loading animation, "Sending…" under it
    showSpinner() {
      this.spinner = this.passThrough(createWidget(widget.IMG_ANIM, {
        anim_path: 'anim', anim_prefix: 'loading', anim_ext: 'png', anim_fps: 24, anim_size: 54,
        repeat_count: 0, anim_status: anim_status.START,
        x: Math.round((W - SPIN) / 2), y: SPIN_Y
      }))
      this.spinnerText = this.passThrough(createWidget(widget.TEXT, {
        x: BODY_X, y: SPIN_Y + SPIN + 12, w: BODY_W, h: Math.round(H * 0.12),
        color: COLOR_NOTE, text_size: RESULT_SIZE,
        align_h: align.CENTER_H, align_v: align.CENTER_V,
        text_style: text_style.NONE, text: getText('run_sending')
      }))
    },
    hideSpinner() {
      if (this.spinner) {
        try { this.spinner.setProperty(prop.ANIM_STATUS, anim_status.STOP) } catch (e) { /* gone */ }
        try { deleteWidget(this.spinner) } catch (e) { /* gone */ }
        this.spinner = null
      }
      if (this.spinnerText) { try { deleteWidget(this.spinnerText) } catch (e) { /* gone */ } this.spinnerText = null }
    },

    fire(button, input) {
      const t0 = Date.now()
      // A file comes after the answer: an image, or an audio file to play
      const style = Number(button.request && button.request.response_style)
      this.isImage = style === SHOW_IMAGE || style === PLAY_AUDIO || !!(button.request && button.request.audio_play)
      // From the buttons page (a file to play): its screen at once, the
      // player's look, while the phone fetches the file
      if (this.fromPage) this.drawLoading()
      else this.showSpinner()
      let p
      try {
        p = this.executeButtonRequest(button.request, this.where.p, input, this.label)
      } catch (e) {
        p = Promise.reject(e)
      }
      Promise.resolve(p).then(() => this.finished(t0), (e) => {
        warnLog(`${this.tag} ${this.label}: ${errorText(e)}`)
        this.showResult(String(errorText(e)), this.where.p, true)
        this.finished(t0)
      })
    },

    // What the buttons page shows as a toast or a modal, shown here under the
    // button (utils/button-request.js reportResult / reportError call it)
    showResult(text, pageid, isError, style) {
      // Opened by the buttons page: the result goes back to it, shown there in
      // the button's own style (handOver). Not drawn here: it flashed under
      // the button just before going back
      if (this.fromPage) {
        this.pendingResult = { text: capText(text), isError: !!isError, style }
        this.shown = { text: '', isError: !!isError, quiet: true }
        return
      }
      this.hideSpinner()
      // "Nothing": a big check, for done; otherwise the text in the page's
      // body, red for an error. A long one makes its box taller and the page
      // scrolls
      const quiet = !isError && Number(style) === NO_NOTIFICATION
      this.shown = { text: quiet ? '✓' : capText(text).slice(0, RESULT_MAX), isError: !!isError, quiet }
      let h = BODY_H
      if (!quiet) {
        try {
          const l = getTextLayout(this.shown.text, { text_size: RESULT_SIZE, text_width: BODY_W, wrapped: 1 })
          if (l && l.height > BODY_H) h = l.height + RESULT_SIZE
        } catch (e) { /* the box as it is */ }
      }
      this.status.setProperty(prop.MORE, {
        x: BODY_X, y: BODY_Y, w: BODY_W, h,
        text: this.shown.text,
        color: quiet ? COLOR_DONE : isError ? COLOR_ERROR : COLOR_WHITE,
        text_size: quiet ? 96 : RESULT_SIZE
      })
    },

    finished(t0) {
      // An image: the phone only said it has the picture; the file comes
      // after (handleIncomingFile), or its failure (clearImageSpinner)
      if (this.isImage && !this.shown && !this.imageShown) return
      stopAllLoaders()
      // Now that the press is over (asking before held it up in the queue)
      this.refreshCopy()
      if (this.imageShown) return
      const s = this.shown
      if (LOG_TRACE) devLog(`${this.tag} ${this.label}: done in ${Date.now() - t0}ms`)
      if (this.handOver()) return
      this.closeAfter(!s ? DONE_MS : (s.quiet ? DONE_MS : closeDelay(s.text, s.isError)))
    },

    // The picture's file, pushed by the phone: wait for it to be written
    // (readyState "transferred"), then show it full screen
    handleIncomingFile(file) {
      if (!file) return
      const tIn = Date.now()
      if (LOG_TRACE) devLog(`${this.tag} ${this.label}: image incoming${file.fileSize ? ', ' + file.fileSize + ' B' : ''}`)
      file.on('change', (e) => {
        const state = e && e.data && e.data.readyState
        if (state === 'transferred') {
          if (this.closed) return
          if ((file.params || {}).type === 'audio') return this.playReceived(file, tIn)
          this.imageShown = true
          this.hideSpinner()
          this.clearImageSpinner()
          try {
            this.showImage(file.filePath)
            infoLog(`${this.tag} ${this.label}: image shown, ${Date.now() - tIn}ms after it started to arrive`)
          } catch (err) {
            warnLog(`${this.tag} ${this.label}: image not shown: ${errorText(err)}`)
          }
          this.closeAfter(IMAGE_STAY_MS)
          this.refreshCopy()
        } else if (state === 'error' || state === 'canceled') {
          warnLog(`${this.tag} ${this.label}: image transfer ${state} after ${Date.now() - tIn}ms`)
          try { if (file.filePath) rmSync({ path: file.filePath }) } catch (err) { /* not there */ }
          this.clearImageSpinner()
        }
      })
    },

    // The image's wait is over (shown, failed, or timed out): the animation
    // stops; without a picture, the error stays a moment (the module may show
    // its own just after this)
    clearImageSpinner() {
      if (this.imageWaitTimer) { clearTimeout(this.imageWaitTimer); this.imageWaitTimer = null }
      stopAllLoaders()
      if (this.imageShown) return
      if (!this.shown) this.showResult(getText('run_no_image'), 0, true)
      if (this.handOver()) return
      this.closeAfter(closeDelay(this.shown.text, true))
    },

    // Opened by the buttons page: back to it at once, the result handed over
    // (globalData.runResult) for the page to show in the button's style, as
    // any button's (page/index.js showRunResult). From the card: false, the
    // result stays here (a card shows no toast nor modal)
    handOver() {
      if (!this.fromPage || this.destroyed) return false
      const r = this.pendingResult
      this.pendingResult = null
      if (r && this.globalData) this.globalData.runResult = { ...r, page: this.where.p, at: Date.now() }
      if (LOG_TRACE) devLog(`${this.tag} ${this.label}: back to the buttons page${r ? ', its result to show there' : ''}`)
      this.close()
      return true
    },

    // Full screen, scaled to fit and centered, as on the buttons page; a tap
    // on it goes back
    showImage(filePath) {
      const bg = createWidget(widget.FILL_RECT, { x: 0, y: 0, w: W, h: H, color: COLOR_BLACK, alpha: 255 })
      const img = createWidget(widget.IMG, { x: 0, y: 0, src: filePath })
      const iw = img.getProperty(prop.W), ih = img.getProperty(prop.H)
      if (iw > 0 && ih > 0) {
        const scale = Math.min(W / iw, H / ih)
        const w = Math.round(iw * scale), h = Math.round(ih * scale)
        img.setProperty(prop.MORE, { x: Math.round((W - w) / 2), y: Math.round((H - h) / 2), w, h, auto_scale: true, auto_scale_obj_fit: true })
        if (LOG_TRACE) devLog(`${this.tag} ${this.label}: image ${iw}x${ih} drawn at ${w}x${h}`)
      } else {
        img.setProperty(prop.MORE, { x: 0, y: 0, w: W, h: H, auto_scale: true, auto_scale_obj_fit: false })
      }
      bg.addEventListener(event.CLICK_DOWN, () => this.close())
      img.addEventListener(event.CLICK_DOWN, () => this.close())
    },

    // EXPERIMENT (test mode): an audio button, on its own screen over this
    // one (utils/audio-test.js, utils/audio-play.js). The background button
    // (a tap goes back) is off meanwhile: a tap there stops the recording or
    // the playback. The result shows here as any other
    runAudio(button) {
      this.audio = true
      this.setBgEnabled(false)
      const p = this.where.p
      // A recording: its longest time, then sending and the result; a
      // playback: a few minutes (the page goes back at its end anyway)
      const rec = button.audio_test || (button.request && button.request.audio)
      const secs = rec ? Math.min(30, Math.max(1, Number(rec.seconds) || AUDIO_DEFAULT.seconds)) : 0
      this.keepAwake(rec ? (secs + AWAKE_AFTER_RECORDING_S) * 1000 : AWAKE_PLAYBACK_MS)
      if (button.audio_last) {
        if (!playLastRecording(this, p, this.label, () => {}, (why) => this.audioOver(why), { keepScreen: this.fromPage })) this.audioOver('nothing to play')
        return
      }
      if (button.audio_test) return runAudioTest(this, button, p, this.label, () => this.audioOver('recorded'), { keepScreen: this.fromPage })
      // An input button that records: the text first, then the recording; the
      // text goes in {input} (URL, headers, body: beside {audio} in JSON)
      if (button.input) return this.askInput(button, (text) => this.recordAndSend(button, secs, text))
      this.recordAndSend(button, secs, null)
    },

    // The button's own request (request.audio): the recording screen, then
    // the request runs as any button's (variables, {input}, auth,
    // parse_result, the notification, a poll), its body built on the phone
    // (audioRequest)
    recordAndSend(button, secs, input) {
      const p = this.where.p
      if (input != null && LOG_TRACE) devLog(`${this.tag} ${this.label}: ${String(input).length} chars typed, now the recording`)
      runAudioTest(this, { audio_test: { seconds: secs } }, p, this.label, () => this.audioOver('recorded'), {
        keepScreen: this.fromPage,
        title: this.buttonText,
        onRecorded: (bytes, run) => {
          this.recording = bytes
          let p2
          try { p2 = this.executeButtonRequest(button.request, p, input, this.label) } catch (e) { p2 = Promise.reject(e) }
          Promise.resolve(p2).then(() => run.finish(null), (e) => {
            warnLog(`${this.tag} ${this.label}: ${errorText(e)}`)
            run.finish(String(errorText(e)), true)
          })
        },
      })
    },

    // The request of a recording button (utils/button-request.js
    // performRequest, d.audio): the recording to the phone in parts, then the
    // request; the phone wraps it in Ogg, builds the body (multipart / raw /
    // JSON) and sends it with the button's headers and auth. Resolves the
    // answer as an ordinary request does ({ status, headers, body })
    audioRequest(d, { headers, timeout }) {
      const bytes = this.recording
      if (!bytes || !bytes.length) return Promise.reject(new Error('No recording'))
      const a = Object.assign({}, AUDIO_DEFAULT, d.audio || {})
      const tag = '[audio] ' + this.label
      return sendAudioParts(this, bytes, tag, () => this.destroyed).then((id) => {
        const t0 = Date.now()
        return this.request({
          method: 'AUDIO_REQUEST',
          params: {
            id, size: bytes.length,
            url: d.url, method: d.method || 'POST', headers, body: d.body,
            auth: d.auth, user: d.user, pass: d.pass, token: d.token,
            timeout, send_as: a.send_as, field: a.field,
          },
        }, { timeout: timeout + REQUEST_TIMEOUT_RPC_MARGIN_MS + 15000 }).then((r) => {
          if (!r || r.error) throw new Error((r && r.error) || getText('run_no_answer'))
          if (LOG_TRACE) devLog(`${tag}: the phone answered HTTP ${r.status} in ${Date.now() - t0}ms`)
          return r
        })
      })
    },

    // An audio file from the button's call (request.audio_play), as the phone
    // sent it: played, then removed
    playReceived(file, tIn) {
      this.imageShown = true // the media came: finished() and the wait leave it be
      this.hideSpinner()
      this.clearImageSpinner()
      this.audio = true
      this.keepAwake(AWAKE_PLAYBACK_MS)
      this.setBgEnabled(false)
      infoLog(`${this.tag} ${this.label}: audio received, ${Date.now() - tIn}ms after it started to arrive`)
      playAudioFile(this, file.filePath, { tag: '[play] ' + this.label, pageid: this.where.p, remove: true, label: this.buttonText, onEnd: (why) => this.audioOver(why), keepScreen: this.fromPage })
    },

    // The recording's result is shown, or playback is over: back after a
    // moment (at once after a tap that stopped it)
    audioOver(why) {
      if (this.destroyed) return
      this.setBgEnabled(true)
      stopAllLoaders()
      if (this.handOver()) return
      if (why === 'tap') return this.close()
      if (why === 'complete') return this.closeAfter(DONE_MS)
      const s = this.shown
      this.closeAfter(s ? closeDelay(s.text, s.isError) : DONE_MS)
    },

    // The screen stays on while audio runs: on the Balance the watch went to
    // rest during a recording, and a 20 s playback ended at 13.7 s with the
    // page. Lowering the wrist doesn't turn it off either. Both back to the
    // system's in onDestroy
    keepAwake(ms) {
      try { setPageBrightTime({ brightTime: ms }) } catch (e) { warnLog(`${this.tag} ${this.label}: setPageBrightTime failed: ${errorText(e)}`) }
      try { if (typeof pauseDropWristScreenOff === 'function') pauseDropWristScreenOff({ duration: ms }) } catch (e) { warnLog(`${this.tag} ${this.label}: pauseDropWristScreenOff failed: ${errorText(e)}`) }
      this.awake = true
      if (LOG_TRACE) devLog(`${this.tag} ${this.label}: screen kept on for ${Math.round(ms / 1000)} s`)
    },

    setBgEnabled(on) {
      try { if (this.bg && typeof this.bg.setEnable === 'function') this.bg.setEnable(on) } catch (e) { /* older API */ }
    },

    // A message instead of a run (button missing, no keyboard)
    message(text, isError) {
      this.showResult(text, 0, isError)
      this.refreshCopy()
      if (this.handOver()) return
      this.closeAfter(closeDelay(text, isError))
    },

    closeAfter(ms) {
      if (this.closeTimer) clearTimeout(this.closeTimer)
      this.closeTimer = setTimeout(() => { this.closeTimer = null; this.close() }, ms)
    },

    close() {
      if (this.closed) return
      this.closed = true
      back()
    },

    // The phone's config, to keep the watch's copy (hence the card) up to
    // date; nothing is redrawn here
    refreshCopy() {
      if (this.refreshed) return
      this.refreshed = true
      const copy = readConfigCopy()
      this.request({ method: 'GET_DATA' })
        .then(({ result }) => {
          const cfg = result ? parseJSON(result) : undefined
          if (result && result !== copy && cfg && cfg.pages) {
            writeConfigCopy(result)
            infoLog('[card] the phone\'s config changed: copy updated for the card')
          }
        })
        .catch((e) => { if (LOG_TRACE) devLog(`[card] GET_DATA failed: ${errorText(e)}`) })
    },

    onDestroy() {
      this.destroyed = true
      this.hideSpinner()
      try { offKey() } catch (e) { /* older API */ }
      if (this.awake) {
        try { resetPageBrightTime() } catch (e) { /* older API */ }
        try { if (typeof resetDropWristScreenOff === 'function') resetDropWristScreenOff() } catch (e) { /* older API */ }
      }
      // EXPERIMENT: a recording stops and nothing is sent (a swipe back
      // cancels it); playback stops (stop + release)
      stopAudioTest()
      stopAudioPlay()
      if (this.closeTimer) { clearTimeout(this.closeTimer); this.closeTimer = null }
      if (this.imageWaitTimer) { clearTimeout(this.imageWaitTimer); this.imageWaitTimer = null }
      // The app's keyboard, if the page goes while it is open
      if (this.appKeyboard) { this.appKeyboard.close(); this.appKeyboard = null }
      // The files go back to the handler there was before (the buttons page's)
      if (this.globalData && this.globalData.onIncomingFile === this.fileHandler) {
        this.globalData.onIncomingFile = this.prevFileHandler || null
      }
      stopAllLoaders()
      // Stop a poll still running, log out a session kept for later
      this.pollsCancelled = true
      if (this.pollTimers) { this.pollTimers.forEach((t) => clearTimeout(t)); this.pollTimers = null }
      cachedSessions().forEach((entry) => {
        if (entry && entry.token && entry.mode === 'expiry' && entry.session && entry.session.logout) {
          this.runLogout(entry.session, entry.token, entry.replacements)
        }
      })
      clearSessionCache()
    },
  })
)
