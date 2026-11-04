// The page the shortcut card opens for one button (app-widget/index.js): it
// shows the button, runs its request like the buttons page does
// (utils/button-request.js), shows the result and goes back to the card by
// itself (a tap goes back at once). The button is read from the watch's copy
// of the config: nothing to wait for before the press. Once the result is
// shown the phone is asked for its config, to keep the copy (and so the card)
// up to date; asked before, it held up the press in the queue.
// An image button: the phone sends the picture as a file, which the app hands
// to the page registered in globalData.onIncomingFile (this one while it is
// open, the buttons page's handler put back after); it shows full screen until
// a tap, or IMAGE_STAY_MS.
import { BasePage } from '@zeppos/zml/base-page'
import { createWidget, widget, align, text_style, prop, event } from '@zos/ui'
import { rmSync } from '@zos/fs'
import { getDeviceInfo, SCREEN_SHAPE_ROUND } from '@zos/device'
import { back } from '@zos/router'
import { getText } from '@zos/i18n'
import { requestMethods, parseJSON, capText, cachedSessions, clearSessionCache } from '../utils/button-request.js'
import { readConfigCopy, writeConfigCopy } from '../utils/config-copy.js'
import { startLoader, stopAllLoaders, loadingStyle } from '../utils/button-loader.js'
import { isSystemKeyboardAvailable, openSystemKeyboard } from '../utils/keyboard.js'
import { openAppKeyboard } from '../utils/app-keyboard.js'
import { kb_lowercase, kb_uppercase, kb_numbers, kb_symbols, KEY_SYMB, KEY_NUM, KEY_ABC, KEY_abc, KEY_SEND, KEY_CANCEL, KEY_BACKSPACE } from 'zosLoader:./keyboard.[pf].layout.js'
import { cardAllowed } from '../utils/card.js'
import { runAudioTest, playLastRecording, stopAudioTest } from '../utils/audio-test.js'
import { playAudioFile, stopAudioPlay } from '../utils/audio-play.js'
import { BTN_RADIUS, COLOR_BLACK, COLOR_GRAY, COLOR_WHITE, NO_NOTIFICATION, SHOW_IMAGE } from '../utils/constants.js'
import { infoLog, warnLog, devLog, LOG_TRACE } from '../utils/remote-log.js'
import { errorText } from '../utils/memory.js'

const { width: W, height: H, screenShape } = getDeviceInfo()
// This screen's key layouts, for the keyboard the app draws
const KEYS = { kb_lowercase, kb_uppercase, kb_numbers, kb_symbols, KEY_SYMB, KEY_NUM, KEY_ABC, KEY_abc, KEY_SEND, KEY_CANCEL, KEY_BACKSPACE }
const ROUND = screenShape === SCREEN_SHAPE_ROUND

// The button, as on the buttons page, in the upper part of the screen
const BTN_W = Math.round(W * 0.7)
const BTN_H = Math.round(H * 0.24)
const BTN_X = Math.round((W - BTN_W) / 2)
const BTN_Y = Math.round(H * 0.17)
// The result under it (narrower on a round screen, whose bottom is narrower)
const TEXT_X = Math.round(W * (ROUND ? 0.14 : 0.08))
const TEXT_W = W - 2 * TEXT_X
const TEXT_Y = BTN_Y + BTN_H + 18
const TEXT_H = Math.round(H * (ROUND ? 0.84 : 0.92)) - TEXT_Y
const TEXT_SIZE = Math.round(W / 17)
const RESULT_MAX = 300           // characters shown (a few lines)
const COLOR_ERROR = 0xff5a5a
const COLOR_DIM = 0x9e9e9e

