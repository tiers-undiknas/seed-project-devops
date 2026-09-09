import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import createApp from '../../src/app.js';
import database from '../../src/infra/database.js';
import redis from '../../src/infra/redis.js';

describe('Health & Operational Probes API (Integration)', () => {
  let app;

  beforeEach(() => {
    vi.restoreAllMocks();
    app = createApp();
  });

  describe('GET /healthz/live', () => {
    it('should return HTTP 200 and process status UP', async () => {
      const res = await request(app).get('/healthz/live');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.body.uptimeSeconds).toBeTypeOf('number');
      expect(res.body.pid).toBeTypeOf('number');
      expect(res.body.memory).toHaveProperty('heapUsedMb');
    });
  });

  describe('GET /healthz/ready', () => {
    it('should return HTTP 200 when both PostgreSQL and Redis are ready', async () => {
      vi.spyOn(database, 'healthCheck').mockResolvedValue({ ok: true, latencyMs: 3 });
      vi.spyOn(redis, 'healthCheck').mockResolvedValue({ ok: true, latencyMs: 2 });

      const res = await request(app).get('/healthz/ready');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('READY');
      expect(res.body.dependencies.database.status).toBe('UP');
      expect(res.body.dependencies.redis.status).toBe('UP');
    });

    it('should return HTTP 503 when PostgreSQL is down', async () => {
      vi.spyOn(database, 'healthCheck').mockResolvedValue({
        ok: false,
        latencyMs: 15,
        error: 'Connection refused'
      });
      vi.spyOn(redis, 'healthCheck').mockResolvedValue({ ok: true, latencyMs: 2 });

      const res = await request(app).get('/healthz/ready');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('NOT_READY');
      expect(res.body.dependencies.database.status).toBe('DOWN');
      expect(res.body.dependencies.database.error).toBe('Connection refused');
      expect(res.body.dependencies.redis.status).toBe('UP');
    });

    it('should return HTTP 503 when Redis is down', async () => {
      vi.spyOn(database, 'healthCheck').mockResolvedValue({ ok: true, latencyMs: 2 });
      vi.spyOn(redis, 'healthCheck').mockResolvedValue({
        ok: false,
        latencyMs: 20,
        error: 'Redis connection timeout'
      });

      const res = await request(app).get('/healthz/ready');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('NOT_READY');
      expect(res.body.dependencies.database.status).toBe('UP');
      expect(res.body.dependencies.redis.status).toBe('DOWN');
    });
  });
});
