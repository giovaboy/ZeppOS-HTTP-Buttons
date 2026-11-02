// The app's memory, for trace lines (getPerformance, API 4.0; this app is
// compatible down to 3.0, where the export is missing: '' then). The limit an
// app meets is the system's memory, not a share per app (field-notes.md,
// "Memory").
import { getPerformance } from '@zos/app'

// app.json appId: the app's entry in the list of running apps
const APP_ID = 1045755
const KB = (n) => Math.round((n || 0) / 1024)

// An error's text for a log line: QuickJS throws null when it can't even make
// the error (out of memory)
export function errorText(e) {
  if (e === null) return 'null (the JS ran out of memory)'
  if (e === undefined) return 'undefined'
  if (typeof e === 'string') return e
  if (e.message) return e.message
  if (e.status) return 'HTTP ' + e.status
  try { return JSON.stringify(e).slice(0, 200) } catch (x) { return String(e) }
}

// "mem 312 KB (peak 480), system 3100/5120 KB", or '' when not available
export function memoryUsage() {
  try {
    if (typeof getPerformance !== 'function') return ''
    const memory = getPerformance('memory')
    const m = memory && memory.memory
    if (!m) return ''
    const apps = m.app || []
    const app = apps.find((a) => Number(a.appid) === APP_ID) || (apps.length === 1 ? apps[0] : null)
    let line = app ? `mem ${KB(app.used)} KB (peak ${KB(app.peak)})` : `mem: app not listed`
    if (m.system) line += `, system ${KB(m.system.used)}/${KB(m.system.total)} KB`
    return line
  } catch (e) {
    return `mem: ${errorText(e)}`
  }
}

// Size of a text for a log line: "812 B", "3.2 KB"
export function sizeText(chars) {
  if (!(chars >= 0)) return '? B'
  return chars < 1024 ? `${chars} B` : `${(chars / 1024).toFixed(1)} KB`
}
