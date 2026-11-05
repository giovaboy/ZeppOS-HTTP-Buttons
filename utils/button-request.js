// Running a button's request: the helpers (JSON, paths, replacements,
// sessions, polling) and the page methods that fire a button and report its
// result. Shared by the buttons page (page/index.js) and the page the
// shortcut card opens (page/run.js): a page spreads requestMethods into its
// BasePage definition and provides showResult(text, pageid, isError, style).
import { digestRequest, basicRequest, bearerRequest } from './auth-request.js'
import { getText } from '@zos/i18n'
import { CUSTOM_TOAST, SHOW_IMAGE, PLAY_AUDIO, DEFAULT_REQUEST_TIMEOUT_MS, MIN_REQUEST_TIMEOUT_MS, MAX_REQUEST_TIMEOUT_MS, REQUEST_TIMEOUT_RPC_MARGIN_MS, RESULT_TEXT_MAX } from './constants.js'
import { devLog, infoLog, warnLog, LOG_TRACE } from './remote-log.js'
import { memoryUsage, errorText, sizeText } from './memory.js'
import { urlForLog, authForLog, styleForLog } from './log-text.js'

// Log lines (utils/remote-log.js): one per event, facts with numbers. A press
// is tagged by its button ("p0r1b2 Lamp"). Never the session token, the typed
// {input}, headers or bodies: only their sizes.

// The value of a JSON text, or undefined when it isn't one. One parse (the
// old isJsonString parsed and the callers parsed again).
export function parseJSON(str) {
  if (typeof str !== 'string') return undefined;
  try {
    return JSON.parse(str);
  } catch (e) {
    return undefined;
  }
}

// Size of a response body for a trace line (stringifies an object body: trace
// builds only)
function bodySize(res) {
  const b = res && res.body
  if (b == null) return 0
  if (typeof b === 'string') return b.length
  try { return JSON.stringify(b).length } catch (e) { return -1 }
}

// How long a pressed image button waits for the file once the phone has
// the image (then it stops holding the button)
const IMAGE_WAIT_MS = 90000

// A watch-sized text: the toast shows 7 rows, a modal a few more. A longer
// one only costs memory (the TEXT and its layout keep their own copies).
export function capText(txt) {
  const s = String(txt)
  return s.length > RESULT_TEXT_MAX ? s.slice(0, RESULT_TEXT_MAX) + '…' : s
}

function searchJSON(obj, key) {
  let results = [];
  for (let k in obj) {
    if (obj.hasOwnProperty(k)) {
      if (k === key) {
        results.push(obj[k]);
      } else if (typeof obj[k] === "object") {
        results = results.concat(searchJSON(obj[k], key));
      }
    }
  }
  return results;
}

// Split a selector like "choices[0].message.content" into segments
// (["choices", "0", "message", "content"]). Bracket contents become their own
// segment verbatim, so "[*]" and "[?version==1.2]" survive even when the
// filter value contains dots. Returns null on unbalanced brackets.
function parseSelector(expr) {
  const s = String(expr);
  const segs = [];
  let buf = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '.') {
      if (buf) { segs.push(buf); buf = ''; }
    } else if (ch === '[') {
      if (buf) { segs.push(buf); buf = ''; }
      const end = s.indexOf(']', i);
      if (end === -1) return null;
      segs.push(s.slice(i + 1, end));
      i = end;
    } else if (ch === ']') {
      return null;
    } else {
      buf += ch;
    }
  }
  if (buf) segs.push(buf);
  return segs;
}

// Parse a "?field==value" filter segment into { field, value }. Tolerates the
// JSONPath spellings — "?(...)" wrapping, "@." prefix, quoted value — so
// "[?(@.finish_reason=='stop')]" and "[?finish_reason==stop]" mean the same
// thing. Returns null when the segment isn't a usable filter.
function parseFilter(seg) {
  let f = seg.slice(1);
  if (f.charAt(0) === '(' && f.charAt(f.length - 1) === ')') f = f.slice(1, -1);
  if (f.slice(0, 2) === '@.') f = f.slice(2);
  const at = f.indexOf('==');
  if (at === -1) return null;
  const field = f.slice(0, at).trim();
  let value = f.slice(at + 2).trim();
  const q = value.charAt(0);
  if ((q === "'" || q === '"') && value.length > 1 && value.charAt(value.length - 1) === q) {
    value = value.slice(1, -1);
  }
  if (!field) return null;
  return { field, value };
}

