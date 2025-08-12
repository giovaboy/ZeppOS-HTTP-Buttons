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

  return {
    log: (message) => {
      if (currentLevel <= levels.log) {
        zosLogger.log(message);
      }
    },
    debug: (message) => {
      if (currentLevel <= levels.debug) {
        zosLogger.debug(message);
      }
    },
    info: (message) => {
      if (currentLevel <= levels.info) {
        zosLogger.info(message);
      }
    },
    warn: (message) => {
      if (currentLevel <= levels.warn) {
        zosLogger.warn(message);
      }
    },
    error: (message) => {
      if (currentLevel <= levels.error) {
        zosLogger.error(message);
      }
    }
  }
};