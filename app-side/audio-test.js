// EXPERIMENT (test mode only): the phone's half of the audio test
// (utils/audio-test.js). The watch sends its recording as base64 parts; this
// rebuilds the bytes and POSTs them in each standard way a service takes
// audio, to an echo server (the test suite's https://httpbin.io/anything),
// then checks what the server got against what was sent:
//   raw   the bytes are the body (Content-Type audio/ogg)
//   multi multipart/form-data: a text field and the file
//   json  base64 inside a JSON body
// The raw and multipart bodies go as a Uint8Array and as an ArrayBuffer (the
// side fetch documents string bodies only: does it take bytes?), and the raw
// one also as a "binary string" (one char per byte: does fetch keep it?).
//
// How the echo is checked: a raw body comes back as a data: URL in base64,
// compared byte by byte. A multipart file comes back as text, its bytes that
// aren't UTF-8 replaced by U+FFFD: the same is done to the sent bytes and the
// two texts compared, with the Content-Length the server got and the text
// field. That shows the server parsed the form; the bytes themselves are
// proven by the raw test with the same body type (Uint8Array, ArrayBuffer).
// Logged: sizes, times, statuses, verdicts. Never the audio.
import { base64ToBytes, bytesToBase64, hexHead } from '../utils/base64.js'

const FETCH_TIMEOUT_MS = 20000
const BOUNDARY = '----httpbuttons-audio-test-7f3a'

let upload = null

// One part of the recording. A new id starts a new upload
export function audioPart(params) {
  const { id, i, n, data } = params || {}
  if (!id || !(n > 0) || !(i >= 0 && i < n) || typeof data !== 'string') return { ok: false, error: 'bad part' }
  if (!upload || upload.id !== id) upload = { id, n, parts: new Array(n), t0: Date.now() }
  upload.parts[i] = data
  return { ok: true }
}

// The tests, one after the other. Resolves { ok, allOk, summary } for the watch
export async function audioTests(params, log) {
  const { id, size, url, field = 'file', ogg } = params || {}
  const up = upload
  upload = null
  if (!up || up.id !== id) return { ok: false, error: 'No recording on the phone' }
  const missing = up.parts.findIndex((p) => typeof p !== 'string')
  if (missing !== -1) return { ok: false, error: `Part ${missing + 1}/${up.n} missing` }
  if (!url || !/^https?:\/\//i.test(String(url))) return { ok: false, error: 'No test URL' }

  const b64 = up.parts.join('')
  const bytes = base64ToBytes(b64)
  log.trace(`[audio] phone: ${up.n} parts joined, ${bytes.length} B (watch said ${size}), first bytes ${hexHead(bytes, 8)}`)
  if (bytes.length !== size) return { ok: false, error: `Got ${bytes.length} B, the watch sent ${size}` }

  const type = ogg ? 'audio/ogg' : 'application/octet-stream'
  const filename = ogg ? 'recording.ogg' : 'recording.opus'
  const multi = multipartBytes(bytes, field, filename, type)
  const asBuffer = (u8) => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.length)

  const tests = [
    { name: 'raw u8', mode: 'raw', type, body: () => bytes, sent: bytes.length },
    { name: 'raw ab', mode: 'raw', type, body: () => asBuffer(bytes), sent: bytes.length },
    { name: 'raw str', mode: 'raw', type, body: () => binaryString(bytes), sent: bytes.length, info: true },
    { name: 'multi u8', mode: 'multi', type: `multipart/form-data; boundary=${BOUNDARY}`, body: () => multi, sent: multi.length, bytesBy: 'raw u8' },
    { name: 'multi ab', mode: 'multi', type: `multipart/form-data; boundary=${BOUNDARY}`, body: () => asBuffer(multi), sent: multi.length, bytesBy: 'raw ab' },
    { name: 'b64 json', mode: 'json', type: 'application/json', body: () => JSON.stringify({ audio: b64, format: ogg ? 'ogg' : 'opus' }), sent: null },
  ]

  const results = []
  for (const t of tests) {
    const r = await runOne(t, url, bytes, b64, field, log)
    // The echo returns a multipart file as text, where a changed byte that
    // wasn't UTF-8 stays U+FFFD: the text check can't prove the bytes. fetch
    // sends a body of the same type the same way, multipart or not: the raw
    // test of that type proves them
    if (t.bytesBy && r.ok) {
      const by = results.find((x) => x.t.name === t.bytesBy)
      if (!by || !by.r.ok) {
        r.ok = false
        r.short = `bytes unproven (${t.bytesBy} ✗)`
        log.info(`[audio] ${t.name}: the server parsed it, but its bytes are unproven: ${t.bytesBy} did not arrive identical`)
      }
    }
    results.push({ t, r })
  }

  // A way works if one of its bodies arrived intact
  const works = (mode) => results.some(({ t, r }) => t.mode === mode && !t.info && r.ok)
  const modes = { raw: works('raw'), multi: works('multi'), json: works('json') }
  const allOk = modes.raw && modes.multi && modes.json
  log.info(`[audio] phone verdict: raw ${modes.raw ? 'works' : 'NO'}, multipart ${modes.multi ? 'works' : 'NO'}, base64 JSON ${modes.json ? 'works' : 'NO'}` +
    ` → ${allOk ? 'all three ways work' : 'not all ways work'}`)
  // "raw str" is not one of the ways: it only tells whether fetch keeps a
  // string's chars as bytes (·)
  const summary = results.map(({ t, r }) => `${t.info ? '·' : r.ok ? '✓' : '✗'} ${t.name}: ${r.short}`).join('\n')
  return { ok: true, allOk, summary }
}

