// The Logs box: storage key, size, and the scrubber every line goes through
// (phone lines and the watch's [w] lines alike). Plain JS, no @zos imports: the
// settings page imports LOG_KEY from here.
// Shared rule: ../_shared/zeppos-ai-doc/logging.md
import { logsPrivate } from '../config.js'

export const LOG_KEY = 'app_log'
export const LOG_MAX = 200

// Size of a text for a log line: "812 B", "3.2 KB"
export function sizeText(chars) {
  if (!(chars >= 0)) return '? B'
  return chars < 1024 ? `${chars} B` : `${(chars / 1024).toFixed(1)} KB`
}

// "a local address" / "a remote address" for a URL, by its host
export function addressForLog(url) {
  const m = /^https?:\/\/(?:[^@/\s]*@)?(\[[^\]]*\]|[^:/\s?#]+)/i.exec(String(url))
  const host = m ? m[1].toLowerCase() : ''
  if (!host) return 'an address'
  const local =
    /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(host) ||
    host === 'localhost' ||
    /\.(local|lan|home|internal|localdomain)$/.test(host) ||
    /^[a-z0-9-]+$/.test(host) || // a bare host name: on the home network
    /^\[(fc|fd|fe80|::1)/.test(host)
  return local ? 'a local address' : 'a remote address'
}

// Field names whose string value is a credential, in the config, in a login
// body or in a JSON text that reached a line (a server's error). Not `auth`:
// in the config it names the scheme (Basic, Digest...), not a secret
const SECRET_FIELD = /^(user|username|login|email|pass|passwd|password|pin|token|access_token|refresh_token|id_token|secret|client_secret|api_?key|apikey|app_?key|authorization|cookie|set-cookie|sid|session|session_?id|x-api-key|x-auth-token|signature)$/i
// Header names worth hiding in a config's `headers`
const SECRET_HEADER = /auth|token|key|secret|cookie|session|pass/i

// Credentials in a text, by their shape
function scrubShapes(text) {
  return text
    // user:pass@ in a URL
    .replace(/(https?:\/\/)[^\s/@"')|]+@/gi, '$1…@')
    // every query parameter's value (keys, tokens, ids travel there)
    .replace(/([?&][^=&\s"')|#]+=)[^&\s"')|#]*/g, '$1…')
    // Authorization header values (not our own "auth=Basic" field)
    .replace(/(^|[^=\w])(Basic|Bearer)\s+[A-Za-z0-9._~+/=-]{6,}/g, '$1$2 …')
    .replace(/\b(response|nonce|cnonce|opaque)="[^"]*"/gi, '$1="…"')
    // "password":"…" in a JSON text
    .replace(/("([A-Za-z_-]+)"\s*:\s*")([^"]*)"/g, (all, head, key) => SECRET_FIELD.test(key) ? `${head}…"` : all)
}

// A line for the Logs box, whatever wrote it: never a secret of `secrets`
// (longest first) nor one recognised by its shape; in other than developer
// builds no address either (the whole URL: paths carry API keys too)
export function scrubLog(line, secrets = []) {
  let text = scrubShapes(String(line))
  // Addresses first: a host kept in a variable is a secret too, and once
  // hidden it can't tell a local address from a remote one
  if (!logsPrivate()) text = text.replace(/https?:\/\/[^\s"')|]+/g, (url) => `(${addressForLog(url)})`)
  for (const s of secrets) text = replaceWord(text, s)
  return text
}

const WORD_CHAR = /[A-Za-z0-9]/
// Every `secret` in `text` that stands alone (not inside a longer word: a
// password "pass" leaves "passed" alone) becomes "…"
function replaceWord(text, secret) {
  let out = ''
  let from = 0
  let at = text.indexOf(secret)
  while (at !== -1) {
    const end = at + secret.length
    const before = at > 0 ? text[at - 1] : ''
    const after = end < text.length ? text[end] : ''
    const alone = !(before && WORD_CHAR.test(before) && WORD_CHAR.test(secret[0])) &&
      !(after && WORD_CHAR.test(after) && WORD_CHAR.test(secret[secret.length - 1]))
    if (alone) { out += text.slice(from, at) + '…'; from = end }
    at = text.indexOf(secret, alone ? end : at + 1)
  }
  return from ? out + text.slice(from) : text
}

// The secrets of a config (the JSON text the watch reads): credentials of every
// request (main, login, logout, poll), sensitive header values, credential
// fields of request bodies, and every variable's value (hosts, keys). Texts
// with placeholders are templates, not secrets.
export function configSecrets(raw) {
  const found = new Set()
  const add = (v, min) => {
    if (typeof v !== 'string' && typeof v !== 'number') return
    const s = String(v).trim()
    if (s.length >= min && s.indexOf('{') === -1) found.add(s)
  }
  const parse = (s) => { try { return JSON.parse(s) } catch (e) { return null } }

  const walk = (node, depth) => {
    if (!node || typeof node !== 'object' || depth > 12) return
    for (const key of Object.keys(node)) {
      const v = node[key]
      if (key === 'variables' && v && typeof v === 'object') {
        for (const name of Object.keys(v)) add(v[name], 6)
      } else if (key === 'headers') {
        const h = typeof v === 'string' ? parse(v) : v
        if (h && typeof h === 'object') {
          for (const name of Object.keys(h)) if (SECRET_HEADER.test(name)) add(h[name], 4)
        }
      } else if (key === 'body' && typeof v === 'string') {
        walk(parse(v), depth + 1)
      } else if (typeof v === 'string' || typeof v === 'number') {
        if (SECRET_FIELD.test(key)) add(v, 4)
      } else {
        walk(v, depth + 1)
      }
    }
  }

  const data = typeof raw === 'string' ? parse(raw) : raw
  walk(data, 0)
  return Array.from(found).sort((a, b) => b.length - a.length)
}
