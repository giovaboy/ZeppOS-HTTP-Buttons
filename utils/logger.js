import { log } from '@zos/utils';

const LOG_LEVEL = 'warn';

const levels = {
  debug: 0,
  log: 1,
  info: 2,
  warn: 3,
  error: 4
};

const currentLevel = levels[LOG_LEVEL] || levels.debug;

export const getLogger = (name) => {
  const zosLogger = log.getLogger(name);

  const logMessage = (level, args) => {
    const message = args.map(arg =>
      typeof arg === 'object' && arg !== null ? JSON.stringify(arg) : String(arg)
    ).join(' ');

    switch (level) {
      case levels.log:
        zosLogger.log(message);
        break;
      case levels.debug:
        zosLogger.debug(message);
        break;
      case levels.info:
        zosLogger.info(message);
        break;
      case levels.warn:
        zosLogger.warn(message);
        break;
      case levels.error:
        zosLogger.error(message);
        break;
      default:
        zosLogger.info(`Unknown log level: ${level}. Message: ${message}`);
    }
  };

  return {
    log: (...args) => {
      if (currentLevel <= levels.log) {
        logMessage(levels.log, args);
      }
    },
    debug: (...args) => {
      if (currentLevel <= levels.debug) {
        logMessage(levels.debug, args);
      }
    },
    info: (...args) => {
      if (currentLevel <= levels.info) {
        logMessage(levels.info, args);
      }
    },
    warn: (...args) => {
      if (currentLevel <= levels.warn) {
        logMessage(levels.warn, args);
      }
    },
    error: (...args) => {
      if (currentLevel <= levels.error) {
        logMessage(levels.error, args);
      }
    }
  }
};