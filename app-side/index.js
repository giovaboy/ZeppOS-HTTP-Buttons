import { BaseSideService, settingsLib } from '@zeppos/zml/base-side'
import { DEFAULT_DATA } from '../utils/constants.js'

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

// Build the auth header for the image GET. Digest needs a challenge round-trip
// that downloadFile can't do, so it isn't supported for images (v1).
function buildImageAuthHeaders({ auth, user, pass, token }) {
  const headers = {}
  if (auth === 'Basic' && user) {
    headers['Authorization'] = 'Basic ' + encodeBase64(`${user}:${pass || ''}`)
  } else if (auth === 'Bearer' && token) {
    headers['Authorization'] = 'Bearer ' + token
  }
  return headers
}

// Download the remote image to the phone, convert it to a device-drawable
// format, then push it to the watch — all via the zml side-service helpers
// (this.download / this.convert / this.sendFile, registered by zml 0.0.41).
// The PNG check is implicit: convert only accepts PNG, so a JPEG (or anything
// else) makes it fail and we report a clear error instead.
function fetchConvertAndPush(ctx, { url, headers = {}, auth, user, pass, token }, res) {
  const reqHeaders = { ...(headers || {}), ...buildImageAuthHeaders({ auth, user, pass, token }) }

  // Let the downloader pick the destination and tell us where it landed, rather
  // than forcing a custom path (convert was reporting the forced path as "not
  // found", so the file wasn't actually being written there).
  const task = ctx.download(url, {
    timeout: 15000,
    headers: reqHeaders,
    filePath: IMAGE_DOWNLOAD_PATH,
  })

  task.onFail = (e) => {
    console.log('[img] download FAILED', JSON.stringify(e), 'code=', e && e.code, 'message=', e && e.message)
    res(null, { ok: false, error: `Download failed: ${e && e.message ? e.message : 'unknown'}` })
  }

  task.onSuccess = (event) => {
    // DIAGNOSTIC: dump everything the download reports.
    console.log('[img] download onSuccess', JSON.stringify(event),
      'statusCode=', event && event.statusCode,
      'filePath=', event && event.filePath,
      'tempFilePath=', event && event.tempFilePath)

    if (event && event.statusCode && (event.statusCode < 200 || event.statusCode >= 300)) {
      res(null, { ok: false, error: `HTTP ${event.statusCode}` })
      return
    }

    // Convert the file at the path the download ACTUALLY reported (filePath, or
    // tempFilePath if no custom path was honored). PNG-only: convert rejects
    // non-PNG input.
    const srcPath = (event && (event.filePath || event.tempFilePath)) || IMAGE_DOWNLOAD_PATH
    console.log('[img] converting', srcPath)
    ctx.convert({ filePath: srcPath })
      .then((result) => {
        console.log('[img] convert OK', JSON.stringify(result))
        // The image itself reaches the device over the transfer channel
        // (the page's onReceivedFile hook); here we just push it and ack.
        ctx.sendFile(result.targetFilePath, { type: 'image', name: 'snapshot' })
        res(null, { ok: true })
      })
      .catch((err) => {
        // Errors rarely survive JSON.stringify; log the useful fields directly.
        console.log('[img] convert FAILED',
          'message=', err && err.message,
          'code=', err && err.code,
          'str=', String(err),
          'json=', JSON.stringify(err))
        res(null, { ok: false, error: 'Unsupported image format (PNG only)' })
      })
  }
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