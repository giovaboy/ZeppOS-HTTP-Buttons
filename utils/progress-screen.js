// The full-screen progress page of the audio buttons (recording, loading,
// playback), drawn as the Zepp OS design guide's horizontal progress bar
// (docs.zepp.com designs/elements/progress), measured from its screens:
//   round (318 px drawn → 480): title at 0.14 of the height, the value (big)
//   at 0.34, the bar 76.7% of the width (x 0.116–0.884), top at 0.45, 10/318
//   high, track #303030 / fill #FFFFFF; the note 36 px below it, light grey,
//   up to 2 lines; a "Stop" band at the bottom (from 0.80), #333333
//   square (259 × 298 → 390 × 450): the bar 87.6% of the width (x 0.062–
//   0.938), top at 0.41; "Stop" a capsule (y 0.79–0.96)
// The track is #333333 (the guide's grey, color_sys_item; greys 1–46 are to
// be avoided). Text sizes as measured: value 48, title 40, note 34, Stop 36.
// Only "Stop" takes a tap (onStop); the rest of the screen swallows taps (a
// widget without a listener lets them through to what is under it).
// `dot`: a red dot left of the title, blinking (a recording's "● REC").
import { createWidget, widget, prop, align, text_style, event, getTextLayout } from '@zos/ui'
import { getDeviceInfo, SCREEN_SHAPE_ROUND } from '@zos/device'

const COLOR_BLACK = 0x000000
const COLOR_WHITE = 0xffffff
const COLOR_NOTE = 0xdddddd
const COLOR_TRACK = 0x333333
const COLOR_STOP = 0x333333
const COLOR_DOT = 0xff3b30
// The dot's blink: on, then off, this long each
const BLINK_MS = 600

