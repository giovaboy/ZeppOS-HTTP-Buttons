// Pieces of log lines shared by the watch and the side service. Plain JS, no
// @zos imports.

// A URL as one word: the phone's scrubber (app-side/log.js) recognises a URL
// and its query values up to the first space, so a URL with spaces left its
// tail in the Logs box. Spaces at its ends are trimmed (and said: a server may
// refuse such a URL), the ones inside become %20.
export function urlForLog(url) {
  if (typeof url !== 'string') return String(url)
  const t = url.trim()
  return t.replace(/\s/g, '%20') + (t !== url ? ' (the URL has spaces at its ends)' : '')
}

// The auth scheme of a request; anything else (missing, the settings' "--")
// is none
export function authForLog(auth) {
  return (auth === 'Basic' || auth === 'Digest' || auth === 'Bearer') ? auth : 'none'
}

// response_style by name (utils/constants.js)
const STYLES = ['custom toast', 'system toast', 'modal', 'no notification', 'image']
export function styleForLog(style) {
  return STYLES[Number(style) || 0] || `style ${style}`
}
