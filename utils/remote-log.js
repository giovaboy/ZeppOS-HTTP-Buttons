// Lines for the phone's Logs box, written from pages and their modules. They go
// through the app (app.js "Remote log"): its queue outlives the page, and the
// phone scrubs every line (app-side/log.js) before storing it.
//
// Never put in a line: the session token, the typed {input}, headers or bodies.
// Say what happened with numbers (time, size, status, memory). Guard costly
// lines (memory, sizes) with LOG_TRACE so they cost nothing in other builds.
import { logs } from '../config.js'
import { getLogger } from './logger.js'

const logger = getLogger('http-buttons')

export const LOG_TRACE = logs('trace')
export const LOG_INFO = logs('info')

function app() {
  try { return getApp() } catch (e) { return null }
}

// Diagnostics (trace builds)
export function devLog(msg) {
  const a = app()
  if (a && a.devLog) a.devLog(msg)
  else logger.debug(msg)
}

// The main events (info and trace builds)
export function infoLog(msg) {
  const a = app()
  if (a && a.remoteLog) a.remoteLog(msg)
  else logger.info(msg)
}

// A problem: in every build
export function warnLog(msg) {
  const a = app()
  if (a && a.warnLog) a.warnLog(msg)
  else logger.warn(msg)
}
