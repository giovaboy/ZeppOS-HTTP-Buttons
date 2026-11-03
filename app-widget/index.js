// Shortcut card (app widget): up to CARD_MAX buttons chosen in the phone
// settings ("Show on card"), with their colors. A tap opens page/run, which
// runs the button and comes back to the card. The buttons are read from the
// watch's copy of the config (written by the buttons page and page/run), so
// the card needs no phone to draw itself.
// Cards take taps only (no gestures, keys, scrolling or GROUP), take them on
// BUTTON widgets (texts and images don't), lay out from the screen edge (the
// system's margin), and run their timers late when woken: everything happens
// on the tap itself (field-notes.md, "Shortcut card").
import { createWidget, deleteWidget, widget, align, text_style, getAppWidgetSize, setAppWidgetSize } from '@zos/ui'
import { push } from '@zos/router'
import { px } from '@zos/utils'
import { getText } from '@zos/i18n'
import { readConfigCopy } from '../utils/config-copy.js'
import { cardButtons, runParams } from '../utils/card.js'
import { BTN_RADIUS, COLOR_GRAY, COLOR_WHITE, btnPressColor } from '../utils/constants.js'

const M = px(12)          // inside the card
const HEADER_H = px(44)   // the app's name: opens the app
const BTN_H = px(76)
const GAP = px(10)
const HINT_H = px(96)
const OPEN_H = px(56)
const SURFACE = 0x2a2a2a  // a control on the system's card

AppWidget({
  state: { widgets: [], copy: null },

  build() {
    this.draw()
  },

  // A card stays alive: the config may have changed since (a button chosen in
  // the settings, the app opened): drawn again when it did
  onResume() {
    if (readConfigCopy() !== this.state.copy) this.draw()
  },

  onDestroy() {
    this.clear()
  },

  clear() {
    for (const wd of this.state.widgets) {
      try { deleteWidget(wd) } catch (e) { /* gone already */ }
    }
    this.state.widgets = []
  },

  add(type, props) {
    const wd = createWidget(type, props)
    this.state.widgets.push(wd)
    return wd
  },

  draw() {
    this.clear()
    const copy = readConfigCopy()
    this.state.copy = copy
    let config = null
    try { config = copy ? JSON.parse(copy) : null } catch (e) { config = null }
    const shortcuts = cardButtons(config)

    const { w, margin } = getAppWidgetSize()
    const x0 = margin || 0
    const innerW = w - 2 * M

    // Header: the app's name, a tap opens the app
    this.add(widget.BUTTON, {
      x: x0 + M, y: M, w: innerW, h: HEADER_H, radius: Math.round(HEADER_H / 2),
      normal_color: SURFACE, press_color: btnPressColor(SURFACE, 1.4),
      color: COLOR_WHITE, text_size: px(24), text: 'HTTP-Buttons',
      click_func: () => push({ url: 'page/index' })
    })
    let y = M + HEADER_H + GAP

    if (!shortcuts.length) {
      // None chosen yet (or the app never opened: no copy of the config)
      this.add(widget.TEXT, {
        x: x0 + M, y, w: innerW, h: HINT_H,
        color: 0xb0b0b0, text_size: px(22),
        align_h: align.CENTER_H, align_v: align.CENTER_V,
        text_style: text_style.WRAP, text: getText(copy ? 'card_hint' : 'card_no_copy')
      })
      y += HINT_H + GAP
      this.add(widget.BUTTON, {
        x: x0 + M, y, w: innerW, h: OPEN_H, radius: Math.round(OPEN_H / 2),
        normal_color: 0x0884d0, press_color: btnPressColor(0x0884d0, 1.3),
        color: COLOR_WHITE, text_size: px(24), text: getText('card_open_app'),
        click_func: () => push({ url: 'page/index' })
      })
      y += OPEN_H
    } else {
      // Two per line (one alone takes the line), in the config's order
      const cols = shortcuts.length === 1 ? 1 : 2
      const cellW = Math.floor((innerW - GAP * (cols - 1)) / cols)
      shortcuts.forEach((s, i) => {
        const col = i % cols
        const line = Math.floor(i / cols)
        // The last one alone on its line takes the whole line
        const alone = cols === 2 && i === shortcuts.length - 1 && col === 0
        const bw = alone ? innerW : cellW
        const back = s.button.back_color != null ? Number(s.button.back_color) : COLOR_GRAY
        const radius = Math.min(s.button.radius != null ? Number(s.button.radius) : BTN_RADIUS, Math.round(BTN_H / 2))
        this.add(widget.BUTTON, {
          x: x0 + M + col * (cellW + GAP), y: y + line * (BTN_H + GAP), w: bw, h: BTN_H, radius,
          normal_color: back, press_color: btnPressColor(back, 1.3),
          color: s.button.text_color != null ? Number(s.button.text_color) : COLOR_WHITE,
          text_size: px(24), text: s.button.text || '',
          click_func: () => push({ url: 'page/run', params: runParams(s.p, s.r, s.b) })
        })
      })
      y += Math.ceil(shortcuts.length / cols) * (BTN_H + GAP) - GAP
    }
    setAppWidgetSize({ h: y + M })
  },
})