async function runOne(t, url, bytes, b64, field, log) {
  const t0 = Date.now()
  let body
  try { body = t.body() } catch (e) { return fail(t, log, `body not built: ${errText(e)}`) }
  let res
  try {
    res = await fetch({ url, method: 'POST', headers: { 'Content-Type': t.type }, body, timeout: FETCH_TIMEOUT_MS })
  } catch (e) {
    return fail(t, log, `fetch failed after ${Date.now() - t0}ms: ${errText(e)}`, 'fetch failed')
  }
  const ms = Date.now() - t0
  const status = res && res.status
  let echo = res && res.body
  try { if (typeof echo === 'string') echo = JSON.parse(echo) } catch (e) { echo = null }
  if (!(status >= 200 && status < 300)) return fail(t, log, `HTTP ${status} in ${ms}ms`, `HTTP ${status}`)
  if (!echo || typeof echo !== 'object') return fail(t, log, `HTTP ${status} in ${ms}ms, echo not JSON (${typeof (res && res.body)})`, 'no echo')

  const got = Number(header(echo.headers, 'Content-Length'))
  const gotType = String(header(echo.headers, 'Content-Type') || '')
  const sizes = `sent ${t.sent === null ? '?' : t.sent} B, server got ${got >= 0 ? got : '?'} B`
  let check
  if (t.mode === 'raw') check = checkData(echo.data, bytes)
  else if (t.mode === 'multi') check = checkFile(echo, field, bytes, got, t.sent)
  else check = (echo.json && echo.json.audio === b64) ? { ok: true, what: 'JSON field identical' } : { ok: false, what: `JSON field ${echo.json ? 'differs' : 'missing'}` }

  const line = `[audio] ${t.name}: HTTP ${status} in ${ms}ms, ${sizes}, type ${gotType.split(';')[0] || '?'}; ${check.what}`
  if (check.ok) log.trace(line)
  else log.info(line)
  // A string grown by about half: fetch sent it as UTF-8 (chars 128–255 → 2 bytes)
  if (t.info && !check.ok && got > t.sent) check.short = `sent as UTF-8 (${got}/${t.sent} B)`
  return { ok: check.ok, short: check.ok ? `ok ${ms}ms` : check.short || check.what }
}

function fail(t, log, why, short) {
  log.info(`[audio] ${t.name}: ${why}`)
  return { ok: false, short: short || why }
}

// A raw body's echo: "data:<type>;base64,<base64url>", or text
function checkData(data, bytes) {
  if (typeof data !== 'string') return { ok: false, what: 'no data in the echo', short: 'no data' }
  const m = /^data:[^,]*;base64,/.exec(data)
  if (!m) return { ok: false, what: `echoed as text, ${data.length} chars${printableHead(data)}`, short: 'as text' }
  const got = base64ToBytes(data.slice(m[0].length))
  return compareBytes(got, bytes)
}

function compareBytes(got, bytes) {
  if (got.length !== bytes.length) {
    return { ok: false, what: `${got.length} B came back, not ${bytes.length}${printableHead(String.fromCharCode.apply(null, Array.from(got.subarray(0, 24))))}`, short: `size ${got.length}/${bytes.length}` }
  }
  for (let i = 0; i < bytes.length; i++) {
    if (got[i] !== bytes[i]) return { ok: false, what: `bytes differ from #${i}`, short: `differs @${i}` }
  }
  return { ok: true, what: 'bytes identical' }
}

