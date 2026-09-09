import { v4 as uuidv4 } from 'uuid';
import pinoHttp from 'pino-http';
import logger from '../infra/logger.js';

/**
 * Middleware to generate/propagate X-Request-ID header
 * and configure structured HTTP request logging via pino-http.
 */
export function requestIdMiddleware(req, res, next) {
  const requestId = req.headers['x-request-id'] || uuidv4();
  req.id = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => req.headers['x-request-id'] || req.id || uuidv4(),
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} completed with status ${res.statusCode}`;
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} failed with error: ${err.message}`;
  },
  customAttributeKeys: {
    req: 'request',
    res: 'response',
    err: 'error',
    responseTime: 'latencyMs'
  },
  // Do not log healthz probes to prevent noisy logs in Kubernetes/DevOps environments
  autoLogging: {
    ignore: (req) => req.url && req.url.startsWith('/healthz')
  }
});

export default {
  requestIdMiddleware,
  httpLogger
};