// Exact-path extraction for parse_result expressions that look like a path
// (contain dots or brackets). Plain segments walk objects/arrays (negative
// numbers index arrays from the end), "*" fans out over every element of an
// array, "?field==value" keeps only the array elements whose field
// (string-)equals value. Always returns an array of matches — [] on any miss
// or malformed selector — so reportResult can treat it like searchJSON output.
function extractByPath(obj, expr) {
  const parts = parseSelector(expr);
  if (!parts || parts.length === 0) return [];
  let current = [obj];
  for (const p of parts) {
    const next = [];
    if (p === '*') {
      for (const c of current) {
        if (Array.isArray(c)) for (const el of c) next.push(el);
      }
    } else if (p.charAt(0) === '?') {
      const f = parseFilter(p);
      if (!f) return [];
      for (const c of current) {
        if (!Array.isArray(c)) continue;
        for (const el of c) {
          if (el != null && String(el[f.field]) === f.value) next.push(el);
        }
      }
    } else {
      for (const c of current) {
        if (c == null || typeof c !== 'object') continue;
        let v;
        if (Array.isArray(c) && /^-\d+$/.test(p)) v = c[c.length + Number(p)];
        else v = c[p];
        if (v !== undefined) next.push(v);
      }
    }
    if (next.length === 0) return [];
    current = next;
  }
  return current;
}

// res.body is an object on most models but a JSON *string* on some (documented
// fetch compat quirk); normalize before path lookups.
export function parsedBody(res) {
  const b = res && res.body
  if (typeof b === 'string') {
    const v = parseJSON(b)
    return v === undefined ? b : v
  }
  return b
}

