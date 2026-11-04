// Base64 for bytes, on the watch and on the phone (neither has btoa/atob).
// The audio experiment (utils/audio-test.js) moves the recording to the phone
// as base64 text over ZML messaging, and checks the echo of the test server.

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
let LOOKUP = null

// Bytes (Uint8Array) `from`…`to` → base64 text. Chunks cut at a multiple of
// 3 bytes join into one valid text
export function bytesToBase64(bytes, from = 0, to = bytes.length) {
  const out = []
  let i = from
  for (; i + 2 < to; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]
    out.push(CHARS[n >> 18] + CHARS[(n >> 12) & 63] + CHARS[(n >> 6) & 63] + CHARS[n & 63])
  }
  if (i < to) {
    const a = bytes[i]
    const b = i + 1 < to ? bytes[i + 1] : 0
    const n = (a << 16) | (b << 8)
    out.push(CHARS[n >> 18] + CHARS[(n >> 12) & 63] + (i + 1 < to ? CHARS[(n >> 6) & 63] : '=') + '=')
  }
  return out.join('')
}

// Base64 text → Uint8Array (characters outside the alphabet are skipped)
export function base64ToBytes(text) {
  if (!LOOKUP) {
    LOOKUP = {}
    for (let i = 0; i < CHARS.length; i++) LOOKUP[CHARS[i]] = i
    LOOKUP['-'] = 62
    LOOKUP['_'] = 63
  }
  const s = String(text || '')
  let len = 0
  for (let i = 0; i < s.length; i++) if (LOOKUP[s[i]] !== undefined) len++
  const out = new Uint8Array(Math.floor((len * 3) / 4))
  let acc = 0, bits = 0, o = 0
  for (let i = 0; i < s.length; i++) {
    const v = LOOKUP[s[i]]
    if (v === undefined) continue
    acc = (acc << 6) | v
    bits += 6
    if (bits >= 8) {
      bits -= 8
      if (o < out.length) out[o++] = (acc >> bits) & 255
    }
  }
  return o === out.length ? out : out.subarray(0, o)
}

// The first `n` bytes as hex, for a log line: "4f 67 67 53 …"
export function hexHead(bytes, n = 16) {
  const parts = []
  for (let i = 0; i < Math.min(n, bytes.length); i++) parts.push((bytes[i] < 16 ? '0' : '') + bytes[i].toString(16))
  return parts.join(' ')
}