export function progressScreen({ title = '', titleColor = COLOR_WHITE, value = '', note = '', stop = '', onStop = null, dot = false } = {}) {
  const { width: W, height: H, screenShape } = getDeviceInfo()
  const round = screenShape === SCREEN_SHAPE_ROUND
  const widgets = []
  const add = (type, o) => { const w = createWidget(type, o); widgets.push(w); return w }
  const L = round
    ? { titleY: 0.10, titleH: 0.08, valueY: 0.29, valueH: 0.10, barX: 0.116, barW: 0.768, barY: 0.45, noteY: 0.54, noteH: 0.22, stopY: 0.80 }
    : { titleY: 0.07, titleH: 0.08, valueY: 0.24, valueH: 0.10, barX: 0.062, barW: 0.876, barY: 0.41, noteY: 0.49, noteH: 0.22, stopY: 0.79 }
  const barH = Math.max(6, Math.round(H * (round ? 10 / 318 : 10 / 298)))
  const bar = { x: Math.round(W * L.barX), y: Math.round(H * L.barY), w: Math.round(W * L.barW), h: barH, radius: Math.floor(barH / 2) }

  const back = add(widget.FILL_RECT, { x: 0, y: 0, w: W, h: H, color: COLOR_BLACK })
  back.addEventListener(event.CLICK_DOWN, () => {})
  const text = (o) => add(widget.TEXT, { x: 0, w: W, align_h: align.CENTER_H, align_v: align.CENTER_V, ...o })
  const titleW = Math.round(W * (round ? 0.64 : 0.84))
  // The dot (a recording): left of the title, the two centred together, the
  // title drawn where it goes (no move after: a TEXT's MORE resets it)
  const titleY = Math.round(H * L.titleY), titleH = Math.round(H * L.titleH)
  let titleBox = { x: Math.round((W - titleW) / 2), w: titleW, align_h: align.CENTER_H }
  let dotWidget = null, blinkTimer = null
  if (dot) {
    let tw = 0
    try { tw = (getTextLayout(title, { text_size: 40, text_width: 0, wrapped: 0 }) || {}).width || 0 } catch (e) { tw = 0 }
    if (!(tw > 0)) tw = Math.round(String(title).length * 24)
    const d = 26, gap = 14, left = Math.round((W - (d + gap + tw)) / 2)
    dotWidget = add(widget.FILL_RECT, { x: left, y: Math.round(titleY + titleH / 2 - d / 2), w: d, h: d, radius: d / 2, color: COLOR_DOT })
    titleBox = { x: left + d + gap, w: tw + 6, align_h: align.LEFT }
    let on = true
    blinkTimer = setInterval(() => { on = !on; dotWidget.setProperty(prop.VISIBLE, on) }, BLINK_MS)
  }
  const titleText = text({ ...titleBox, y: titleY, h: titleH, text: title, text_size: 40, color: titleColor, text_style: text_style.ELLIPSIS })
  const stopBlink = (show = false) => {
    if (blinkTimer) { clearInterval(blinkTimer); blinkTimer = null }
    if (dotWidget) dotWidget.setProperty(prop.VISIBLE, !!show)
  }
  const valueText = text({ y: Math.round(H * L.valueY), h: Math.round(H * L.valueH), text: value, text_size: 48, color: COLOR_WHITE, text_style: text_style.NONE })
  add(widget.FILL_RECT, { ...bar, color: COLOR_TRACK })
  const fill = add(widget.FILL_RECT, { ...bar, w: bar.h, color: COLOR_WHITE })
  fill.setProperty(prop.VISIBLE, false)
  const noteW = Math.round(W * (round ? 0.8 : 0.88))
  const noteText = text({ x: Math.round((W - noteW) / 2), w: noteW, y: Math.round(H * L.noteY), h: Math.round(H * L.noteH),
    text: note, text_size: 34, color: COLOR_NOTE, align_v: align.TOP, text_style: text_style.WRAP })

  // "Stop": a band at the bottom of a round screen, a capsule on a square one
  const stopTop = Math.round(H * L.stopY)
  const stopBox = round
    ? { x: 0, y: stopTop, w: W, h: H - stopTop, radius: 0 }
    : { x: bar.x, y: stopTop, w: bar.w, h: Math.round(H * 0.17), radius: Math.round(H * 0.085) }
  const stopBack = add(widget.FILL_RECT, { ...stopBox, color: COLOR_STOP })
  const stopText = text({ x: stopBox.x, w: stopBox.w, y: stopBox.y, h: round ? Math.round((H - stopTop) * 0.8) : stopBox.h,
    text: stop, text_size: 36, color: COLOR_WHITE, text_style: text_style.NONE })
  const showStop = (on) => { stopBack.setProperty(prop.VISIBLE, !!on); stopText.setProperty(prop.VISIBLE, !!on) }
  showStop(!!stop)

  // Stop: only its band (or capsule) and its label
  if (typeof onStop === 'function') { stopBack.addEventListener(event.CLICK_DOWN, onStop); stopText.addEventListener(event.CLICK_DOWN, onStop) }

  let lastFill = -1
  return {
    widgets,
    stopBlink,
    setTitle: (t) => titleText.setProperty(prop.TEXT, t),
    setValue: (t) => valueText.setProperty(prop.TEXT, t),
    setNote: (t) => noteText.setProperty(prop.TEXT, t),
    setStop: (label) => { if (label) stopText.setProperty(prop.TEXT, label); showStop(!!label) },
    // 0–1 of the bar; null: empty
    setProgress: (f) => {
      if (f == null || !(f > 0)) { if (lastFill !== 0) fill.setProperty(prop.VISIBLE, false); lastFill = 0; return }
      const w = Math.max(bar.h, Math.round(bar.w * Math.min(1, f)))
      if (w === lastFill) return
      lastFill = w
      fill.setProperty(prop.MORE, { x: bar.x, y: bar.y, w, h: bar.h, radius: bar.radius })
      fill.setProperty(prop.VISIBLE, true)
    },
  }
}
