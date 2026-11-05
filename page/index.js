import { BasePage } from '@zeppos/zml/base-page'
import { createWidget, deleteWidget, widget, prop, anim_status } from '@zos/ui'
import { readdirSync, statSync, rmSync, readFileSync, writeFileSync } from '@zos/fs'
import { layout, LOADING_TEXT_WIDGET, LOADING_IMG_ANIM_WIDGET } from 'zosLoader:./index.[pf].layout.js'
import { CUSTOM_TOAST } from '../utils/constants.js'
import { requestMethods, parseJSON, configCounts, cachedSessions, clearSessionCache } from '../utils/button-request.js'
import { readConfigCopy, writeConfigCopy, removeConfigCopy } from '../utils/config-copy.js'
import { replace } from '@zos/router'
import { getText } from '@zos/i18n'
import { swipeToIndex, getSwiperIndex, SCROLL_ANIMATION_NONE } from '@zos/page'
import { getDeviceInfo, SCREEN_SHAPE_ROUND } from '@zos/device'
import { devLog, infoLog, warnLog, LOG_TRACE } from '../utils/remote-log.js'
import { memoryUsage, errorText, sizeText } from '../utils/memory.js'
import { urlForLog, authForLog, styleForLog } from '../utils/log-text.js'

// Log lines (utils/remote-log.js): one per event, facts with numbers.
// Running a button (requests, sessions, polling, results): utils/button-request.js

// While a press runs, a changed config waits this long between checks before
// redrawing (a redraw would cut the press short)
const RELOAD_RETRY_MS = 500
// The page to come back to (rememberPage) is used within this time
const RETURN_PAGE_MAX_MS = 10 * 60 * 1000
// A result handed back by page/run (showRunResult) is shown within this time
const RUN_RESULT_MAX_MS = 60 * 1000

// The watch's screen, sent with each GET_DATA: the settings page draws its
// page miniatures with this shape and these proportions
function screenInfo() {
  try {
    const { width, height, screenShape } = getDeviceInfo()
    return { shape: screenShape === SCREEN_SHAPE_ROUND ? 'round' : 'square', width, height }
  } catch (e) {
    return undefined
  }
}