// Deterministic nested lookup for the two-step auth flow (e.g. "session.sid",
// "data.token", "items[0].id"). Unlike searchJSON — which does a loose deep
// search by key name anywhere in the tree — this walks the exact path, in
// order. Numeric segments (dot or bracket form) index arrays too. Returns
// undefined if any hop is missing.
export function getByPath(obj, path) {
  if (!obj || !path) return undefined;
  const parts = parseSelector(path) || String(path).split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

// The string fields of a request that can carry placeholders and get sent on the
// wire. Shared by the main request and the optional login/logout sub-requests.
const DESCRIPTOR_FIELDS = ['url', 'method', 'headers', 'body', 'auth', 'user', 'pass', 'token'];

// Clamp a config-supplied timeout (ms) to a sane range. Non-numeric or missing
// values yield undefined so callers fall through: button → global → default.
export function normalizeTimeout(v) {
  const n = Number(v);
  if (!isFinite(n) || n <= 0) return undefined;
  return Math.min(Math.max(n, MIN_REQUEST_TIMEOUT_MS), MAX_REQUEST_TIMEOUT_MS);
}

// Copy just the request fields we care about out of a raw config block.
function pickDescriptor(src) {
  const d = {};
  if (!src) return d;
  for (const f of DESCRIPTOR_FIELDS) {
    if (src[f] !== undefined) d[f] = src[f];
  }
  // Numeric, so outside DESCRIPTOR_FIELDS (no placeholder substitution): the
  // per-request timeout override, honored by performRequest.
  if (src.timeout !== undefined) d.timeout = src.timeout;
  // The recording settings (an object: no placeholders in it)
  if (src.audio && typeof src.audio === 'object') d.audio = src.audio;
  return d;
}

// Return a copy of the descriptor with every [search, value] pair applied to its
// string fields. Used both for {var}/{input} (config-time) and {{token}}
// (after login), so the same substitution engine serves every phase.
function applyReplacements(d, pairs) {
  const out = { ...d };
  for (const [search, value] of pairs) {
    const rep = String(value);
    for (const f of DESCRIPTOR_FIELDS) {
      if (typeof out[f] === 'string' && out[f].indexOf(search) !== -1) {
        out[f] = out[f].replaceAll(search, rep);
      }
    }
  }
  return out;
}

// Single entry point for firing one HTTP request, dispatching by auth type.
// Login, main and logout all go through here — a login/logout is "just another
// request", only its purpose differs. Returns the same promise the underlying
// helpers do (this.httpRequest already returns a promise). The fetch timeout
// resolves per-request override → global (ctx.globalTimeoutMs, set per press in
// executeButtonRequest) → app default.
function performRequest(ctx, d) {
  const method = d.method;
  const url = d.url;
  const headers = d.headers ? parseJSON(d.headers) : undefined;
  // A recording to send (request.audio): page/run recorded it, the phone builds
  // the body and sends it with the button's auth (ctx.audioRequest). The body
  // goes as the template it is: the phone puts the recording in {audio}
  if (d.audio) {
    if (typeof ctx.audioRequest !== 'function') return Promise.reject(new Error('Audio buttons run on their own page'))
    const timeout = normalizeTimeout(d.timeout) || ctx.globalTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS
    return ctx.audioRequest(d, { headers, timeout })
  }
  const body = d.body ? parseJSON(d.body) : undefined;
  const timeout = normalizeTimeout(d.timeout) || ctx.globalTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS;

  if (d.auth === 'Digest') {
    return digestRequest(ctx, { url, method, headers, body, timeout, username: d.user, password: d.pass });
  } else if (d.auth === 'Basic') {
    return basicRequest(ctx, { url, method, headers, body, timeout, username: d.user, password: d.pass });
  } else if (d.auth === 'Bearer') {
    return bearerRequest(ctx, { url, method, headers, body, timeout, token: d.token });
  }
  // RPC window above the fetch timeout: the fetch's readable error must win.
  return ctx.httpRequest({ url, method, headers, body, timeout }, { timeout: timeout + REQUEST_TIMEOUT_RPC_MARGIN_MS });
}

// performRequest with a trace line for each request of a press (login, main,
// poll attempt, logout): status, time, body size. `what` names it
// ("[req] p0r1b2 Lamp"). Failures are traced here and rethrown: the press's
// outcome line (reportResult / reportError) says what the user saw.
function performRequestLogged(ctx, d, what) {
  const t0 = Date.now()
  let p
  try { p = performRequest(ctx, d) } catch (e) { p = Promise.reject(e) }
  return p.then((res) => {
    if (LOG_TRACE) devLog(`${what}: HTTP ${res && res.status} in ${Date.now() - t0}ms, body ${sizeText(bodySize(res))}`)
    return res
  }, (e) => {
    if (LOG_TRACE) devLog(`${what}: failed after ${Date.now() - t0}ms: ${errorText(e)}`)
    throw e
  })
}

// A file the phone downloads and pushes to the watch: an image to show, or
// an audio file to play (PLAY_AUDIO, or the test suite's audio_play flag)
const isAudioStyle = (r) => !!r && (Number(r.response_style) === PLAY_AUDIO || !!r.audio_play)
const isMediaStyle = (r) => !!r && (Number(r.response_style) === SHOW_IMAGE || isAudioStyle(r))

// Pages, rows and buttons (spacers left out) of a config, for a log line
export function configCounts(cfg) {
  let rows = 0, buttons = 0
  for (const p of cfg.pages || []) {
    for (const r of p.rows || []) {
      rows++
      for (const b of r.buttons || []) if (!b.spacer) buttons++
    }
  }
  return `${(cfg.pages || []).length} pages, ${rows} rows, ${buttons} buttons`
}

// Short, watch-sized message for a failed phase (display space is tiny).
export function shortError(e) {
  if (e === null) return 'out of memory';
  if (e == null) return 'error';
  if (typeof e === 'string') return e;
  if (e.status) return 'HTTP ' + e.status;
  if (e.message) return e.message;
  return JSON.stringify(e);
}

// The error as raw JSON (the historical unprefixed message), but readable
// when JSON says nothing: an Error instance stringifies to "{}"
export function rawError(e) {
  if (e === null) return 'out of memory';
  const json = JSON.stringify(e);
  return (json === undefined || json === '{}') ? shortError(e) : json;
}

// In-memory token cache for the two-step flow, keyed by login url (+ user).
// Lives for the app's lifetime so rapid button presses reuse a valid session;
// entries carry enough context (session config + the replacements used) to fire
// an expiry-mode logout later. A plain object, not a Map, to stay on well-worn
// runtime ground.
let sessionCache = {};
// For the page's onDestroy: the cached sessions, then empty the cache
export function cachedSessions() {
  return Object.keys(sessionCache).map((key) => sessionCache[key]).filter(Boolean)
}
export function clearSessionCache() {
  sessionCache = {}
}

function sessionKey(loginDescriptor) {
  return loginDescriptor.url + '|' + (loginDescriptor.user || '');
}


// The page methods (this: the page). They need from the page: this.request /
// this.httpRequest (ZML BasePage), this.state.config, this.showResult(), and
// for image buttons the image queue of page/index.js.
export const requestMethods = {
    // Async-job support: with a poll block, the main response only *started* a
    // job — extract the job id from it ({{job}} by default), then re-request
    // the poll URL until the result is ready or attempts run out. Without a
    // poll block this is a plain reportResult. Chained one-shot timers, not
    // setInterval: the next wait starts only after an attempt fully settles,
    // so slow polls never overlap. Timers are tracked on the vm for onDestroy
    // cleanup. `pairs` carries the replacements already applied to the main
    // request ({var}/{input}, plus {{token}} on the session path) so the poll
    // descriptor gets them too. `run` ({ tag, t0 }) is the press, for the logs.
    finishOrPoll(result, request, pageid, pairs, run) {
      const poll = request.poll
      if (!poll || !poll.url) return this.reportResult(result, request, pageid, run)

      const asName = (poll.extract && poll.extract.as) || 'job'
      if (poll.extract && poll.extract.path) {
        const id = getByPath(parsedBody(result), poll.extract.path)
        if (id === undefined || id === null || id === '') {
          return this.reportError('no ' + asName, request, pageid, 'Poll', run)
        }
        pairs = pairs.concat([['{{' + asName + '}}', id]])
      }

      const d = applyReplacements(pickDescriptor(poll), pairs)
      if (!d.method) d.method = 'GET'
      const every = Math.min(Math.max(Number(poll.every) || 2000, 1000), 60000)
      const max = Math.min(Math.max(Number(poll.max) || 30, 1), 120)
      if (LOG_TRACE) devLog(`${run.tag}: polling every ${every}ms, at most ${max} tries${poll.until ? ', until a value' : ', until a 2xx'}`)

      // Done-condition: with `until`, the dotted path must yield a non-empty
      // value in the poll response body; without it, any 2xx response is the
      // result. Anything else (404 while the job runs, transport hiccups)
      // counts as "not ready" and schedules the next attempt.
      const isDone = (res) => {
        if (poll.until) {
          const v = getByPath(parsedBody(res), poll.until)
          return !(v === undefined || v === null || v === '')
        }
        return res.status >= 200 && res.status < 300
      }

      let attempts = 0
      return new Promise((resolve) => {
        const finish = (report) => { report(); resolve() }
        const schedule = () => {
          if (attempts >= max) {
            return finish(() => this.reportError('not ready after ' + attempts + ' tries', request, pageid, 'Poll', run))
          }
          // Page tearing down: stop silently, nothing left to report to.
          if (this.pollsCancelled) return resolve()
          this.pollTimers = this.pollTimers || []
          const t = setTimeout(() => {
            this.pollTimers = this.pollTimers.filter((x) => x !== t)
            attempts++
            performRequestLogged(this, d, `${run.tag} poll ${attempts}/${max}`)
              .then((res) => {
                if (isDone(res)) return finish(() => this.reportResult(res, request, pageid, run))
                schedule()
              })
              .catch(() => schedule())
          }, every)
          this.pollTimers.push(t)
        }
        schedule()
      })
    },
    // Render a successful response: extract with parse_result if asked, else
    // dump the body. Path-looking expressions ("choices[0].message.content",
    // "[*]", "[?field==value]") take the exact route via extractByPath; bare
    // keys keep the historical loose deep search. A path miss falls back to
    // the loose search so a key that merely contains a dot still resolves.
    // The body is normalized first (some models deliver it as a JSON string),
    // and the text shown is capped at RESULT_TEXT_MAX.
    reportResult(result, request, pageid, run) {
      const body = parsedBody(result);
      let txtToReturn;
      if (request.parse_result) {
        const expr = String(request.parse_result);
        txtToReturn = [];
        if (expr.indexOf('.') !== -1 || expr.indexOf('[') !== -1) {
          txtToReturn = extractByPath(body, expr);
        }
        if (txtToReturn.length < 1) {
          txtToReturn = searchJSON(body, expr);
        }
        if (txtToReturn.length < 1) {
          txtToReturn = JSON.stringify(body);
        } else {
          txtToReturn = JSON.stringify(txtToReturn)
          txtToReturn = txtToReturn.substring(1, txtToReturn.length - 1);
        }
      } else {
        txtToReturn = JSON.stringify(body);
      }
      const fullLength = txtToReturn ? txtToReturn.length : 0
      txtToReturn = capText(txtToReturn)
      this.showResult(txtToReturn, pageid, false, request.response_style)
      // One line per press: the outcome, and in trace builds the memory once
      // the result is on screen (the style tells which notification it took)
      if (run) {
        infoLog(`${run.tag}: HTTP ${result && result.status} in ${Date.now() - run.t0}ms, ${sizeText(fullLength)} result${fullLength > RESULT_TEXT_MAX ? ` (cut to ${RESULT_TEXT_MAX})` : ''}` +
          `${LOG_TRACE ? `, ${styleForLog(request.response_style)}, ${this.inFlight || 0} in flight; ${memoryUsage()}` : ''}`)
      }
    },
    // Show an error. Without a phase prefix this matches the old single-request
    // behavior (raw JSON). With a prefix (Auth/Req/…) it's a short, watch-sized
    // message so the wearer can tell which step of a two-step flow failed.
    reportError(error, request, pageid, prefix, run) {
      const msg = prefix ? (prefix + ': ' + shortError(error)) : rawError(error)
      this.showResult(capText(msg), pageid, true, request.response_style)
      warnLog(`${run ? run.tag : '[req]'}: ${prefix ? prefix + ': ' : ''}${errorText(error)}${run ? ` after ${Date.now() - run.t0}ms` : ''}` +
        `${LOG_TRACE ? `, ${styleForLog(request.response_style)}, ${this.inFlight || 0} in flight; ${memoryUsage()}` : ''}`)
    },
    // Fire the optional logout sub-request for a session, substituting the token.
    // Fire-and-forget: failures are logged, never surfaced, and never touch the
    // result already shown to the user.
    runLogout(session, token, replacements) {
      if (!session || !session.logout || !session.logout.url) return Promise.resolve()
      const asName = (session.extract && session.extract.as) || 'token'
      let d = applyReplacements(pickDescriptor(session.logout), replacements)
      d = applyReplacements(d, [['{{' + asName + '}}', token]])
      return performRequestLogged(this, d, '[auth] logout').catch((e) => {
        warnLog(`[auth] logout failed: ${errorText(e)}`)
      })
    },
    // Resolve the session token: from the in-memory cache when still valid,
    // otherwise by running the login sub-request and extracting the value at
    // extract.path. Concurrent presses during an in-flight login share the same
    // promise (dedup). 'each' mode never caches (login every press); 'expiry'
    // mode caches and lazily logs out a stale token before re-login.
    resolveSessionToken(session, replacements, mode, tag) {
      const extract = session.extract || {}
      const login = applyReplacements(pickDescriptor(session.login), replacements)

      const doLogin = () => performRequestLogged(this, login, `${tag} login`).then((res) => {
        const token = extract.path ? getByPath(res.body, extract.path) : undefined
        if (token === undefined || token === null || token === '') {
          const e = new Error('no token'); e.__auth = true; throw e
        }
        return { token, res }
      })

      if (mode === 'each') {
        return doLogin().then(({ token }) => token)
      }

      const key = sessionKey(login)
      const now = Date.now()
      const cached = sessionCache[key]
      if (cached && cached.token && cached.expiresAt > now) {
        if (LOG_TRACE) devLog(`${tag} session: token from the cache, ${Math.round((cached.expiresAt - now) / 1000)}s left`)
        return Promise.resolve(cached.token)
      }
      if (cached && cached.promise) {
        if (LOG_TRACE) devLog(`${tag} session: waiting for the login already running`)
        return cached.promise
      }

      // Expiry mode: clean up the stale session before opening a new one.
      let pre = Promise.resolve()
      if (cached && cached.token && mode === 'expiry') {
        if (LOG_TRACE) devLog(`${tag} session: cached token expired, logging out first`)
        pre = this.runLogout(session, cached.token, replacements).catch(() => {})
      }

      const promise = pre.then(doLogin).then(({ token, res }) => {
        let ttlMs = extract.ttl ? extract.ttl * 1000 : 0
        if (extract.ttl_path) {
          const v = getByPath(res.body, extract.ttl_path)
          if (typeof v === 'number' && v > 0) ttlMs = v * 1000
        }
        if (LOG_TRACE) devLog(`${tag} session: token received, ${ttlMs > 0 ? `kept ${Math.round(ttlMs / 1000)}s` : 'not kept (no ttl)'}`)
        sessionCache[key] = {
          token,
          // ttlMs 0 → expiresAt 0 → treated as expired next press (no reuse).
          expiresAt: ttlMs > 0 ? Date.now() + ttlMs : 0,
          promise: null,
          session,
          replacements,
          mode
        }
        return token
      }).catch((err) => {
        delete sessionCache[key]
        throw err
      })

      // Publish the in-flight promise so concurrent presses reuse it.
      sessionCache[key] = { token: cached && cached.token, expiresAt: 0, promise, session, replacements, mode }
      return promise
    },
    // `label` names the button in the log lines ("p0r1b2 Lamp"), given by the
    // layout's click handler. Counts the presses in flight for the log lines:
    // each one held ~10 KB until it settled (a burst of 13 took the app from
    // ~400 to 527 KB, back down as they answered).
    executeButtonRequest(request, pageid, input = null, label = null) {
      const run = { tag: '[btn] ' + (label || ('p' + pageid)), t0: Date.now() }
      this.inFlight = (this.inFlight || 0) + 1
      const done = () => { this.inFlight = Math.max(0, (this.inFlight || 1) - 1) }
      let p
      try {
        p = this.runButtonRequest(request, pageid, input, run)
      } catch (e) {
        done()
        throw e
      }
      if (p && typeof p.then === 'function') p.then(done, done)
      else done()
      return p
    },
    runButtonRequest(request, pageid, input, run) {
      const dt = this.state.config || {}

      // Global timeout (data.timeout), resolved once per press; per-button
      // overrides ride the descriptor (request.timeout, via pickDescriptor) and
      // win inside performRequest.
      this.globalTimeoutMs = normalizeTimeout(dt.timeout)

      // Build the config-time replacement list: global variables {key} + {input}.
      const replacements = []
      if (dt.variables) {
        Object.entries(dt.variables).forEach(([key, value]) => {
          replacements.push(['{' + key + '}', value])
        })
      }
      if (input) {
        replacements.push(['{input}', input])
      }

      // The main request, with variables/input resolved.
      const main = applyReplacements(pickDescriptor(request), replacements)
      const timeout = normalizeTimeout(main.timeout) || this.globalTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS

      // The press: the URL with the typed text put back as {input} (the phone
      // scrubs the rest: secrets, query values, and the address unless DEV)
      if (LOG_TRACE) {
        // Built again from the template with {input} left as is: replacing the
        // typed text in the final URL also hit its other occurrences (an input
        // "1" turned 192.168.1.40 into {input}92.{input}68…)
        const shownUrl = input
          ? applyReplacements({ url: request.url }, replacements.filter(([s]) => s !== '{input}')).url
          : main.url
        devLog(`${run.tag}: ${String(main.method || 'GET').trim()} ${urlForLog(shownUrl)} auth=${authForLog(main.auth)} timeout=${timeout}ms` +
          `${isMediaStyle(request) ? (isAudioStyle(request) ? ' audio' : ' image') : ''}${request.audio ? ' recording' : ''}${request.session ? ' session' : ''}${request.poll ? ' poll' : ''}` +
          `${input != null ? `, input of ${String(input).length} chars` : ''}, ${this.inFlight} in flight`)
      }

      if (isMediaStyle(request) && !request.audio) {
        // Delegate the whole download → convert → push pipeline to the phone
        // side; the image itself comes back over the file-transfer channel
        // (see onReceivedFile). Errors are surfaced as a custom toast since the
        // image overlay can't render a failure. The two-step session flow does
        // not apply here (the image pipeline lives on the phone side).
        this.pendingImagePage = pageid
        this.pendingImageRun = run
        if (request.session && LOG_TRACE) devLog(`${run.tag}: session ignored for an image`)
        if (request.poll && LOG_TRACE) devLog(`${run.tag}: poll ignored for an image`)
        // Loading feedback is the on-button spinner (started by the layout's
        // click handler); we just clear it on failure here.
        // The resolved timeout bounds the phone-side download; the RPC window
        // gets 45 s on top of it — the ack only comes back after the download
        // AND the convert/push have started, so it needs real headroom.
        return this.request({
          method: 'FETCH_IMAGE',
          params: {
            url: main.url,
            headers: main.headers ? parseJSON(main.headers) : undefined,
            auth: main.auth, user: main.user, pass: main.pass, token: main.token,
            timeout,
            // EXPERIMENT (test mode): an audio file, sent as is and played
            // (utils/audio-play.js)
            kind: isAudioStyle(request) ? 'audio' : undefined
          }
        }, { timeout: timeout + 45000 }).then((resp) => {
          if (!resp || !resp.ok) {
            warnLog(`${run.tag}: image failed on the phone after ${Date.now() - run.t0}ms: ${(resp && resp.error) || 'no answer'}`)
            this.clearImageSpinner()
            this.showResult((resp && resp.error) || getText('image_error'), pageid, true, CUSTOM_TOAST)
          } else {
            if (LOG_TRACE) devLog(`${run.tag}: phone has the image, ${Date.now() - run.t0}ms after the press`)
            // A file that never arrives must not hold the button (and its
            // queued taps) for ever. ~25 s for a 1.8 MB image at ~70 KB/s
            if (this.imageWaitTimer) clearTimeout(this.imageWaitTimer)
            this.imageWaitTimer = setTimeout(() => {
              this.imageWaitTimer = null
              if (this.pendingImageRun !== run) return
              warnLog(`${run.tag}: no image ${IMAGE_WAIT_MS}ms after the phone had it`)
              this.clearImageSpinner()
            }, IMAGE_WAIT_MS)
          }
        }).catch((error) => {
          warnLog(`${run.tag}: FETCH_IMAGE failed after ${Date.now() - run.t0}ms: ${errorText(error)}`)
          this.clearImageSpinner()
          this.showResult(capText(rawError(error)), pageid, true, CUSTOM_TOAST)
        })
      }

      // Single-request path (no session block) — unchanged behavior unless a
      // poll block turns the response into the start of an async job.
      // A plain press gets no request line of its own: its outcome line (or
      // error line) already says status and time. With a poll block the start
      // request is traced, to tell it from the attempts.
      if (!request.session) {
        const started = request.poll
          ? performRequestLogged(this, main, run.tag + ' start')
          : Promise.resolve().then(() => performRequest(this, main))
        return started
          .then((result) => this.finishOrPoll(result, request, pageid, replacements, run))
          .catch((error) => this.reportError(error, request, pageid, undefined, run))
      }

      // Two-step (session) path: login → extract token → main → optional logout.
      const session = request.session
      const asName = (session.extract && session.extract.as) || 'token'
      const mode = session.logout ? (session.logout.mode || 'expiry') : 'none'

      return this.resolveSessionToken(session, replacements, mode, run.tag)
        .then((token) => {
          const tokenPair = ['{{' + asName + '}}', token]
          const mainWithToken = applyReplacements(main, [tokenPair])
          // Main-phase errors are caught here so they read as "Req", not "Auth".
          // The token pair rides along so a poll block can use {{token}} too.
          return performRequestLogged(this, mainWithToken, run.tag)
            .then((result) => this.finishOrPoll(result, request, pageid, replacements.concat([tokenPair]), run))
            .catch((error) => this.reportError(error, request, pageid, 'Req', run))
            .then(() => {
              // 'each' mode: close the session right after the main request
              // (and after any polling, which may still need it).
              // Fire-and-forget (not returned) so the spinner stops on the result.
              if (mode === 'each') this.runLogout(session, token, replacements)
            })
        })
        .catch((error) => this.reportError(error, request, pageid, 'Auth', run))
    }
}