// How long the result stays before going back: a short "done", or a time
// that grows with the text (a tap goes back at once)
const DONE_MS = 1000
// A picture is looked at: it stays until a tap, at most this long
const IMAGE_STAY_MS = 30000
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
      this.bg = createWidget(widget.BUTTON, {
        x: 0, y: 0, w: W, h: H, text: '', radius: 0,
        normal_color: COLOR_BLACK, press_color: COLOR_BLACK,
        click_func: () => this.close()
      })
      this.status = this.passThrough(createWidget(widget.TEXT, {
        x: TEXT_X, y: TEXT_Y, w: TEXT_W, h: TEXT_H,
        color: COLOR_DIM, text_size: TEXT_SIZE,
        align_h: align.CENTER_H, align_v: align.TOP,
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
      this.drawButton(button, page)
      if (!cardAllowed(button)) return this.message(getText('run_in_app'), true)

      // EXPERIMENT (test mode): record and send, or play the last recording
      if (button.audio_test || button.audio_last) return this.runAudio(button)

      if (button.input) {
        // The typed text fires the button; a cancel goes back to the card
        if (isSystemKeyboardAvailable()) {
          return openSystemKeyboard(this, button, w.p, (text) => this.fire(button, text), () => this.close())
        }
        // No system keyboard (before API 4.0): the one the app draws, as on
        // the buttons page (utils/app-keyboard.js)
        if (LOG_TRACE) devLog(`${this.tag} ${this.label}: no system keyboard, the app's keyboard`)
        this.appKeyboard = openAppKeyboard({
          keys: KEYS, keyboardType: button.keyboard_type, y: 0,
          onSubmit: (text) => { this.appKeyboard = null; this.fire(button, text) },
          onCancel: () => { this.appKeyboard = null; this.close() },
        })
        return
      }
      this.fire(button, null)
    },

    // A text or shape on top of the background button must not take its taps
    passThrough(wd) {
      try { if (wd && typeof wd.setEnable === 'function') wd.setEnable(false) } catch (e) { /* older API */ }
      return wd
    },

    // The pressed button, with its colors, radius and text
    drawButton(button, page) {
      const radius = Math.min(button.radius != null ? Number(button.radius) : BTN_RADIUS, BTN_H / 2)
      this.passThrough(createWidget(widget.FILL_RECT, {
        x: BTN_X, y: BTN_Y, w: BTN_W, h: BTN_H, radius,
        color: button.back_color != null ? Number(button.back_color) : COLOR_GRAY
      }))
      this.passThrough(createWidget(widget.TEXT, {
        x: BTN_X + 8, y: BTN_Y, w: BTN_W - 16, h: BTN_H,
        color: button.text_color != null ? Number(button.text_color) : COLOR_WHITE,
        text_size: button.text_size || Math.round(W / 15),
        align_h: align.CENTER_H, align_v: align.CENTER_V,
        text_style: text_style.ELLIPSIS, text: button.text || ''
      }))
      this.rect = { x: BTN_X, y: BTN_Y, w: BTN_W, h: BTN_H, radius, back: button.back_color != null ? Number(button.back_color) : COLOR_GRAY }
    },

    fire(button, input) {
      const t0 = Date.now()
      this.isImage = Number(button.request && button.request.response_style) === SHOW_IMAGE
      this.status.setProperty(prop.TEXT, getText('run_sending'))
      startLoader(loadingStyle(this.state.config), this.rect, this.rect.back)
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
      const quiet = !isError && Number(style) === NO_NOTIFICATION
      this.shown = { text: quiet ? '✓' : capText(text).slice(0, RESULT_MAX), isError: !!isError, quiet }
      this.status.setProperty(prop.MORE, {
        text: this.shown.text,
        color: isError ? COLOR_ERROR : COLOR_WHITE,
        text_size: quiet ? TEXT_SIZE * 2 : TEXT_SIZE
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
      this.closeAfter(closeDelay(this.shown.text, true))
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
      if (button.audio_last) {
        if (!playLastRecording(this, p, this.label, () => {}, (why) => this.audioOver(why))) this.audioOver('nothing to play')
        return
      }
      runAudioTest(this, button, p, this.label, () => this.audioOver('recorded'))
    },

    // An audio file from the button's call (request.audio_play), as the phone
    // sent it: played, then removed
    playReceived(file, tIn) {
      this.imageShown = true // the media came: finished() and the wait leave it be
      this.clearImageSpinner()
      this.audio = true
      this.setBgEnabled(false)
      infoLog(`${this.tag} ${this.label}: audio received, ${Date.now() - tIn}ms after it started to arrive`)
      playAudioFile(this, file.filePath, { tag: '[play] ' + this.label, pageid: this.where.p, remove: true, label: this.buttonText, onEnd: (why) => this.audioOver(why) })
    },

    // The recording's result is shown, or playback is over: back after a
    // moment (at once after a tap that stopped it)
    audioOver(why) {
      if (this.destroyed) return
      this.setBgEnabled(true)
      stopAllLoaders()
      if (why === 'tap') return this.close()
      if (why === 'complete') return this.closeAfter(DONE_MS)
      const s = this.shown
      this.closeAfter(s ? closeDelay(s.text, s.isError) : DONE_MS)
    },

    setBgEnabled(on) {
      try { if (this.bg && typeof this.bg.setEnable === 'function') this.bg.setEnable(on) } catch (e) { /* older API */ }
    },

    // A message instead of a run (button missing, no keyboard)
    message(text, isError) {
      this.showResult(text, 0, isError)
      this.refreshCopy()
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
