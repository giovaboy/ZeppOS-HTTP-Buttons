import { BaseSideService, settingsLib } from '@zeppos/zml/base-side'
import { DEFAULT_DATA } from '../utils/constants.js'
import { parseChallenge, buildDigestAuth, parseUrlSimple } from '../utils/digest.js'

// Where the downloaded snapshot is stored on the phone side before conversion.
// One fixed name is enough: requests are one-shot and never run in parallel.
const IMAGE_DOWNLOAD_PATH = 'data://download/httpbtn_snapshot.png'

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
// this.convert / this.sendFile, registered by zml 0.0.41). PNG check is
// implicit: convert only accepts PNG, so anything else fails the .catch.
function startImageDownload(ctx, url, reqHeaders, res) {
  // Let the downloader pick the destination and tell us where it landed, rather
  // than forcing a custom path (convert was reporting the forced path as "not
  // found", so the file wasn't actually being written there).
  const task = ctx.download(url, {
    timeout: 15000,
    headers: reqHeaders,
    filePath: IMAGE_DOWNLOAD_PATH,
  })

  task.onFail = (e) => {
    console.log('[img] download failed', e && e.code, e && e.message)
    res(null, { ok: false, error: `Download failed: ${e && e.message ? e.message : 'unknown'}` })
  }

  task.onSuccess = (event) => {
    if (event && event.statusCode && (event.statusCode < 200 || event.statusCode >= 300)) {
      res(null, { ok: false, error: `HTTP ${event.statusCode}` })
      return
    }

    const srcPath = (event && (event.filePath || event.tempFilePath)) || IMAGE_DOWNLOAD_PATH
    ctx.convert({ filePath: srcPath })
      .then((result) => {
        // The image itself reaches the device over the transfer channel
        // (the page's onReceivedFile hook); here we just push it and ack.
        ctx.sendFile(result.targetFilePath, { type: 'image', name: 'snapshot' })
        res(null, { ok: true })
      })
      .catch((err) => {
        console.log('[img] convert failed', err && err.message, String(err))
        res(null, { ok: false, error: 'Unsupported image format (PNG only)' })
      })
  }
}

function fetchConvertAndPush(ctx, { url, headers = {}, auth, user, pass, token }, res) {
  const baseHeaders = { ...(headers || {}) }

  if (auth === 'Digest') {
    // The downloader can't do the 401 challenge round-trip itself, so we do it:
    // probe with fetch to read WWW-Authenticate, compute the Digest header
    // (reusing the device's digest helpers), then hand it to the downloader.
    fetch({ url, method: 'GET', timeout: 10000 })
      .then((probe) => {
        const wa = probe && probe.headers &&
          (probe.headers['www-authenticate'] || probe.headers['WWW-Authenticate'])
        if (probe && probe.status === 401 && wa && /Digest/i.test(wa)) {
          const challenge = parseChallenge(wa)
          const uri = parseUrlSimple(url).pathname
          const authHeader = buildDigestAuth({ username: user, password: pass, method: 'GET', uri, challenge })
          startImageDownload(ctx, url, { ...baseHeaders, Authorization: authHeader }, res)
        } else if (probe && probe.status >= 200 && probe.status < 300) {
          startImageDownload(ctx, url, baseHeaders, res) // no auth needed after all
        } else {
          res(null, { ok: false, error: `Digest probe: HTTP ${probe && probe.status}` })
        }
      })
      .catch((e) => {
        console.log('[img] digest probe failed', String(e))
        res(null, { ok: false, error: 'Digest auth probe failed' })
      })
    return
  }

  startImageDownload(ctx, url, { ...baseHeaders, ...buildImageAuthHeaders({ auth, user, pass, token }) }, res)
}

function migrateDataIfNeeded() {
  console.log('Error migrateDataIfNeeded')
  let raw = settingsLib.getItem('data')

  if (!raw) {
    //settingsLib.setItem('data', JSON.stringify(DEFAULT_DATA))
    console.log('no data found')
    return
  }

  try {
    let parsed = JSON.parse(raw)

    if (Array.isArray(parsed)) {
      let migrated = parsed[0] || DEFAULT_DATA
      settingsLib.setItem('data', JSON.stringify(migrated))
      console.log('array → object completed')
      return
    }

    if (typeof parsed === 'object') {
      return
    }

  } catch (e) {
    console.log('Error parsing data:', e)
    //settingsLib.setItem('data', JSON.stringify(DEFAULT_DATA))
  }
}

function getData() {
  //console.debug('getData')
  //migrateDataIfNeeded()
  const saved = settingsLib.getItem('data');
  return saved;// || JSON.stringify(DEFAULT_DATA);
}

AppSideService(
  BaseSideService({
    onInit() {
      migrateDataIfNeeded()
    },
    onRequest(req, res) {
      if (req.method === 'GET_DATA') {
        res(null, {
          result: getData()
        })
      } else if (req.method === 'FETCH_IMAGE') {
        fetchConvertAndPush(this, req.params || {}, res)
      }
    },
    onSettingsChange({ key, newValue, oldValue }) {//can we push to the watch from here?
      //console.log('settings changed:',key)
      //this.notifyDevice()
    },
    // notifyDevice() {
    //   this.call({
    //     method: 'data',
    //     params: {
    //       data: getData(),
    //     }
    //   })
    // },
    onRun() {},
    onDestroy() {}
  })
)