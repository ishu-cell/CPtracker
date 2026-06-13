// utils/logger.js — Structured logging utility
// Wraps console with consistent formatting.
// Can be swapped for pino/winston later without changing call sites.

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'] ?? LOG_LEVELS.info;

function formatTimestamp() {
  return new Date().toISOString();
}

export const logger = {
  debug(msg, data = {}) {
    if (currentLevel <= LOG_LEVELS.debug) {
      console.debug(`[${formatTimestamp()}] [DEBUG] ${msg}`, Object.keys(data).length ? data : '');
    }
  },

  info(msg, data = {}) {
    if (currentLevel <= LOG_LEVELS.info) {
      console.log(`[${formatTimestamp()}] [INFO]  ${msg}`, Object.keys(data).length ? data : '');
    }
  },

  warn(msg, data = {}) {
    if (currentLevel <= LOG_LEVELS.warn) {
      console.warn(`[${formatTimestamp()}] [WARN]  ${msg}`, Object.keys(data).length ? data : '');
    }
  },

  error(msg, data = {}) {
    if (currentLevel <= LOG_LEVELS.error) {
      console.error(`[${formatTimestamp()}] [ERROR] ${msg}`, Object.keys(data).length ? data : '');
    }
  },
};
