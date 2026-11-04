// The watch's recordings (@zos/media RECORDER, codec.OPUS) are not Ogg files.
// The first device runs (November 2026) read as raw Opus packets, each one
// after 8 bytes: its length (4 bytes, big endian) and 4 more bytes (the
// encoder's "final range", as in libopus's test tool format):
//   00 00 00 3b | 01 3e 24 7e | 58 00 27 23 … (59 bytes)   → 67 B in all
// This reads a file in that layout, for the log (and, if it holds, to wrap
// the packets in an Ogg container a service takes).

// Duration of one Opus frame, in 48 kHz samples, from the TOC byte's config
// (RFC 6716, 3.1): SILK 10/20/40/60 ms, hybrid 10/20 ms, CELT 2.5/5/10/20 ms
function frameSamples48(config) {
  if (config < 12) return [480, 960, 1920, 2880][config & 3]
  if (config < 16) return [480, 960][config & 1]
  return [120, 240, 480, 960][config & 3]
}

const MODES = (config) => config < 12 ? 'SILK' : config < 16 ? 'hybrid' : 'CELT'
const BANDS = (config) => config < 12 ? ['NB', 'MB', 'WB'][config >> 2] : config < 16 ? ['SWB', 'FB'][(config >> 1) & 1] : ['NB', 'WB', 'SWB', 'FB'][(config - 16) >> 2]

// Samples (48 kHz) of one packet: frame duration × frame count (TOC code)
export function packetSamples48(bytes, at, len) {
  const toc = bytes[at]
  const per = frameSamples48(toc >> 3)
  const code = toc & 3
  const frames = code === 0 ? 1 : code === 3 ? (len > 1 ? bytes[at + 1] & 63 : 0) : 2
  return per * frames
}

// { packets, ms, parsed, total, configs: 'SILK WB 20 ms ×150', stereo, list }
// `list` (when asked) holds each packet's [start, length] in `bytes`
export function parseOpusFrames(bytes, withList = false) {
  let i = 0, packets = 0, samples = 0, stereo = 0
  const configs = {}
  const list = withList ? [] : null
  while (i + 9 <= bytes.length) {
    const len = ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0
    if (len === 0 || len > 1275 * 3 || i + 8 + len > bytes.length) break
    const at = i + 8
    const toc = bytes[at]
    const c = toc >> 3
    samples += packetSamples48(bytes, at, len)
    if (toc & 4) stereo++
    configs[c] = (configs[c] || 0) + 1
    if (list) list.push([at, len])
    packets++
    i = at + len
  }
  const configText = Object.keys(configs).map((c) => `${MODES(+c)} ${BANDS(+c)} ${frameSamples48(+c) / 48} ms ×${configs[c]}`).join(', ')
  return { packets, ms: Math.round(samples / 48), samples48: samples, parsed: i, total: bytes.length, configs: configText, stereo: stereo > 0, list }
}
