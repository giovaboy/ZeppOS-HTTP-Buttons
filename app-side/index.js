import { BaseSideService, settingsLib } from '@zeppos/zml/base-side'
import { DEFAULT_DATA, TEST_DATA, DEFAULT_REQUEST_TIMEOUT_MS } from '../utils/constants.js'
import { parseChallenge, buildDigestAuth, requestUri } from '../utils/digest.js'
import { logs, logsPrivate, logsEnabled } from '../config.js'
import { LOG_KEY, LOG_MAX, scrubLog, configSecrets, sizeText } from './log.js'
import { urlForLog, authForLog } from '../utils/log-text.js'

// Where the downloaded snapshot is stored on the phone side before conversion.
// One fixed name is enough: requests are one-shot and never run in parallel
// (and the side service can't delete files: a name per image would pile up).
// Only the file name: ZML's downloader adds the folder itself, so the old
// 'data://download/…' landed in data://download/download/ (seen in the Logs
// box; field-notes.md, "Messaging"). The real path is read from the event.
const IMAGE_DOWNLOAD_NAME = 'httpbtn_snapshot.png'
const IMAGE_DOWNLOAD_PATH = 'data://download/' + IMAGE_DOWNLOAD_NAME

// ── Logs box ──────────────────────────────────────────────────
// Three levels (config.js LOG_LEVEL): vlog (trace: diagnostics), plog (info:
// the main events), wlog (problems, always). The watch's [w] lines come already
// filtered by the watch. Every line is scrubbed (app-side/log.js): the
// config's secrets, credentials by their shape, and addresses unless DEV.

// The secrets of the config the watch reads, worked out again only when it
// changes
let secretsOf = null
let secrets = []
function currentSecrets() {
  const raw = getData() || ''
  if (raw !== secretsOf) {
    secretsOf = raw
    try { secrets = configSecrets(raw) } catch (e) { secrets = [] }
  }
  return secrets
}

// One write of the store for all of `msgs` (a batch of watch lines rewrote the
// whole 200-line store once per line otherwise)
// The watch marks the lines it saved at close and sends again at its next
// start; the batch it was sending at close has usually arrived already
const FROM_LAST_RUN = ' (from the last run)'

function writeLines(msgs) {
  try {
    // Public releases (LOG_LEVEL 'off'): nothing is stored
    if (!msgs.length || !logsEnabled()) return
    const now = new Date()
    const ts = `${now.toTimeString().slice(0, 8)}.${String(now.getMilliseconds()).padStart(3, '0')}`
    const s = currentSecrets()
    const raw = settingsLib.getItem(LOG_KEY)
    const lines = raw ? JSON.parse(raw) : []
    // What is stored, without the phone's time, to skip a line from the last
    // run that already arrived (no duplicates, no line lost)
    let seen = null
    for (const msg of msgs) {
      if (msg.endsWith(FROM_LAST_RUN)) {
        if (!seen) seen = new Set(lines.map((l) => l.slice(l.indexOf(' ') + 1)))
        if (seen.has(scrubLog(msg.slice(0, -FROM_LAST_RUN.length), s))) continue
      }
      const line = `${ts} ${scrubLog(msg, s)}`
      if (logsPrivate()) console.log(line)
      lines.push(line)
    }
    if (lines.length > LOG_MAX) lines.splice(0, lines.length - LOG_MAX)
    settingsLib.setItem(LOG_KEY, JSON.stringify(lines))
  } catch (e) { /* never throw from the logger */ }
}
const writeLog = (msg) => writeLines([msg])
const plog = (msg) => { if (logs('info')) writeLog(msg) }
const wlog = (msg) => { if (logs('warn')) writeLog(msg) }
const vlog = (msg) => { if (logs('trace')) writeLog(msg) }

function errorText(e) {
  if (e === null) return 'null (out of memory)'
  if (e === undefined) return 'undefined'
  if (typeof e === 'string') return e
  const parts = []
  if (e.code !== undefined) parts.push(`code ${e.code}`)
  if (e.message) parts.push(e.message)
  if (parts.length) return parts.join(' ')
  try { return JSON.stringify(e).slice(0, 200) } catch (x) { return String(e) }
}

// Field names of an object, to learn what a native callback hands over
const fieldsOf = (o) => (o && typeof o === 'object') ? Object.keys(o).join(',') : typeof o

