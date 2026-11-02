// One press at a time per button. A tap on a busy button waits for the one
// running (up to MAX_WAITING_PRESSES, none lost below that) and fires as soon
// as it settles; the button's loading animation runs until the last one is
// done. Taps used to fire at once: a burst of 13 held 13 requests in flight
// (~10 KB each), answers slowed to 7 s and one failed on ZML's handshake.
import { startLoader, stopLoader, loadingStyle } from './button-loader.js'
import { MAX_WAITING_PRESSES } from './constants.js'
import { devLog, warnLog, LOG_TRACE } from './remote-log.js'
import { errorText } from './memory.js'

// `key` names the button (page, row, button); `rect`/`back` place and color
// its animation; `start(text, done)` fires the press and calls done() once it
// settled (an image press: once the picture is shown or failed).
export function pressButton(vm, key, { rect, back, label, start }, text) {
  const all = vm.pressStates || (vm.pressStates = {})
  const st = all[key] || (all[key] = { busy: false, waiting: [], loader: null })
  if (st.busy) {
    if (st.waiting.length >= MAX_WAITING_PRESSES) {
      warnLog(`[btn] ${label}: tap dropped, ${st.waiting.length} already waiting`)
      return
    }
    st.waiting.push(text)
    if (LOG_TRACE) devLog(`[btn] ${label}: tap queued, ${st.waiting.length} waiting`)
    return
  }
  st.busy = true
  st.loader = startLoader(loadingStyle(vm.state.config), rect, back)

  const run = (t) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      // The page is gone (onDestroy dropped the queues and the animations)
      if (vm.pressStates !== all) return
      if (st.waiting.length) return run(st.waiting.shift())
      stopLoader(st.loader)
      st.loader = null
      st.busy = false
    }
    try {
      start(t, done)
    } catch (e) {
      warnLog(`[btn] ${label}: press failed to start: ${errorText(e)}`)
      done()
    }
  }
  run(text)
}
