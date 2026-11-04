// A recording button's request (request.audio), on the phone: the watch sent
// its recording in parts (AUDIO_PART, app-side/audio-test.js keeps them), then
// asks for the request (AUDIO_REQUEST). The recording goes into an Ogg Opus
// file (app-side/ogg-opus.js) and the body is built as the button says:
//   multipart  the file in the form field `field` (recording.ogg, audio/ogg)
//   raw        the body is the file (Content-Type audio/ogg)
//   json       the button's body with {audio} replaced by the file in base64
//              (Content-Type application/json)
// A Content-Type set in the button's headers is kept (raw, json; multipart
// needs its own, with the boundary). The button's auth is applied here:
// Basic, Bearer, Digest (a first request without the body for the challenge).
// Bytes go as an ArrayBuffer, the only body the side fetch sends byte for
// byte (field-notes.md, "Audio").
//
// Answers as an ordinary request: { status, statusText, headers, body }, or
// { error }. Logged: method, address (scrubbed), the way, sizes, status,
// time. Never the headers, the body or the answer.
import { takeUpload } from './audio-test.js'
import { oggFromWatchOpus } from './ogg-opus.js'
import { bytesToBase64 } from '../utils/base64.js'
import { parseChallenge, buildDigestAuth, requestUri } from '../utils/digest.js'
import { urlForLog, authForLog } from '../utils/log-text.js'
import { sizeText } from './log.js'

const BOUNDARY = '----httpbuttons-audio-9c2e'

export async function audioRequest(params, log) {
  const p = params || {}
  const { id, url, timeout } = p
  // A recording is a body: GET and HEAD can't carry one (fetch refuses it,
  // servers ignore it). POST then
  let method = String(p.method || 'POST').trim().toUpperCase()
  if (method === 'GET' || method === 'HEAD') {
    log.info(`[audio] request: ${method} can't carry the recording: sent as POST`)
    method = 'POST'
  }
  const sendAs = ['multipart', 'raw', 'json'].includes(p.send_as) ? p.send_as : 'multipart'
  const field = (typeof p.field === 'string' && p.field.trim()) || 'file'
  if (!url || !/^https?:\/\//i.test(String(url))) return { error: 'No valid URL' }

  const up = takeUpload(id)
  if (up.error) return { error: up.error }
  if (p.size && up.bytes.length !== p.size) return { error: `Got ${up.bytes.length} B, the watch sent ${p.size}` }
  const w = oggFromWatchOpus(up.bytes)
  if (w.error) {
    log.info(`[audio] request: the recording is not in the watch's layout (${w.error})`)
    return { error: 'Recording not readable' }
  }
  const ogg = w.ogg

  // The headers as the button has them, names kept; the content type as
  // the way needs it
  const headers = {}
  const given = p.headers && typeof p.headers === 'object' ? p.headers : {}
  for (const k of Object.keys(given)) headers[k] = String(given[k])
  const hasType = Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')
  const setType = (t, force) => {
    if (force) for (const k of Object.keys(headers)) if (k.toLowerCase() === 'content-type') delete headers[k]
    if (force || !hasType) headers['Content-Type'] = t
  }

  let body
  if (sendAs === 'raw') {
    setType('audio/ogg')
    body = asBuffer(ogg)
  } else if (sendAs === 'json') {
    const template = typeof p.body === 'string' && p.body.indexOf('{audio}') !== -1 ? p.body : '{"audio":"{audio}"}'
    if (typeof p.body === 'string' && p.body.trim() && p.body.indexOf('{audio}') === -1) {
      log.info('[audio] request: the body has no {audio}: sent as {"audio":"…"}')
    }
    setType('application/json')
    body = template.split('{audio}').join(bytesToBase64(ogg))
  } else {
    setType(`multipart/form-data; boundary=${BOUNDARY}`, true)
    body = asBuffer(multipartFile(ogg, field))
  }

  const t0 = Date.now()
  const auth = p.auth
  try {
    if (auth === 'Basic' && p.user) headers['Authorization'] = 'Basic ' + bytesToBase64(utf8(`${p.user}:${p.pass || ''}`))
    else if (auth === 'Bearer' && p.token) headers['Authorization'] = 'Bearer ' + p.token
    else if (auth === 'Digest') {
      // The challenge from a first request without the recording
      const probe = await fetch({ url, method, headers: withoutType(headers), timeout })
      const wa = header(probe && probe.headers, 'www-authenticate')
      if (wa && /Digest/i.test(wa)) {
        headers['Authorization'] = buildDigestAuth({ username: p.user, password: p.pass, method, uri: requestUri(url), challenge: parseChallenge(wa) })
      } else {
        log.trace(`[audio] request: digest: no challenge from the probe (HTTP ${probe && probe.status}); sent without it`)
      }
    }
    const res = await fetch({ url, method, headers, body, timeout })
    const ms = Date.now() - t0
    const size = res && res.body != null ? (typeof res.body === 'string' ? res.body.length : JSON.stringify(res.body).length) : 0
    log.info(`[audio] request: ${method} ${urlForLog(url)} as ${sendAs}${sendAs === 'multipart' ? ` (field "${field}")` : ''}, Ogg ${sizeText(ogg.length)} (${w.ms} ms) auth=${authForLog(auth)} → HTTP ${res && res.status} in ${ms}ms, answer ${sizeText(size)}`)
    return { status: res && res.status, statusText: res && res.statusText, headers: plainHeaders(res && res.headers), body: res && res.body }
  } catch (e) {
    const ms = Date.now() - t0
    const text = (e && (e.message || (e.code !== undefined ? `code ${e.code}` : ''))) || String(e)
    log.info(`[audio] request: ${method} ${urlForLog(url)} as ${sendAs} failed after ${ms}ms: ${text}`)
    return { error: text }
  }
}

// multipart/form-data with the file alone
function multipartFile(bytes, field) {
  const head = `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${field.replace(/"/g, '')}"; filename="recording.ogg"\r\nContent-Type: audio/ogg\r\n\r\n`
  const tail = `\r\n--${BOUNDARY}--\r\n`
  const out = new Uint8Array(head.length + bytes.length + tail.length)
  for (let i = 0; i < head.length; i++) out[i] = head.charCodeAt(i) & 255
  out.set(bytes, head.length)
  for (let i = 0; i < tail.length; i++) out[head.length + bytes.length + i] = tail.charCodeAt(i)
  return out
}

const asBuffer = (u8) => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.length)

// A text's UTF-8 bytes
function utf8(s) {
  const bin = unescape(encodeURIComponent(String(s)))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function withoutType(h) {
  const out = {}
  for (const k of Object.keys(h)) if (k.toLowerCase() !== 'content-type') out[k] = h[k]
  return out
}

function header(headers, name) {
  if (!headers) return undefined
  if (typeof headers.get === 'function') return headers.get(name)
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase())
  const v = key ? headers[key] : undefined
  return Array.isArray(v) ? v[0] : v
}

// The answer's headers as a plain object (they go back to the watch as JSON)
function plainHeaders(h) {
  if (!h) return {}
  if (typeof h.forEach === 'function' && typeof h.get === 'function') {
    const out = {}
    h.forEach((v, k) => { out[k] = v })
    return out
  }
  return typeof h === 'object' ? h : {}
}

export const _test = { multipartFile, utf8 }
