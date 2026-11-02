// Build switches for the whole app: watch, side service, settings page.
// Shared rule for every ZeppOS project: ../_shared/zeppos-ai-doc/logging.md

// Developer build: the Logs box may show server addresses (whole URLs, query
// values and known secrets still scrubbed). Never in a build given to others
export const DEV = false

// How much goes to the phone's Logs box (settings page):
//   'trace' everything, the diagnostic lines too (devLog / _vlog): test builds
//   'info'  the main events (a press and its outcome) and the problems
//   'warn'  only the problems: public releases (the box stays, for users to
//           copy an error into a report)
export const LOG_LEVEL = 'trace'

const LEVELS = { trace: 0, info: 1, warn: 2 }

// Lines of `level` are logged in this build
export const logs = (level) => LEVELS[level] >= LEVELS[LOG_LEVEL]

// Addresses in the Logs box: developer builds with trace only. Passwords,
// tokens, header secrets, variable values: never, in any build (see
// app-side/log.js scrubLog)
export const logsPrivate = () => DEV && logs('trace')