// Minimal base64 for Basic auth (the side service has no btoa).
function encodeBase64(str) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let output = ''
  let i = 0
  while (i < str.length) {
    const c1 = str.charCodeAt(i++)
    const c2 = i < str.length ? str.charCodeAt(i++) : NaN
    const c3 = i < str.length ? str.charCodeAt(i++) : NaN
    const e1 = c1 >> 2
    const e2 = ((c1 & 3) << 4) | (isNaN(c2) ? 0 : c2 >> 4)
    const e3 = isNaN(c2) ? 64 : (((c2 & 15) << 2) | (isNaN(c3) ? 0 : c3 >> 6))
    const e4 = isNaN(c3) ? 64 : (c3 & 63)
    output += chars[e1] + chars[e2] + (e3 === 64 ? '=' : chars[e3]) + (e4 === 64 ? '=' : chars[e4])
  }
  return output
}

// Build the auth header for the image GET. Basic/Bearer are one-shot headers;
// Digest is handled separately (it needs a challenge round-trip, see below).
function buildImageAuthHeaders({ auth, user, pass, token }) {
  const headers = {}
  if (auth === 'Basic' && user) {
    headers['Authorization'] = 'Basic ' + encodeBase64(`${user}:${pass || ''}`)
  } else if (auth === 'Bearer' && token) {
    headers['Authorization'] = 'Bearer ' + token
  }
  return headers
}

