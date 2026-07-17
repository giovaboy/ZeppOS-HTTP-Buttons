import { BasePage } from '@zeppos/zml/base-page'
import { getLogger } from '../utils/logger.js'
import { createWidget, deleteWidget, widget, prop, anim_status } from '@zos/ui'
import { layout, LOADING_TEXT_WIDGET, LOADING_IMG_ANIM_WIDGET } from 'zosLoader:./index.[pf].layout.js'
import { digestRequest, basicRequest, bearerRequest } from '../utils/auth-request.js'
import { CUSTOM_TOAST, SHOW_IMAGE, DEFAULT_REQUEST_TIMEOUT_MS, MIN_REQUEST_TIMEOUT_MS, MAX_REQUEST_TIMEOUT_MS, REQUEST_TIMEOUT_RPC_MARGIN_MS } from '../utils/constants.js'
import { replace } from '@zos/router'

const logger = getLogger('http-buttons')

function isJsonString(str) {
  if (typeof str !== 'string') return false;
  try {
      JSON.parse(str);
      return true;
  } catch (e) {
      logger.error('isJsonString:',e);
      return false;
  }
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

// Deterministic nested lookup for the two-step auth flow (e.g. "session.sid",
// "data.token", "items[0].id"). Unlike searchJSON — which does a loose deep
// search by key name anywhere in the tree — this walks the exact path, in
// order. Numeric segments (dot or bracket form) index arrays too. Returns
// undefined if any hop is missing.
function getByPath(obj, path) {
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
function normalizeTimeout(v) {
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
  const headers = (d.headers && isJsonString(d.headers)) ? JSON.parse(d.headers) : undefined;
  const body = (d.body && isJsonString(d.body)) ? JSON.parse(d.body) : undefined;
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

// Short, watch-sized message for a failed phase (display space is tiny).
function shortError(e) {
  if (e == null) return 'error';
  if (typeof e === 'string') return e;
  if (e.status) return 'HTTP ' + e.status;
  if (e.message) return e.message;
  return JSON.stringify(e);
}

// In-memory token cache for the two-step flow, keyed by login url (+ user).
// Lives for the app's lifetime so rapid button presses reuse a valid session;
// entries carry enough context (session config + the replacements used) to fire
// an expiry-mode logout later. A plain object, not a Map, to stay on well-worn
// runtime ground.
let sessionCache = {};

function sessionKey(loginDescriptor) {
  return loginDescriptor.url + '|' + (loginDescriptor.user || '');
}

Page(
  BasePage({
    state: {
      data: null,
      isError: false
    },
    onInit() {
      logger.debug('page onInit invoked')
      // Loading widgets live on this.state (created in showLoading, cleared in
      // hideLoading); nothing to set up here beyond the state defaults above.
    },
    build() {
      logger.debug('page build invoked')
      this.showLoading()
      this.getDataFromPhone()
    },
    onReceivedFile(file) {
      // zml calls this when the side service STARTS pushing a file — the bytes
      // aren't written yet. We must wait for the 'change'→'transferred' event
      // before reading filePath, otherwise we'd show an empty (black) file.
      if (!file) return
      logger.debug('image incoming', file.fileName)
      file.on('change', (event) => {
        const state = event.data.readyState
        logger.debug('image file state', state)
        if (state === 'transferred') {
          this.clearImageSpinner()
          const userData = file.params || {}
          if (userData.type === 'image' && typeof layout.showImage === 'function') {
            logger.debug('showing image', file.filePath)
            layout.showImage(this, file.filePath, this.pendingImagePage || 0)
          }
        } else if (state === 'error') {
          this.clearImageSpinner()
          layout.notifyResult('Image transfer failed', this.pendingImagePage || 0, true, CUSTOM_TOAST)
        }
      })
    },
    clearImageSpinner() {
      // The button spinner for an image request is kept until the image is shown
      // or fails; it lives on the vm so this flow can dismiss it. The handle is
      // compound ({ bg, anim }) — the disc backdrop plus the animation.
      if (this.pendingImageSpinner) {
        const h = this.pendingImageSpinner
        if (h.anim) deleteWidget(h.anim)
        if (h.bg) deleteWidget(h.bg)
        this.pendingImageSpinner = null
      }
    },
    getDataFromPhone() {
      this.request({
        method: 'GET_DATA'
      })
        .then(
          ({ result }) => {
            //logger.info('getDataFromPhone success', result)
            this.state.data = result
            this.state.isError = false
            layout.render(this)
            this.hideLoading()
          }
        )
        .catch(
          (error) => {
            logger.error('getDataFromPhone error', error)
            this.state.isError = true
            layout.render(this)
            this.hideLoading()
          }
        )
    },
    showLoading() {
      logger.debug('page showLoading invoked')
      this.state.loadingText = createWidget(widget.TEXT, { ...LOADING_TEXT_WIDGET });
      this.state.loadingImgAnim = createWidget(widget.IMG_ANIM, { ...LOADING_IMG_ANIM_WIDGET });
    },
    hideLoading() {
      logger.debug('page hideLoading invoked')
      // Guarded + idempotent: reused both for the initial load and while waiting
      // for an image snapshot, and the inbox callback may fire more than once.
      if (!this.state.loadingText && !this.state.loadingImgAnim) return;
      if (this.state.loadingText) {
        this.state.loadingText.setProperty(prop.VISIBLE, false);
        deleteWidget(this.state.loadingText)
        this.state.loadingText = null
      }
      if (this.state.loadingImgAnim) {
        this.state.loadingImgAnim.setProperty(prop.VISIBLE, false);
        this.state.loadingImgAnim.setProperty(prop.ANIM_STATUS, anim_status.STOP);
        deleteWidget(this.state.loadingImgAnim)
        this.state.loadingImgAnim = null
      }
    },
    // Offered only when there is NO config at all: writes the example config on
    // the phone side, then reloads the page so it renders the demo.
    loadExampleConfig() {
      this.showLoading()
      this.request({ method: 'LOAD_DEFAULT' })
        .then(() => {
          replace({ url: 'page/index' })
        })
        .catch((error) => {
          logger.error('loadExampleConfig error', JSON.stringify(error))
          this.hideLoading() // reveals the message + button again for a retry
        })
    },
    // Render a successful response: extract with parse_result if asked, else
    // dump the body. Path-looking expressions ("choices[0].message.content",
    // "[*]", "[?field==value]") take the exact route via extractByPath; bare
    // keys keep the historical loose deep search. A path miss falls back to
    // the loose search so a key that merely contains a dot still resolves.
    reportResult(result, request, pageid) {
      let txtToReturn;
      if (request.parse_result) {
        const expr = String(request.parse_result);
        txtToReturn = [];
        if (expr.indexOf('.') !== -1 || expr.indexOf('[') !== -1) {
          txtToReturn = extractByPath(result.body, expr);
        }
        if (txtToReturn.length < 1) {
          txtToReturn = searchJSON(result.body, expr);
        }
        if (txtToReturn.length < 1) {
          txtToReturn = JSON.stringify(result.body);
        } else {
          txtToReturn = JSON.stringify(txtToReturn)
          txtToReturn = txtToReturn.substring(1, txtToReturn.length - 1);
        }
      } else {
        txtToReturn = JSON.stringify(result.body);
      }
      layout.notifyResult(txtToReturn, pageid, false, request.response_style)
    },
    // Show an error. Without a phase prefix this matches the old single-request
    // behavior (raw JSON). With a prefix (Auth/Req/…) it's a short, watch-sized
    // message so the wearer can tell which step of a two-step flow failed.
    reportError(error, request, pageid, prefix) {
      logger.error((prefix || '') + ' error=>', JSON.stringify(error))
      const msg = prefix ? (prefix + ': ' + shortError(error)) : JSON.stringify(error)
      layout.notifyResult(msg, pageid, true, request.response_style)
    },
    // Fire the optional logout sub-request for a session, substituting the token.
    // Fire-and-forget: failures are logged, never surfaced, and never touch the
    // result already shown to the user.
    runLogout(session, token, replacements) {
      if (!session || !session.logout || !session.logout.url) return Promise.resolve()
      const asName = (session.extract && session.extract.as) || 'token'
      let d = applyReplacements(pickDescriptor(session.logout), replacements)
      d = applyReplacements(d, [['{{' + asName + '}}', token]])
      return performRequest(this, d).catch((e) => {
        logger.error('logout error=>', JSON.stringify(e))
      })
    },
    // Resolve the session token: from the in-memory cache when still valid,
    // otherwise by running the login sub-request and extracting the value at
    // extract.path. Concurrent presses during an in-flight login share the same
    // promise (dedup). 'each' mode never caches (login every press); 'expiry'
    // mode caches and lazily logs out a stale token before re-login.
    resolveSessionToken(session, replacements, mode) {
      const extract = session.extract || {}
      const login = applyReplacements(pickDescriptor(session.login), replacements)

      const doLogin = () => performRequest(this, login).then((res) => {
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
        return Promise.resolve(cached.token)
      }
      if (cached && cached.promise) {
        return cached.promise
      }

      // Expiry mode: clean up the stale session before opening a new one.
      let pre = Promise.resolve()
      if (cached && cached.token && mode === 'expiry') {
        pre = this.runLogout(session, cached.token, replacements).catch(() => {})
      }

      const promise = pre.then(doLogin).then(({ token, res }) => {
        let ttlMs = extract.ttl ? extract.ttl * 1000 : 0
        if (extract.ttl_path) {
          const v = getByPath(res.body, extract.ttl_path)
          if (typeof v === 'number' && v > 0) ttlMs = v * 1000
        }
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
    executeButtonRequest(request, pageid, input = null) {
      const dt = JSON.parse(this.state.data)

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

      logger.debug('method', main.method)
      logger.debug('url', main.url)
      logger.debug('auth', main.auth)

      if (request.response_style === SHOW_IMAGE) {
        // Delegate the whole download → convert → push pipeline to the phone
        // side; the image itself comes back over the file-transfer channel
        // (see onReceivedFile). Errors are surfaced as a custom toast since the
        // image overlay can't render a failure. The two-step session flow does
        // not apply here (the image pipeline lives on the phone side).
        this.pendingImagePage = pageid
        if (request.session) {
          logger.debug('session ignored for image request')
        }
        // Loading feedback is the on-button spinner (started by the layout's
        // click handler); we just clear it on failure here.
        // The resolved timeout bounds the phone-side download; the RPC window
        // gets 45 s on top of it — the ack only comes back after the download
        // AND the convert/push have started, so it needs real headroom.
        const timeout = normalizeTimeout(main.timeout) || this.globalTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS
        return this.request({
          method: 'FETCH_IMAGE',
          params: {
            url: main.url,
            headers: (main.headers && isJsonString(main.headers)) ? JSON.parse(main.headers) : undefined,
            auth: main.auth, user: main.user, pass: main.pass, token: main.token,
            timeout
          }
        }, { timeout: timeout + 45000 }).then((resp) => {
          if (!resp || !resp.ok) {
            this.clearImageSpinner()
            layout.notifyResult((resp && resp.error) || 'Image error', pageid, true, CUSTOM_TOAST)
          }
        }).catch((error) => {
          logger.error('FETCH_IMAGE error=>', JSON.stringify(error))
          this.clearImageSpinner()
          layout.notifyResult(JSON.stringify(error), pageid, true, CUSTOM_TOAST)
        })
      }

      // Single-request path (no session block) — unchanged behavior.
      if (!request.session) {
        return performRequest(this, main)
          .then((result) => this.reportResult(result, request, pageid))
          .catch((error) => this.reportError(error, request, pageid))
      }

      // Two-step (session) path: login → extract token → main → optional logout.
      const session = request.session
      const asName = (session.extract && session.extract.as) || 'token'
      const mode = session.logout ? (session.logout.mode || 'expiry') : 'none'

      return this.resolveSessionToken(session, replacements, mode)
        .then((token) => {
          const mainWithToken = applyReplacements(main, [['{{' + asName + '}}', token]])
          // Main-phase errors are caught here so they read as "Req", not "Auth".
          return performRequest(this, mainWithToken)
            .then((result) => this.reportResult(result, request, pageid))
            .catch((error) => this.reportError(error, request, pageid, 'Req'))
            .then(() => {
              // 'each' mode: close the session right after the main request.
              // Fire-and-forget (not returned) so the spinner stops on the result.
              if (mode === 'each') this.runLogout(session, token, replacements)
            })
        })
        .catch((error) => this.reportError(error, request, pageid, 'Auth'))
    },
    onDestroy() {
      logger.debug('page onDestroy invoked')
      // Best-effort cleanup of any cached expiry-mode session (no background
      // timer on the watch, so logout happens lazily — here or before re-login).
      // Fire-and-forget: a hard app kill may skip this, which is acceptable.
      Object.keys(sessionCache).forEach((key) => {
        const entry = sessionCache[key]
        if (entry && entry.token && entry.mode === 'expiry' && entry.session && entry.session.logout) {
          this.runLogout(entry.session, entry.token, entry.replacements)
        }
      })
      sessionCache = {}
      // Null-guarded: the custom toast is created lazily, so on a page that
      // never showed one these refs are still empty — deleteWidget(undefined)
      // would throw during teardown.
      if (layout.refs.customToast) deleteWidget(layout.refs.customToast)
      if (layout.refs.customToastFillRect) deleteWidget(layout.refs.customToastFillRect)
      if (layout.refs.customToastText) deleteWidget(layout.refs.customToastText)
      if (typeof layout.hideImage === 'function') layout.hideImage()
    },
  })
)