// A multipart file's echo: text, with the bytes that aren't UTF-8 replaced
function checkFile(echo, field, bytes, got, sent) {
  const f = echo.files && echo.files[field]
  const text = Array.isArray(f) ? f[0] : f
  if (typeof text !== 'string') return { ok: false, what: `no file "${field}" in the echo (fields: ${Object.keys(echo.files || {}).join(',') || 'none'})`, short: 'no file' }
  const formOk = !!(echo.form && [].concat(echo.form.format || [])[0])
  if (got >= 0 && got !== sent) return { ok: false, what: `body size differs; file ${text.length} chars; text field ${formOk ? 'ok' : 'missing'}`, short: `size ${got}/${sent}` }
  const same = text === lossyUtf8(bytes)
  if (!same) return { ok: false, what: `file differs (text check, ${text.length} chars); text field ${formOk ? 'ok' : 'missing'}`, short: 'file differs' }
  return { ok: formOk, what: `file identical (text check, same size); text field ${formOk ? 'ok' : 'missing'}`, short: formOk ? 'ok' : 'no text field' }
}

// multipart/form-data with a text field and the file
function multipartBytes(bytes, field, filename, type) {
  const head = `--${BOUNDARY}\r\nContent-Disposition: form-data; name="format"\r\n\r\n${type === 'audio/ogg' ? 'ogg' : 'opus'}\r\n` +
    `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\nContent-Type: ${type}\r\n\r\n`
  const tail = `\r\n--${BOUNDARY}--\r\n`
  const out = new Uint8Array(head.length + bytes.length + tail.length)
  for (let i = 0; i < head.length; i++) out[i] = head.charCodeAt(i)
  out.set(bytes, head.length)
  for (let i = 0; i < tail.length; i++) out[head.length + bytes.length + i] = tail.charCodeAt(i)
  return out
}

// One char per byte (0–255)
function binaryString(bytes) {
  let s = ''
  for (let i = 0; i < bytes.length; i += 4096) s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 4096)))
  return s
}

// The bytes as UTF-8 text, each byte that isn't part of a valid sequence
// replaced by U+FFFD: what the echo server does to a file it returns as text
function lossyUtf8(b) {
  const out = []
  const cont = (i, lo = 0x80, hi = 0xbf) => i < b.length && b[i] >= lo && b[i] <= hi
  let i = 0
  while (i < b.length) {
    const c = b[i]
    if (c < 0x80) { out.push(c); i++; continue }
    let cp = -1, w = 1
    if (c >= 0xc2 && c <= 0xdf && cont(i + 1)) { cp = ((c & 31) << 6) | (b[i + 1] & 63); w = 2 }
    else if (c >= 0xe0 && c <= 0xef) {
      const lo = c === 0xe0 ? 0xa0 : 0x80, hi = c === 0xed ? 0x9f : 0xbf
      if (cont(i + 1, lo, hi) && cont(i + 2)) { cp = ((c & 15) << 12) | ((b[i + 1] & 63) << 6) | (b[i + 2] & 63); w = 3 }
    } else if (c >= 0xf0 && c <= 0xf4) {
      const lo = c === 0xf0 ? 0x90 : 0x80, hi = c === 0xf4 ? 0x8f : 0xbf
      if (cont(i + 1, lo, hi) && cont(i + 2) && cont(i + 3)) { cp = ((c & 7) << 18) | ((b[i + 1] & 63) << 12) | ((b[i + 2] & 63) << 6) | (b[i + 3] & 63); w = 4 }
    }
    if (cp < 0) { out.push(0xfffd); i++; continue }
    if (cp > 0xffff) { cp -= 0x10000; out.push(0xd800 + (cp >> 10), 0xdc00 + (cp & 1023)) } else out.push(cp)
    i += w
  }
  let s = ''
  for (let k = 0; k < out.length; k += 4096) s += String.fromCharCode.apply(null, out.slice(k, k + 4096))
  return s
}

// A header of the echo (go-httpbin gives arrays of values)
function header(headers, name) {
  if (!headers) return undefined
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase())
  const v = key ? headers[key] : undefined
  return Array.isArray(v) ? v[0] : v
}

// When the echo is printable text, its start says what fetch sent instead of
// the bytes ("[object Uint8Array]", "{"0":79…"): our test audio, not a body of
// the user's
function printableHead(s) {
  const head = String(s).slice(0, 24)
  return /^[\x20-\x7e]+$/.test(head) ? `, starts "${head}"` : ''
}

function errText(e) {
  if (e === null || e === undefined) return String(e)
  if (typeof e === 'string') return e
  return e.message || (e.code !== undefined ? `code ${e.code}` : '') || String(e)
}

// For the module's own check (tests)
export const _test = { multipartBytes, lossyUtf8, binaryString, checkData, checkFile, bytesToBase64 }
