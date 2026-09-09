import { describe, it, expect, vi } from 'vitest';
import { errorHandler, AppError } from '../../src/middleware/error-handler.js';
import { requestIdMiddleware, httpLogger } from '../../src/middleware/request-id.js';

describe('Middleware Layer (Unit Tests)', () => {
  describe('Error Handler (src/middleware/error-handler.js)', () => {
    it('should handle unhandled internal server errors with HTTP 500', () => {
      const genericError = new Error('Unexpected crash');
      const req = { id: 'test-req-id' };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };
      const next = vi.fn();

      errorHandler(genericError, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An internal server error occurred',
          requestId: 'test-req-id'
        }
      });
    });

    it('should handle Joi validation errors with HTTP 400', () => {
      const joiError = new Error('"customer_email" must be a valid email');
      joiError.isJoi = true;
      joiError.details = [{ message: '"customer_email" must be a valid email' }];

      const req = { headers: {} };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };
      const next = vi.fn();

      errorHandler(joiError, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR'
          })
        })
      );
    });

    it('should handle custom AppError', () => {
      const appErr = new AppError('Custom message', 409, 'CONFLICT', { reason: 'dup' });
      const req = { id: 'req-409' };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };
      const next = vi.fn();

      errorHandler(appErr, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'CONFLICT',
          message: 'Custom message',
          details: { reason: 'dup' },
          requestId: 'req-409'
        }
      });
    });
  });

  describe('Request ID Middleware (src/middleware/request-id.js)', () => {
    it('should generate a new UUID if x-request-id is missing', () => {
      const req = { headers: {} };
      const res = { setHeader: vi.fn() };
      const next = vi.fn();

      requestIdMiddleware(req, res, next);

      expect(req.id).toBeDefined();
      expect(res.setHeader).toHaveBeenCalledWith('x-request-id', req.id);
      expect(next).toHaveBeenCalled();
    });

    it('should retain existing x-request-id if provided', () => {
      const req = { headers: { 'x-request-id': 'incoming-id-123' } };
      const res = { setHeader: vi.fn() };
      const next = vi.fn();

      requestIdMiddleware(req, res, next);

      expect(req.id).toBe('incoming-id-123');
      expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'incoming-id-123');
      expect(next).toHaveBeenCalled();
    });
  });
});
