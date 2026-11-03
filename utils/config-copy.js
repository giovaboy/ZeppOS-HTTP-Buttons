// The watch's copy of the config, read by the buttons page, the shortcut card
// and the page the card opens (page/index.js, app-widget/index.js, page/run.js)
import { statSync, rmSync, readFileSync, writeFileSync } from '@zos/fs'
import { warnLog } from './remote-log.js'
import { errorText } from './memory.js'

// The watch's copy of the config (the JSON text the phone sent last): the
// buttons are drawn from it at once, while the phone is asked whether the
// config changed (asking took 1.8–3.5 s at every start). It holds what the
// config holds, credentials included, in the app's own data folder.
const CONFIG_COPY_FILE = 'config_copy.json'

export function readConfigCopy() {
  try {
    if (!statSync({ path: CONFIG_COPY_FILE })) return null
    return readFileSync({ path: CONFIG_COPY_FILE, options: { encoding: 'utf8' } }) || null
  } catch (e) {
    return null
  }
}

export function writeConfigCopy(text) {
  try {
    writeFileSync({ path: CONFIG_COPY_FILE, data: text, options: { encoding: 'utf8' } })
    return true
  } catch (e) {
    warnLog(`[cfg] the watch's copy of the config not written: ${errorText(e)}`)
    return false
  }
}

export function removeConfigCopy() {
  try { if (statSync({ path: CONFIG_COPY_FILE })) rmSync({ path: CONFIG_COPY_FILE }) } catch (e) { /* not there */ }
}
