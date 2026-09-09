import logger from '../infra/logger.js';

export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function errorHandler(err, req, res, _next) {
  const requestId = req.id || req.headers['x-request-id'] || 'unknown';

  // Handle Joi validation error
  if (err.isJoi) {
    logger.warn({ requestId, details: err.details }, 'Validation error');
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message,
        details: err.details?.map((d) => d.message),
        requestId
      }
    });
  }

  // Handle custom AppError
  if (err instanceof AppError) {
    logger.warn({ requestId, code: err.code, statusCode: err.statusCode, err: err.message }, 'Application error');
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId
      }
    });
  }

  // Handle unexpected unhandled errors
  logger.error({ requestId, err: err.message, stack: err.stack }, 'Unhandled internal server error');
  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An internal server error occurred',
      requestId
    }
  });
}

export default errorHandler;