Page(
  BasePage({
    // executeButtonRequest and the rest of a button's run (utils/button-request.js)
    ...requestMethods,
    // How a button's result shows on this page: its notification style
    showResult(text, pageid, isError, style) {
      layout.notifyResult(text, pageid, isError, style)
    },
    state: {
      config: null,
      isError: false
    },
    onInit(params) {
      // Redrawn after the phone's config changed (replace with 'refreshed'):
      // the watch's copy is the phone's, no need to ask again
      this.refreshed = String(params || '').indexOf('refreshed') !== -1
      this.cachedConfigText = null
      this.reloadTimer = null
      this.reloadWaiting = false
      // ZML BasePage shares `state` between instances of this page (a replace
      // to page/index, as "Load example" does, sees the old one's), and the
      // vm fields below may outlive a run: reset what a run needs here
      // (field-notes.md, "Pages and the app").
      if (LOG_TRACE && (this.state.config || this.state.loadingText)) devLog(`[page] init: the previous instance's state is still here (shared state)`)
      this.state.isError = false
      this.state.config = null
      this.state.configError = false
      this.state.loadingText = null
      this.state.loadingImgAnim = null
      this.pollsCancelled = false
      this.pollTimers = null
      this.pendingImageDone = null
      this.imageQueue = []
      this.imageWaitTimer = null
      this.pressStates = {}
      // The app's file inbox hands the files to this page (handleIncomingFile)
      this.fileHandler = (file) => this.handleIncomingFile(file)
      if (this.globalData) this.globalData.onIncomingFile = this.fileHandler
      this.pendingImagePage = 0
      this.pendingImageRun = null
      this.globalTimeoutMs = undefined
      this.inFlight = 0
    },
    build() {
      this.buildAt = Date.now()
      if (LOG_TRACE) devLog(`[page] build: ${memoryUsage()}`)
      // The buttons from the watch's copy of the config, at once; the phone
      // is asked meanwhile (checkPhoneConfig). Without a usable copy (first
      // start, or none kept): the loading screen while the phone answers.
      const copy = readConfigCopy()
      if (copy) {
        const cfg = parseJSON(copy)
        if (cfg && cfg.pages) {
          this.state.config = cfg
          layout.render(this)
          this.restorePage()
          this.showRunResult()
          infoLog(`[cfg] drawn from the watch's copy (${sizeText(copy.length)}) in ${Date.now() - this.buildAt}ms: ${configCounts(cfg)}` +
            `${this.refreshed ? ', just refreshed' : ''}${LOG_TRACE ? `; ${memoryUsage()}` : ''}`)
          if (this.refreshed) return
          this.cachedConfigText = copy
          this.checkPhoneConfig()
          return
        }
        warnLog(`[cfg] the watch's copy of the config is not usable (${sizeText(copy.length)}): asking the phone`)
        removeConfigCopy()
      }
      this.showLoading()
      this.getDataFromPhone()
    },
    // The phone's config compared with the copy the buttons were drawn from:
    // the same, nothing to do; changed (or removed), the copy is replaced and
    // the page drawn again from it, once no press is running.
    checkPhoneConfig() {
      const t0 = Date.now()
      this.request({ method: 'GET_DATA', params: { screen: screenInfo() } })
        .then(({ result }) => {
          const ms = Date.now() - t0
          const same = result === this.cachedConfigText
          this.cachedConfigText = null
          if (same) {
            if (LOG_TRACE) devLog(`[cfg] the phone's config is the same (${ms}ms)`)
            return
          }
          const cfg = result ? parseJSON(result) : undefined
          if (cfg && cfg.pages) {
            if (!writeConfigCopy(result)) return
          } else {
            // Removed or not usable: drawn from the phone's answer, as with no copy
            removeConfigCopy()
          }
          infoLog(`[cfg] the phone's config changed (${result ? sizeText(result.length) : 'none'}, ${ms}ms): drawing it`)
          this.reloadWhenIdle()
        })
        .catch((error) => {
          warnLog(`[cfg] GET_DATA failed after ${Date.now() - t0}ms: ${errorText(error)}; the watch's copy stays`)
        })
    },
    // A press, an image or a poll still running would be cut short by the
    // redraw: wait for them to end
    pressesRunning() {
      if (this.inFlight > 0 || this.pendingImageDone || (this.imageQueue && this.imageQueue.length)) return true
      const states = this.pressStates || {}
      return Object.keys(states).some((k) => states[k] && states[k].busy)
    },
    reloadWhenIdle() {
      if (this.pressesRunning()) {
        if (!this.reloadWaiting) {
          this.reloadWaiting = true
          if (LOG_TRACE) devLog('[cfg] redraw waits for the presses running')
        }
        this.reloadTimer = setTimeout(() => {
          this.reloadTimer = null
          this.reloadWhenIdle()
        }, RELOAD_RETRY_MS)
        return
      }
      this.rememberPage(currentPage(), 'redraw')
      replace({ url: 'page/index', params: 'refreshed=1' })
    },
    // The buttons page shown, to come back to it: after page/run (an audio
    // button) and after a redraw, the page was drawn again on its first
    // screen. Kept by the app (globalData), used once
    rememberPage(pageIndex, why) {
      if (!this.globalData || !(pageIndex >= 0)) return
      this.globalData.returnPage = { index: pageIndex, why, at: Date.now() }
    },
    // The result of a button that ran on page/run (an audio button), handed
    // back to this page: shown in the button's style, on its page, as any
    // button's result. Used once, within a minute
    showRunResult() {
      const r = this.globalData && this.globalData.runResult
      if (!r) return
      this.globalData.runResult = null
      if (Date.now() - (r.at || 0) > RUN_RESULT_MAX_MS) return
      try {
        layout.notifyResult(r.text, r.page || 0, r.isError, r.style)
      } catch (e) {
        warnLog(`[page] the result from page/run not shown: ${errorText(e)}`)
      }
    },
    restorePage() {
      const r = this.globalData && this.globalData.returnPage
      if (!r) return
      this.globalData.returnPage = null
      // Left by a press long ago (this page wasn't drawn again then): not
      // where the user is now
      if (Date.now() - (r.at || 0) > RETURN_PAGE_MAX_MS) return
      const pages = (this.state.config && this.state.config.pages) || []
      const index = Math.min(r.index, pages.length - 1)
      if (!(index > 0)) return
      try {
        // swipeToIndex counts from 0, getSwiperIndex from 1 (API docs)
        swipeToIndex({ index, animation: SCROLL_ANIMATION_NONE })
        if (LOG_TRACE) devLog(`[page] back on page ${index} (${r.why}): getSwiperIndex() ${getSwiperIndex()}`)
      } catch (e) {
        warnLog(`[page] page ${index} not restored (${r.why}): ${errorText(e)}`)
      }
    },
    // Not ZML's page onReceivedFile: a page defining it gets offFile() in its
    // onDestroy, which detaches the file inbox for the whole app (a replace
    // to this page, as "Load example" does, would have left images dead until
    // a restart; field-notes.md "Messaging", as in zeppamp). The app receives
    // the files (app.js onReceivedFile) and hands them to the page that
    // registered in onInit.
    handleIncomingFile(file) {
      // Called when the side service STARTS pushing a file — the bytes
      // aren't written yet. We must wait for the 'change'→'transferred' event
      // before reading filePath, otherwise we'd show an empty (black) file.
      if (!file) return
      const run = this.pendingImageRun
      const tag = run ? run.tag : '[img]'
      const tIn = Date.now()
      if (LOG_TRACE) devLog(`${tag}: file incoming${file.fileSize ? `, ${sizeText(file.fileSize)}` : ''}${run ? `, ${tIn - run.t0}ms after the press` : ''}`)
      file.on('change', (event) => {
        const state = event.data.readyState
        if (state === 'transferred') {
          this.clearImageSpinner()
          const userData = file.params || {}
          if (LOG_TRACE) devLog(`${tag}: transferred in ${Date.now() - tIn}ms to ${file.filePath}; ${downloadFolderText(file.filePath)}`)
          if (userData.type === 'audio') {
            // EXPERIMENT: audio is played on page/run, which takes the files
            // while open; one here came after it closed
            warnLog(`${tag}: an audio file came to the buttons page: removed`)
            try { rmSync({ path: file.filePath }) } catch (e) { /* not there */ }
          } else if (userData.type === 'image' && typeof layout.showImage === 'function') {
            const memBefore = LOG_TRACE ? memoryUsage() : ''
            let shown
            try {
              shown = layout.showImage(this, file.filePath, this.pendingImagePage || 0)
            } catch (e) {
              warnLog(`${tag}: image not shown: ${errorText(e)}`)
              return
            }
            if (LOG_TRACE) devLog(`${tag}: image ${shown ? `${shown.iw}x${shown.ih} drawn at ${shown.w}x${shown.h}` : 'size unknown'}; before ${memBefore}; after ${memoryUsage()}`)
            infoLog(`${tag}: image shown${run ? ` ${Date.now() - run.t0}ms after the press` : ''}`)
          }
        } else if (state === 'error' || state === 'canceled') {
          this.clearImageSpinner()
          warnLog(`${tag}: image transfer ${state} after ${Date.now() - tIn}ms`)
          // A part left behind would only take room (zeppamp removes them too)
          try { if (file.filePath) rmSync({ path: file.filePath }) } catch (e) { /* not there */ }
          layout.notifyResult(getText('image_failed'), this.pendingImagePage || 0, true, CUSTOM_TOAST)
        } else if (LOG_TRACE) {
          devLog(`${tag}: transfer ${state} at ${Date.now() - tIn}ms`)
        }
      })
    },
    // Images go one at a time, whatever the button: the phone downloads and
    // converts into one fixed file, and its file transfer queue jammed when
    // three images were asked at once (two converted the third's download,
    // a transfer ended in error, and no file reached the watch afterwards).
    // An image press holds its button (animation, queued taps) until its
    // picture is shown or fails; one waiting for an earlier image keeps its
    // animation running meanwhile.
    pressImage(request, pageid, input, label, done) {
      this.imageQueue = this.imageQueue || []
      this.imageQueue.push({ request, pageid, input, label, done })
      if (LOG_TRACE && this.pendingImageDone) devLog(`[btn] ${label}: image waits for the one before it (${this.imageQueue.length} waiting)`)
      this.nextImage()
    },
    nextImage() {
      if (this.pendingImageDone || !this.imageQueue || !this.imageQueue.length) return
      const job = this.imageQueue.shift()
      this.pendingImageDone = () => { job.done(); this.nextImage() }
      this.executeButtonRequest(job.request, job.pageid, job.input, job.label)
    },
    // The image under way is over (shown, failed, or given up on): its button
    // is released and the next image starts. Called from the transfer events,
    // the FETCH_IMAGE answer and the guard timer.
    clearImageSpinner() {
      if (this.imageWaitTimer) {
        clearTimeout(this.imageWaitTimer)
        this.imageWaitTimer = null
      }
      if (this.pendingImageDone) {
        const done = this.pendingImageDone
        this.pendingImageDone = null
        done()
      }
    },
    getDataFromPhone() {
      const t0 = Date.now()
      this.request({
        method: 'GET_DATA',
        params: { screen: screenInfo() }
      })
        .then(
          ({ result }) => {
            const askMs = Date.now() - t0
            // Parsed once here; the layout and every press read state.config
            // (a press used to parse the whole config text again)
            this.state.isError = false
            this.state.config = null
            this.state.configError = false
            if (result) {
              const cfg = parseJSON(result)
              if (cfg && cfg.pages) this.state.config = cfg
              else this.state.configError = true
            }
            if (this.state.config) infoLog(`[cfg] config ${sizeText(result.length)} in ${askMs}ms: ${configCounts(this.state.config)}`)
            else if (this.state.configError) warnLog(`[cfg] config not usable (${sizeText(result.length)}): not JSON or no pages`)
            else infoLog(`[cfg] no config on the phone (${askMs}ms)`)
            // Kept for the next start (drawn from it at once)
            if (this.state.config) writeConfigCopy(result)
            else removeConfigCopy()
            const tRender = Date.now()
            layout.render(this)
            this.restorePage()
            this.showRunResult()
            this.hideLoading()
            if (LOG_TRACE) devLog(`[page] drawn in ${Date.now() - tRender}ms (${Date.now() - this.buildAt}ms since build): ${memoryUsage()}`)
          }
        )
        .catch(
          (error) => {
            warnLog(`[cfg] GET_DATA failed after ${Date.now() - t0}ms: ${errorText(error)}`)
            this.state.isError = true
            layout.render(this)
            this.hideLoading()
          }
        )
    },
    showLoading() {
      this.state.loadingText = createWidget(widget.TEXT, { ...LOADING_TEXT_WIDGET });
      this.state.loadingImgAnim = createWidget(widget.IMG_ANIM, { ...LOADING_IMG_ANIM_WIDGET });
    },
    hideLoading() {
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
        .then((resp) => {
          infoLog('[cfg] example config loaded, reloading the page')
          // The phone answered with it: kept, and drawn from the copy at once
          const text = resp && resp.result
          const kept = !!text && writeConfigCopy(text)
          replace({ url: 'page/index', params: kept ? 'refreshed=1' : undefined })
        })
        .catch((error) => {
          warnLog(`[cfg] LOAD_DEFAULT failed: ${errorText(error)}`)
          this.hideLoading() // reveals the message + button again for a retry
        })
    },
    onDestroy() {
      // Stop any in-flight poll chains: clear the pending timers and flag the
      // loops so an attempt resolving after teardown doesn't reschedule.
      this.pollsCancelled = true
      const polls = this.pollTimers ? this.pollTimers.length : 0
      if (this.pollTimers) {
        this.pollTimers.forEach((t) => clearTimeout(t))
        this.pollTimers = null
      }
      // Best-effort cleanup of any cached expiry-mode session (no background
      // timer on the watch, so logout happens lazily — here or before re-login).
      // Fire-and-forget: a hard app kill may skip this, which is acceptable.
      let logouts = 0
      cachedSessions().forEach((entry) => {
        if (entry && entry.token && entry.mode === 'expiry' && entry.session && entry.session.logout) {
          logouts++
          this.runLogout(entry.session, entry.token, entry.replacements)
        }
      })
      clearSessionCache()
      if (LOG_TRACE) devLog(`[page] closed: ${polls} polls stopped, ${logouts} sessions logged out, ${memoryUsage()}`)
      // Null-guarded: the custom toast is created lazily, so on a page that
      // never showed one these refs are still empty — deleteWidget(undefined)
      // would throw during teardown.
      // The toast's FILL_RECT and TEXT are children of its GROUP: they go with it
      if (layout.refs.customToast) { try { deleteWidget(layout.refs.customToast) } catch (e) { /* gone */ } }
      layout.refs.customToast = layout.refs.customToastFillRect = layout.refs.customToastText = null
      if (typeof layout.hideImage === 'function') layout.hideImage()
      // The press queues and the loading animations go with the page: no
      // queued tap fires after it, no tick outlives it
      this.pressStates = null
      if (this.reloadTimer) { clearTimeout(this.reloadTimer); this.reloadTimer = null }
      // Only our own handler: a next instance may already have set its own
      if (this.globalData && this.globalData.onIncomingFile === this.fileHandler) this.globalData.onIncomingFile = null
      this.pendingImageDone = null
      this.imageQueue = null
      if (this.imageWaitTimer) { clearTimeout(this.imageWaitTimer); this.imageWaitTimer = null }
      if (typeof layout.stopLoaders === 'function') layout.stopLoaders()
      this.pendingImageRun = null
    },
  })
)

// Files of the folder a received file landed in, for a trace line: tells
// whether snapshots pile up on the watch
function downloadFolderText(filePath) {
  try {
    const p = String(filePath || '')
    const dir = p.lastIndexOf('/') > 0 ? p.slice(0, p.lastIndexOf('/')) : 'data://download'
    const names = readdirSync({ path: dir }) || []
    let bytes = 0
    for (const n of names) {
      const st = statSync({ path: dir + '/' + n })
      if (st && st.size) bytes += st.size
    }
    return `${dir}: ${names.length} files, ${sizeText(bytes)}`
  } catch (e) {
    return `folder not read: ${errorText(e)}`
  }
}

// The buttons page on screen, counting from 0 (getSwiperIndex counts from 1),
// or -1 when unknown
function currentPage() {
  try {
    const i = getSwiperIndex()
    return typeof i === 'number' && i >= 1 ? i - 1 : -1
  } catch (e) {
    return -1
  }
}
