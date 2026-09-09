import pino from 'pino';
import config from '../config/index.js';

export const logger = pino({
  level: config.app.logLevel,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label })
  },
  base: {
    service: 'order-processing-engine',
    env: config.app.env
  }
});

export default logger;
