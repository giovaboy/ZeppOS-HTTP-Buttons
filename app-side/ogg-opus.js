// EXPERIMENT (test mode): the watch's recording as an Ogg Opus file (RFC 7845),
// the form services take as audio/ogg. The watch writes raw Opus packets,
// each after its length (4 bytes, big endian) and 4 more bytes
// (utils/opus-frames.js; confirmed on a Cheetah 2 Ultra: SILK wideband 60 ms
// mono, the whole file reads so). Here they go into Ogg pages: the OpusHead
// and OpusTags headers, then the audio, each page with its granule position
// (48 kHz samples up to its last packet) and its CRC.
import { parseOpusFrames, packetSamples48 } from '../utils/opus-frames.js'

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let r = i << 24
    for (let k = 0; k < 8; k++) r = (r & 0x80000000) ? ((r << 1) ^ 0x04c11db7) : (r << 1)
    t[i] = r >>> 0
  }
  return t
})()

function crc32(bytes) {
  let crc = 0
  for (let i = 0; i < bytes.length; i++) crc = ((crc << 8) ^ CRC_TABLE[((crc >>> 24) ^ bytes[i]) & 255]) >>> 0
  return crc >>> 0
}

// One Ogg page holding whole packets (`packets`: Uint8Array views)
function page(packets, { granule, serial, seq, bos = false, eos = false }) {
  const lacing = []
  for (const p of packets) {
    let n = p.length
    while (n >= 255) { lacing.push(255); n -= 255 }
    lacing.push(n)
  }
  const bodyLen = packets.reduce((a, p) => a + p.length, 0)
  const out = new Uint8Array(27 + lacing.length + bodyLen)
  out.set([0x4f, 0x67, 0x67, 0x53, 0, (bos ? 2 : 0) | (eos ? 4 : 0)])
  // Granule position: 64 bits, little endian (fits in 53 bits here)
  let g = granule
  for (let i = 0; i < 8; i++) { out[6 + i] = g % 256; g = Math.floor(g / 256) }
  const u32 = (at, v) => { out[at] = v & 255; out[at + 1] = (v >>> 8) & 255; out[at + 2] = (v >>> 16) & 255; out[at + 3] = (v >>> 24) & 255 }
  u32(14, serial)
  u32(18, seq)
  out[26] = lacing.length
  out.set(lacing, 27)
  let o = 27 + lacing.length
  for (const p of packets) { out.set(p, o); o += p.length }
  u32(22, crc32(out))
  return out
}

const ascii = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0))

// `bytes`: the watch's file. Returns { ogg: Uint8Array, packets, ms, pages }
// or { error } when the file doesn't read as length-prefixed packets
export function oggFromWatchOpus(bytes, { inputRate = 16000, vendor = 'HTTP-Buttons' } = {}) {
  const f = parseOpusFrames(bytes, true)
  if (!f.packets) return { error: 'no Opus packets in the file' }
  if (f.parsed !== f.total) return { error: `the file breaks at byte ${f.parsed} of ${f.total}` }
  const channels = f.stereo ? 2 : 1
  // OpusHead: version 1, channels, pre-skip 0 (the watch's encoder delay is
  // unknown), the input rate (informative), gain 0, mapping family 0
  const head = new Uint8Array(19)
  head.set(ascii('OpusHead'))
  head[8] = 1
  head[9] = channels
  head[12] = inputRate & 255; head[13] = (inputRate >>> 8) & 255; head[14] = (inputRate >>> 16) & 255; head[15] = (inputRate >>> 24) & 255
  // OpusTags: the vendor, no comments
  const v = ascii(vendor)
  const tags = new Uint8Array(8 + 4 + v.length + 4)
  tags.set(ascii('OpusTags'))
  tags[8] = v.length & 255; tags[9] = (v.length >>> 8) & 255
  tags.set(v, 12)

  const serial = 0x48424f50 // fixed: one stream per file
  let seq = 0
  const pages = [page([head], { granule: 0, serial, seq: seq++, bos: true }), page([tags], { granule: 0, serial, seq: seq++ })]
  // Audio pages of whole packets, at most ~1 s or 255 lacing values each
  let group = [], segs = 0, granule = 0
  const flush = (eos) => {
    pages.push(page(group, { granule, serial, seq: seq++, eos }))
    group = []
    segs = 0
  }
  f.list.forEach(([at, len], i) => {
    const need = Math.floor(len / 255) + 1
    if (group.length && (segs + need > 255 || group.length >= 17)) flush(false)
    group.push(bytes.subarray(at, at + len))
    segs += need
    granule += packetSamples48(bytes, at, len)
    if (i === f.list.length - 1) flush(true)
  })
  const total = pages.reduce((a, p) => a + p.length, 0)
  const ogg = new Uint8Array(total)
  let o = 0
  for (const p of pages) { ogg.set(p, o); o += p.length }
  return { ogg, packets: f.packets, ms: f.ms, pages: pages.length, channels }
}

export const _test = { crc32 }
