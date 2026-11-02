import { BaseApp } from "@zeppos/zml/base-app"
import { writeFileSync, readFileSync, statSync, rmSync } from "@zos/fs"
import { log } from "@zos/utils"
import { logs } from "./config.js"

const logger = log.getLogger("http-buttons-app")

// Log levels of this build (config.js LOG_LEVEL), read once: app.js's own
// methods don't call module functions shared with the pages
// (field-notes.md, "app.js and undefined names")
const LOG_TRACE = logs('trace')
const LOG_INFO = logs('info')

// Watch lines waiting at most for the phone (the oldest are dropped)
const REMOTE_LOG_MAX = 100
// A batch unanswered this long is taken as lost: its lines go again
const REMOTE_LOG_LOST_MS = 90000
// Lines still waiting when the app closes: sent at the next start
const PENDING_LOG_FILE = 'pending_log.json'

App(
  BaseApp({
    globalData: {},
    onCreate(options) {
      this._loadPendingLog()
      this.remoteLog('app started')
    },

    onDestroy(options) {
      this._savePendingLog()
    },

    // ── Remote log ───────────────────────────────────────────
    // Watch lines sent to the phone's Logs box (settings page, [w] prefix):
    // shared rule ../_shared/zeppos-ai-doc/logging.md. Three levels: devLog
    // (trace: diagnostics), remoteLog (info: main events), warnLog (problems,
    // always). Pages reach them through utils/remote-log.js.

    remoteLog(msg) {
      if (LOG_INFO) this._sendLog(msg)
      else logger.log(msg)
    },

    warnLog(msg) {
      this._sendLog(msg)
    },

    devLog(msg) {
      if (LOG_TRACE) this._sendLog(msg)
      else logger.log(msg)
    },

    // Lines carry the watch time (its clock runs ~2 s behind the phone's).
    // If the phone can't be reached they wait (up to REMOTE_LOG_MAX) and go
    // with the next line.
    _sendLog(msg) {
      logger.log(`[remote] ${msg}`)
      const queue = this._remoteLog || (this._remoteLog = [])
      queue.push(`${new Date().toTimeString().slice(0, 8)} ${msg}`)
      if (queue.length > REMOTE_LOG_MAX) queue.splice(0, queue.length - REMOTE_LOG_MAX)
      this._flushRemoteLog()
    },

    // One batch at a time; a batch whose request never settles is taken as
    // lost after REMOTE_LOG_LOST_MS (checked on the next line: a timer would
    // die with the page that started it)
    _flushRemoteLog() {
      const sending = this._remoteLogSending
      if (sending && Date.now() - sending.at > REMOTE_LOG_LOST_MS) {
        this._remoteLog.unshift(...sending.lines)
        this._remoteLogSending = null
      }
      if (this._remoteLogSending || !this._remoteLog || !this._remoteLog.length) return
      const lines = this._remoteLog.splice(0)
      const batch = { lines, at: Date.now() }
      this._remoteLogSending = batch
      let sent
      try { sent = this.request({ method: 'debug.deviceLog', params: { lines } }) } catch (e) { sent = Promise.reject(e) }
      Promise.resolve(sent).then(
        () => { if (this._remoteLogSending === batch) { this._remoteLogSending = null; this._flushRemoteLog() } },
        () => { if (this._remoteLogSending === batch) { this._remoteLogSending = null; this._remoteLog.unshift(...lines) } },
      )
    },

    // The lines not confirmed by the phone (waiting, or in a batch still
    // unanswered: those may show twice) go to a small file at close...
    _savePendingLog() {
      try {
        const lines = [].concat(this._remoteLogSending ? this._remoteLogSending.lines : [], this._remoteLog || [])
        if (!lines.length) return
        writeFileSync({
          path: PENDING_LOG_FILE,
          data: JSON.stringify(lines.slice(-REMOTE_LOG_MAX)),
          options: { encoding: 'utf8' },
        })
      } catch (e) { /* never throw from the logger */ }
    },

    // ...and are queued again at the next start, marked as from before
    _loadPendingLog() {
      try {
        if (!statSync({ path: PENDING_LOG_FILE })) return
        const text = readFileSync({ path: PENDING_LOG_FILE, options: { encoding: 'utf8' } })
        rmSync({ path: PENDING_LOG_FILE })
        const lines = JSON.parse(text || '[]')
        if (Array.isArray(lines) && lines.length) {
          this._remoteLog = lines.map((l) => `${l} (from the last run)`).slice(-REMOTE_LOG_MAX)
        }
      } catch (e) { /* never throw from the logger */ }
    },
  })
);
