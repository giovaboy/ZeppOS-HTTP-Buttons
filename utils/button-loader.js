// The "request in flight" animation of a button, in one of three styles
// (config `loading_style`, chosen in the phone settings):
//   'border' (default) a short trail of dots running round the button's
//            rounded border, clockwise
//   'pulse'  the border drawn as a stroke that breathes (its width grows and
//            shrinks)
//   'corner' the old spinner in the button's top-right corner (it was cut off
//            on a top-right button of a round screen)
// Shared by both layouts. One interval drives every running animation and
// stops when none is left (and in stopAllLoaders, from the page's onDestroy).
// The corner spinner animates natively (IMG_ANIM) and needs no tick.
import { px } from '@zos/utils'
import { createWidget, deleteWidget, widget, prop, anim_status } from '@zos/ui'
import { COLOR_BLACK, COLOR_WHITE, LOADING_STYLE_BORDER, LOADING_STYLE_PULSE, LOADING_STYLE_CORNER } from './constants.js'

const TICK_MS = 40 // 25 frames per second

// Running border: dots of the trail, head first (radius, alpha)
const TRAIL = [[3, 255], [3, 225], [2, 190], [2, 155], [2, 120], [2, 85], [2, 55]]
const TRAIL_GAP = 5    // px between dots along the border
const BORDER_INSET = 4 // px from the button's edge to the dots' path
const LAP_MS = 1400    // one lap, whatever the button's size...
const MIN_SPEED = 0.12 // ...within 120..450 px/s
const MAX_SPEED = 0.45

// Pulsing border: stroke widths of one breath (~1 s), one every other tick
const PULSE_WIDTHS = [1, 2, 3, 4, 5, 5, 4, 3, 2, 1, 1, 1]

// Corner spinner (assets/spinner/spin_*.png, near-white on a dark disc)
const SPINNER_SIZE = 28
const SPINNER_MARGIN = 4

const running = new Set()
let ticker = null

// White on dark buttons, black on light ones (yellow, gold, white…)
export function contrastColor(back) {
  const c = Number(back) || 0
  const r = (c >> 16) & 0xff, g = (c >> 8) & 0xff, b = c & 0xff
  return (0.299 * r + 0.587 * g + 0.114 * b) > 160 ? COLOR_BLACK : COLOR_WHITE
}

// The point at distance `s` along the rounded rect (x, y, w, h, r),
// clockwise from the left end of the top side
function pointAt(p, s) {
  const { x, y, w, h, r } = p
  const sw = w - 2 * r, sh = h - 2 * r, arc = Math.PI * r / 2
  let t = ((s % p.perimeter) + p.perimeter) % p.perimeter
  const corner = (cx, cy, from) => {
    const a = from + t / r
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  }
  if (t < sw) return [x + r + t, y]; t -= sw
  if (t < arc) return corner(x + w - r, y + r, -Math.PI / 2); t -= arc
  if (t < sh) return [x + w, y + r + t]; t -= sh
  if (t < arc) return corner(x + w - r, y + h - r, 0); t -= arc
  if (t < sw) return [x + w - r - t, y + h]; t -= sw
  if (t < arc) return corner(x + r, y + h - r, Math.PI / 2); t -= arc
  if (t < sh) return [x, y + h - r - t]; t -= sh
  return corner(x + r, y + r, Math.PI)
}

function tick() {
  const now = Date.now()
  for (const l of running) {
    if (l.style === LOADING_STYLE_BORDER) {
      const head = (now - l.t0) * l.speed
      for (let i = 0; i < l.dots.length; i++) {
        const [cx, cy] = pointAt(l.path, head - i * TRAIL_GAP)
        l.dots[i].setProperty(prop.MORE, { center_x: px(Math.round(cx)), center_y: px(Math.round(cy)) })
      }
    } else if (l.style === LOADING_STYLE_PULSE) {
      // Every other tick (12.5 fps is plenty for a breath); the whole
      // geometry with it: there is no prop for line_width alone before the
      // API 4.0 setters
      l.frame++
      if (l.frame % 2) continue
      l.step = (l.step + 1) % PULSE_WIDTHS.length
      l.stroke.setProperty(prop.MORE, { ...l.geometry, line_width: px(PULSE_WIDTHS[l.step]) })
    }
  }
}