// Download the image to the phone, convert it to a device-drawable format, then
// push it to the watch — all via the zml side-service helpers (this.download /
// this.convert / this.sendFile, registered by zml 0.0.41). convert accepts
// common raster formats (PNG, JPEG, …); a genuinely unsupported/corrupt file
// fails the .catch. `t0` is when the watch's request arrived, for the timings;
// `end` lets the next queued image start once this one's transfer is over.
function startImageDownload(ctx, url, reqHeaders, res, timeout, t0, end) {
  const tDl = Date.now()
  // Let the downloader pick the destination and tell us where it landed, rather
  // than forcing a custom path (convert was reporting the forced path as "not
  // found", so the file wasn't actually being written there).
  const task = ctx.download(url, {
    timeout,
    headers: reqHeaders,
    filePath: IMAGE_DOWNLOAD_NAME,
  })

  task.onFail = (e) => {
    wlog(`[img] download failed after ${Date.now() - tDl}ms: ${errorText(e)}`)
    res(null, { ok: false, error: `Download failed: ${e && e.message ? e.message : 'unknown'}` })
  }

  task.onSuccess = (event) => {
    const dlMs = Date.now() - tDl
    if (event && event.statusCode && (event.statusCode < 200 || event.statusCode >= 300)) {
      wlog(`[img] download: HTTP ${event.statusCode} in ${dlMs}ms`)
      res(null, { ok: false, error: `HTTP ${event.statusCode}` })
      return
    }

    const srcPath = (event && (event.filePath || event.tempFilePath)) || IMAGE_DOWNLOAD_PATH
    vlog(`[img] downloaded in ${dlMs}ms: HTTP ${event && event.statusCode}, at ${srcPath} (fields ${fieldsOf(event)})`)
    const tConv = Date.now()
    ctx.convert({ filePath: srcPath })
      .then((result) => {
        const target = result && result.targetFilePath
        // `options` is what convert worked with: it may tell how to ask for a
        // smaller image (the converted file is ~2 bytes per pixel, and the
        // transfer runs at ~70 KB/s)
        let opts = ''
        try { opts = JSON.stringify(result && result.options).slice(0, 200) } catch (e) { opts = String(e) }
        vlog(`[img] converted in ${Date.now() - tConv}ms → ${target}, options ${opts}`)
        // The image itself reaches the device over the transfer channel
        // (the page's onReceivedFile hook); here we just push it and ack.
        const tSend = Date.now()
        // Each send numbered, its start saying how the previous one ended:
        // transfers failing at once after a cancel or an error were seen in
        // zeppamp (field-notes.md, "File transfer")
        const seq = ++sendSeq
        vlog(`[img] #${seq} sending${lastSend ? `, previous #${lastSend.seq} ${lastSend.state} ${Date.now() - lastSend.at}ms ago` : ''}`)
        let file
        try {
          file = ctx.sendFile(target, { type: 'image', name: 'snapshot' })
        } catch (e) {
          wlog(`[img] not sent to the watch: ${errorText(e)}`)
          res(null, { ok: false, error: 'Image not sent' })
          return
        }
        if (file && typeof file.on === 'function') {
          // A transfer that never ends must not hold the queue: after
          // TRANSFER_GUARD_MS it is cancelled (a jammed transfer kept every
          // later image from reaching the watch, app restarts included)
          const guard = setTimeout(() => {
            wlog(`[img] #${seq} transfer not over after ${TRANSFER_GUARD_MS}ms (${file.readyState || '?'}), cancelling it`)
            lastSend = { seq, state: 'cancelled by the guard', at: Date.now() }
            try { if (typeof file.cancel === 'function') file.cancel() } catch (e) { wlog(`[img] cancel failed: ${errorText(e)}`) }
            end()
          }, TRANSFER_GUARD_MS)
          // Only the start and the end of a transfer say something on the
          // phone (field-notes.md, "File transfer"); the watch logs its side
          file.on('change', (e) => {
            const state = e && e.data && e.data.readyState
            if (state === 'error' || state === 'canceled') wlog(`[img] #${seq} transfer ${state} after ${Date.now() - tSend}ms`)
            else vlog(`[img] #${seq} transfer ${state} at ${Date.now() - tSend}ms${file.fileSize ? `, ${sizeText(file.fileSize)}` : ''}`)
            if (state === 'transferred' || state === 'error' || state === 'canceled') {
              lastSend = { seq, state, at: Date.now() }
              clearTimeout(guard)
              end()
            }
          })
        } else {
          end()
        }
        plog(`[img] ready in ${Date.now() - t0}ms (download ${dlMs}ms), sending it to the watch`)
        res(null, { ok: true })
      })
      .catch((err) => {
        wlog(`[img] convert failed after ${Date.now() - tConv}ms: ${errorText(err)}`)
        res(null, { ok: false, error: 'Image conversion failed' })
      })
  }
}

// Read a header whether res.headers is a plain object (zml/httpRequest style)
// or an MDN-style Headers object (raw side fetch). Header names are
// case-insensitive.
function readHeader(headers, name) {
  if (!headers) return undefined
  if (typeof headers.get === 'function') return headers.get(name)
  return headers[name] || headers[name.toLowerCase()] ||
    headers[name.replace(/\b\w/g, (c) => c.toUpperCase())]
}

// `timeout` arrives already resolved by the watch (button → global → default);
// the fallback only covers a request from an older page version.
function fetchConvertAndPush(ctx, { url, headers = {}, auth, user, pass, token, timeout = DEFAULT_REQUEST_TIMEOUT_MS }, res, end) {
  const t0 = Date.now()
  const baseHeaders = { ...(headers || {}) }
  plog(`[img] asked: GET ${urlForLog(url)} auth=${authForLog(auth)} timeout=${timeout}ms`)

  if (auth === 'Digest') {
    // The downloader can't do the 401 challenge round-trip itself, so we do it:
    // probe with fetch to read WWW-Authenticate, compute the Digest header
    // (reusing the device's digest helpers), then hand it to the downloader.
    fetch({ url, method: 'GET', timeout })
      .then((probe) => {
        const wa = readHeader(probe && probe.headers, 'www-authenticate')
        if (wa && /Digest/i.test(wa)) {
          vlog(`[img] digest challenge in ${Date.now() - t0}ms (HTTP ${probe && probe.status})`)
          const challenge = parseChallenge(wa)
          const uri = requestUri(url)
          const authHeader = buildDigestAuth({ username: user, password: pass, method: 'GET', uri, challenge })
          startImageDownload(ctx, url, { ...baseHeaders, Authorization: authHeader }, res, timeout, t0, end)
        } else {
          // No challenge surfaced (already open, or headers not exposed) — just
          // download; the downloader's statusCode reports the truth (e.g. 401).
          vlog(`[img] digest: no challenge from the probe (HTTP ${probe && probe.status}) in ${Date.now() - t0}ms`)
          startImageDownload(ctx, url, baseHeaders, res, timeout, t0, end)
        }
      })
      .catch((e) => {
        wlog(`[img] digest probe failed after ${Date.now() - t0}ms: ${errorText(e)}`)
        res(null, { ok: false, error: 'Digest auth probe failed' })
      })
    return
  }

  startImageDownload(ctx, url, { ...baseHeaders, ...buildImageAuthHeaders({ auth, user, pass, token }) }, res, timeout, t0, end)
}

// Images one at a time: each one downloads and converts into the same fixed
// file, and the file transfer queue jammed with three at once (two converted
// the third's download; after a transfer error no file reached the watch any
// more). The next image starts when this one failed or its transfer is over.
const TRANSFER_GUARD_MS = 60000
// The sends to the watch, numbered, and how the last one ended
let sendSeq = 0
let lastSend = null
let imageChain = Promise.resolve()
let imageJobs = 0
function queueImage(ctx, params, res) {
  imageJobs++
  if (imageJobs > 1) vlog(`[img] waits for the image before it (${imageJobs - 1} ahead)`)
  imageChain = imageChain.then(() => new Promise((finish) => {
    let finished = false
    const end = () => { if (!finished) { finished = true; finish() } }
    // A failure answer ends the job; a success waits for the transfer
    const reply = (err, r) => { res(err, r); if (!r || !r.ok) end() }
    try {
      fetchConvertAndPush(ctx, params, reply, end)
    } catch (e) {
      wlog(`[img] failed: ${errorText(e)}`)
      reply(null, { ok: false, error: 'Image failed on the phone' })
    }
  })).then(() => { imageJobs-- }, () => { imageJobs-- })
}

// One-time migration: earlier versions stored `data` as an array of configs;
// collapse it to the single object the app now expects.
function migrateDataIfNeeded() {
  const raw = settingsLib.getItem('data')
  if (!raw) return

  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      settingsLib.setItem('data', JSON.stringify(parsed[0] || DEFAULT_DATA))
      plog('[cfg] old config list collapsed to its first config')
    }
  } catch (e) {
    wlog(`[cfg] stored config is not valid JSON (${sizeText(raw.length)}): ${errorText(e)}`)
  }
}

