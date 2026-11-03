// The page the shortcut card opens for one button (app-widget/index.js): it
// shows the button, runs its request like the buttons page does
// (utils/button-request.js), shows the result and goes back to the card by
// itself (a tap goes back at once). The button is read from the watch's copy
// of the config: nothing to wait for before the press. Meanwhile the phone is
// asked for its config, to keep the copy (and so the card) up to date.
import { BasePage } from '@zeppos/zml/base-page'
import { createWidget, widget, align, text_style, prop } from '@zos/ui'
import { getDeviceInfo, SCREEN_SHAPE_ROUND } from '@zos/device'
import { back } from '@zos/router'
import { getText } from '@zos/i18n'
import { requestMethods, parseJSON, capText, cachedSessions, clearSessionCache } from '../utils/button-request.js'
import { readConfigCopy, writeConfigCopy } from '../utils/config-copy.js'
import { startLoader, stopAllLoaders, loadingStyle } from '../utils/button-loader.js'
import { isSystemKeyboardAvailable, openSystemKeyboard } from '../utils/keyboard.js'
import { cardAllowed } from '../utils/card.js'
import { BTN_RADIUS, COLOR_BLACK, COLOR_GRAY, COLOR_WHITE, NO_NOTIFICATION } from '../utils/constants.js'
import { infoLog, warnLog, devLog, LOG_TRACE } from '../utils/remote-log.js'
import { errorText } from '../utils/memory.js'

const { width: W, height: H, screenShape } = getDeviceInfo()
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
      this.closed = false
      this.closeTimer = null
      this.pollsCancelled = false
      this.pollTimers = null
      this.inFlight = 0
      this.shown = null
      this.state.config = null
    },

    build() {
      // Under everything: a black button the size of the screen, so a tap
      // anywhere goes back (texts and shapes on top are made not to take taps)
      createWidget(widget.BUTTON, {
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
      this.refreshCopy()
      if (!button) {
        warnLog(`[card] button ${w ? `p${w.p}r${w.r}b${w.b}` : '(no params)'} not in the watch's copy of the config`)
        return this.message(getText('run_missing'), true)
      }
      this.state.config = config
      this.label = 'card p' + w.p + 'r' + w.r + 'b' + w.b + (button.text ? ' ' + String(button.text).slice(0, 20) : '')
      this.drawButton(button, page)
      if (!cardAllowed(button)) return this.message(getText('run_in_app'), true)

      if (button.input) {
        if (!isSystemKeyboardAvailable()) return this.message(getText('run_keyboard_in_app'), true)
        // The typed text fires the button; a cancel goes back to the card
        return openSystemKeyboard(this, button, w.p, (text) => this.fire(button, text), () => this.close())
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
      this.status.setProperty(prop.TEXT, getText('run_sending'))
      startLoader(loadingStyle(this.state.config), this.rect, this.rect.back)
      let p
      try {
        p = this.executeButtonRequest(button.request, this.where.p, input, this.label)
      } catch (e) {
        p = Promise.reject(e)
      }
      Promise.resolve(p).then(() => this.finished(t0), (e) => {
        warnLog(`[card] ${this.label}: ${errorText(e)}`)
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
      stopAllLoaders()
      const s = this.shown
      if (LOG_TRACE) devLog(`[card] ${this.label}: done in ${Date.now() - t0}ms`)
      this.closeAfter(!s ? DONE_MS : (s.quiet ? DONE_MS : closeDelay(s.text, s.isError)))
    },

    // A message instead of a run (button missing, image button, no keyboard)
    message(text, isError) {
      this.showResult(text, 0, isError)
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
      if (this.closeTimer) { clearTimeout(this.closeTimer); this.closeTimer = null }
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