function ensureTicker() {
  if (!ticker && running.size) ticker = setInterval(tick, TICK_MS)
}

function dropTickerIfIdle() {
  if (ticker && !running.size) { clearInterval(ticker); ticker = null }
}

// Start the animation of a button: `rect` { x, y, w, h, radius } in screen
// coordinates (the page's offset included), `back` its background color.
// Returns a handle for stopLoader.
export function startLoader(style, rect, back) {
  const { x, y, w, h } = rect
  const color = contrastColor(back)

  if (style === LOADING_STYLE_CORNER) {
    const sx = x + w - SPINNER_SIZE - 6, sy = y + 6
    const bgSize = SPINNER_SIZE + SPINNER_MARGIN * 2
    const bg = createWidget(widget.FILL_RECT, {
      x: px(sx - SPINNER_MARGIN), y: px(sy - SPINNER_MARGIN), w: px(bgSize), h: px(bgSize),
      radius: px(bgSize / 2), color: COLOR_BLACK, alpha: 140,
    })
    const anim = createWidget(widget.IMG_ANIM, {
      anim_path: 'spinner', anim_prefix: 'spin', anim_ext: 'png', anim_fps: 12, anim_size: 10,
      repeat_count: 0, anim_status: anim_status.START, x: px(sx), y: px(sy),
    })
    return { style, widgets: [bg, anim] }
  }

  // The border radius, kept inside what the button can hold
  const radius = Math.max(0, Math.min(Number(rect.radius) || 0, w / 2, h / 2))

  if (style === LOADING_STYLE_PULSE) {
    const geometry = {
      x: px(x + 1), y: px(y + 1), w: px(w - 2), h: px(h - 2),
      radius: px(Math.max(0, radius - 1)), color,
    }
    const stroke = createWidget(widget.STROKE_RECT, { ...geometry, line_width: px(PULSE_WIDTHS[0]) })
    const l = { style, widgets: [stroke], stroke, geometry, step: 0, frame: 0 }
    running.add(l)
    ensureTicker()
    return l
  }

  // Running border (the default)
  const pw = Math.max(2, w - 2 * BORDER_INSET), ph = Math.max(2, h - 2 * BORDER_INSET)
  const pr = Math.max(1, Math.min(radius - BORDER_INSET, pw / 2, ph / 2))
  const path = { x: x + BORDER_INSET, y: y + BORDER_INSET, w: pw, h: ph, r: pr }
  path.perimeter = 2 * (pw - 2 * pr) + 2 * (ph - 2 * pr) + 2 * Math.PI * pr
  const speed = Math.min(Math.max(path.perimeter / LAP_MS, MIN_SPEED), MAX_SPEED)
  const dots = TRAIL.map(([r, alpha], i) => {
    const [cx, cy] = pointAt(path, -i * TRAIL_GAP)
    return createWidget(widget.CIRCLE, { center_x: px(Math.round(cx)), center_y: px(Math.round(cy)), radius: px(r), color, alpha })
  })
  const l = { style: LOADING_STYLE_BORDER, widgets: dots, dots, path, speed, t0: Date.now() }
  running.add(l)
  ensureTicker()
  return l
}

export function stopLoader(l) {
  if (!l) return
  running.delete(l)
  dropTickerIfIdle()
  for (const wd of l.widgets || []) {
    try { deleteWidget(wd) } catch (e) { /* already gone with the page */ }
  }
  l.widgets = []
}

// Page teardown: no tick may outlive the page
export function stopAllLoaders() {
  for (const l of Array.from(running)) stopLoader(l)
  if (ticker) { clearInterval(ticker); ticker = null }
}

export function loadingStyle(config) {
  const s = config && config.loading_style
  return (s === LOADING_STYLE_PULSE || s === LOADING_STYLE_CORNER) ? s : LOADING_STYLE_BORDER
}