function getData() {
  // Test mode: load the hardcoded test suite instead of the user's config.
  // The loading animation is a look, not part of the suite: the user's choice
  // applies in test mode too.
  if (settingsLib.getItem('test_mode') === 'true') {
    let style
    try { style = JSON.parse(settingsLib.getItem('data') || '{}').loading_style } catch (e) { style = undefined }
    return JSON.stringify(style ? { ...TEST_DATA, loading_style: style } : TEST_DATA);
  }
  return settingsLib.getItem('data');
}

AppSideService(
  BaseSideService({
    onInit() {
      // A release build after a test one: the lines it left are dropped (the
      // settings page has no box to show or clear them)
      if (!logsEnabled() && settingsLib.getItem(LOG_KEY)) settingsLib.removeItem(LOG_KEY)
      plog('phone service started')
      migrateDataIfNeeded()
    },
    onRequest(req, res) {
      const method = req && req.method
      try {
        if (method === 'GET_DATA') {
          const data = getData()
          const what = settingsLib.getItem('test_mode') === 'true' ? 'the test suite' : (data ? 'the config' : 'no config')
          vlog(`[cfg] GET_DATA: ${what}${data ? `, ${sizeText(data.length)}` : ''}`)
          res(null, {
            result: data
          })
        } else if (method === 'FETCH_IMAGE') {
          queueImage(this, req.params || {}, res)
        } else if (method === 'LOAD_DEFAULT') {
          // Only used from the watch's "Load example" prompt, shown when there is
          // no config at all — safe to write since there is nothing to overwrite.
          const d = JSON.stringify(DEFAULT_DATA)
          settingsLib.setItem('data', d)
          plog('[cfg] example config loaded from the watch')
          res(null, { result: d })
        } else if (method === 'debug.deviceLog') {
          // The watch's lines (app.js "Remote log"), already filtered by its level
          const params = req.params || {}
          writeLines([].concat(params.lines || []).map((line) => `[w] ${line}`))
          res(null, {})
        } else {
          wlog(`unknown request: ${method}`)
          res(null, { ok: false, error: 'unknown request' })
        }
      } catch (e) {
        wlog(`CRASH in onRequest ${method}: ${errorText(e)}`)
        res(null, { ok: false, error: 'phone error' })
      }
    },
    // Kept intentionally: removing this hook in the 1.6 cleanup appears to break
    // the side service init on device (page stuck on loading — GET_DATA never
    // answered). Config is pulled on demand via GET_DATA; here we only log.
    // Never log for LOG_KEY (our own writes) nor the settings page's ui_* keys.
    onSettingsChange({ key, newValue, oldValue }) {
      if (key === 'data') vlog(`[cfg] config changed in the settings: ${newValue ? sizeText(String(newValue).length) : 'removed'}`)
      else if (key === 'test_mode') plog(`[cfg] test mode ${newValue === 'true' ? 'on' : 'off'}`)
    },
    onRun() {},
    onDestroy() {}
  })
)
