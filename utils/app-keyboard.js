// The keyboard the app draws itself (widget.KEYBOARD), for watches without
// the system one (createKeyboard, API_LEVEL 4.0+; utils/keyboard.js). Used by
// the buttons page (page/index.[pf].layout.js) and by the page the shortcut
// card opens (page/run.js).
//
// `keys` are the screen's key layouts (page/keyboard.[pf].layout.js, through
// zosLoader in the page): { kb_lowercase, kb_uppercase, kb_numbers,
// kb_symbols, KEY_* }. `y` is where the screen the keyboard covers starts
// (the buttons page scrolls one page per screen height). `onOpen` / `onClose`
// run once, when it shows and when it goes (the buttons page locks its
// scrolling meanwhile). Send → onClose, then onSubmit(text); Cancel →
// onClose, then onCancel(). Never logs the text, only its length.
import { createWidget, deleteWidget, widget, prop, align, event } from '@zos/ui'
import { getDeviceInfo } from '@zos/device'
import { KB_TYPE_NUMERIC } from './constants.js'
import { getLogger } from './logger.js'

const logger = getLogger('http-buttons-keyboard')

export function openAppKeyboard({ keys, keyboardType, y = 0, onSubmit, onCancel, onOpen, onClose }) {
  const { width: W, height: H } = getDeviceInfo()
  const { kb_lowercase, kb_uppercase, kb_numbers, kb_symbols, KEY_SYMB, KEY_NUM, KEY_ABC, KEY_abc, KEY_SEND, KEY_CANCEL, KEY_BACKSPACE } = keys
  let text = ''
  let kb = null
  let bg = null
  let ids = null

  const close = () => {
    if (!kb) return false
    try { deleteWidget(kb) } catch (e) { /* gone */ }
    try { deleteWidget(bg) } catch (e) { /* gone */ }
    kb = bg = null
    if (typeof onClose === 'function') onClose()
    return true
  }

  // A layout replacing the one shown: keys moved, added or removed
  const applyLayout = (layout) => {
    const newIds = new Set(layout.map((k) => k.id))
    layout.forEach((key) => {
      if (ids.has(key.id)) {
        kb.setProperty(prop.KEY_PARA, { id: key.id, x: key.x, y: key.y, text: key.text, image: key.image, value: key.value })
      } else {
        kb.setProperty(prop.ADD_KEY, key)
      }
    })
    ids.forEach((old) => { if (!newIds.has(old)) kb.setProperty(prop.DEL_KEY, { id: old }) })
    ids = newIds
  }

  const onKeyPress = (k, id, value) => {
    switch (value) {
      case KEY_BACKSPACE:
        if (text.length > 0) {
          text = text.slice(0, -1)
          k.setProperty(prop.TEXT, text)
        }
        break
      case KEY_ABC: applyLayout(kb_uppercase); break
      case KEY_NUM: applyLayout(kb_numbers); break
      case KEY_SYMB: applyLayout(kb_symbols); break
      case KEY_abc: applyLayout(kb_lowercase); break
      case KEY_SEND: {
        const sent = text
        text = ''
        logger.debug('Text sent, chars:', String(sent).length)
        close()
        if (typeof onSubmit === 'function') onSubmit(sent)
        break
      }
      case KEY_CANCEL:
        text = ''
        close()
        if (typeof onCancel === 'function') onCancel()
        break
      default:
        text += String.fromCharCode(value)
        k.setProperty(prop.TEXT, text)
    }
  }

  const layout = keyboardType === KB_TYPE_NUMERIC ? kb_numbers : kb_lowercase
  if (typeof onOpen === 'function') onOpen()
  // Covering background. It takes the taps between the keys itself: a widget
  // without a listener lets them through to what is under it (a button of
  // the page; the card's page goes back on any tap)
  bg = createWidget(widget.FILL_RECT, { x: 0, y, w: W, h: H, color: 0x000000, alpha: 210 })
  bg.addEventListener(event.CLICK_DOWN, () => {})
  kb = createWidget(widget.KEYBOARD, { click_func: onKeyPress, key_attr: layout })
  kb.setProperty(prop.Y, y)
  kb.setProperty(prop.TEXT_STYLE, {
    x: 0, y: y + 100, // the text, above the keys
    w: W,
    align_h: align.CENTER,
    color: 0xffffff,
    show: 1,
  })
  kb.setProperty(prop.TEXT, text)
  ids = new Set(layout.map((k) => k.id))

  return { close }
}
