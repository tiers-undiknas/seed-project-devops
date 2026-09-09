import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import database from '../../src/infra/database.js';
import redis from '../../src/infra/redis.js';
import queue from '../../src/infra/queue.js';
import { createMockPool, createMockRedis, createMockQueue } from '../helpers/mocks.js';
import { queueActiveJobsGauge } from '../../src/telemetry/metrics.js';

describe('Infrastructure Layer (Unit Tests)', () => {
  describe('Database (src/infra/database.js)', () => {
    let mockPool;

    beforeEach(() => {
      mockPool = createMockPool();
      database.setPool(mockPool);
    });

    it('should execute query successfully and log duration', async () => {
      const mockResult = { rows: [{ count: 1 }], rowCount: 1 };
      mockPool.query.mockResolvedValueOnce(mockResult);

      const res = await database.query('SELECT 1', []);
      expect(res).toEqual(mockResult);
      expect(mockPool.query).toHaveBeenCalledWith('SELECT 1', []);
    });

    it('should throw and log when query fails', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Syntax error'));

      await expect(database.query('BAD SQL', [])).rejects.toThrow('Syntax error');
    });

    it('should return healthCheck ok: true on successful ping', async () => {
      const res = await database.healthCheck();
      expect(res.ok).toBe(true);
      expect(res.latencyMs).toBeTypeOf('number');
    });

    it('should return healthCheck ok: false when connection fails', async () => {
      mockPool.connect.mockRejectedValueOnce(new Error('Pool exhausted'));

      const res = await database.healthCheck();
      expect(res.ok).toBe(false);
      expect(res.error).toBe('Pool exhausted');
    });

    it('should gracefully shutdown pool', async () => {
      await database.shutdown();
      expect(mockPool.end).toHaveBeenCalled();
    });

    it('should catch error on shutdown gracefully', async () => {
      mockPool.end.mockRejectedValueOnce(new Error('Error ending pool'));
      await expect(database.shutdown()).resolves.not.toThrow();
    });

    it('should return pool instance via getPool', () => {
      expect(database.getPool()).toBe(mockPool);
    });
  });

  describe('Redis (src/infra/redis.js)', () => {
    let mockClient;

    beforeEach(() => {
      mockClient = createMockRedis();
      redis.setRedisClient(mockClient);
    });

    it('should return healthCheck ok: true when ping succeeds', async () => {
      const res = await redis.healthCheck();
      expect(res.ok).toBe(true);
      expect(res.latencyMs).toBeTypeOf('number');
    });

    it('should connect first if status is wait', async () => {
      mockClient.status = 'wait';
      const res = await redis.healthCheck();
      expect(mockClient.connect).toHaveBeenCalled();
      expect(res.ok).toBe(true);
    });

    it('should return healthCheck ok: false when ping fails', async () => {
      mockClient.ping.mockRejectedValueOnce(new Error('Connection lost'));

      const res = await redis.healthCheck();
      expect(res.ok).toBe(false);
      expect(res.error).toBe('Connection lost');
    });

    it('should quit client on shutdown', async () => {
      await redis.shutdown();
      expect(mockClient.quit).toHaveBeenCalled();
    });

    it('should catch error on shutdown gracefully', async () => {
      mockClient.quit.mockRejectedValueOnce(new Error('Quit failed'));
      await expect(redis.shutdown()).resolves.not.toThrow();
    });

    it('should return redis client via getRedisClient', () => {
      expect(redis.getRedisClient()).toBe(mockClient);
    });
  });

  describe('Queue (src/infra/queue.js)', () => {
    it('should get or initialize order queue', () => {
      const q = queue.getOrderQueue();
      expect(q).toBeDefined();
    });

    it('should close queue gracefully on shutdownQueue', async () => {
      const mockQ = createMockQueue();
      queue.setOrderQueue(mockQ);

      await queue.shutdownQueue();
      expect(mockQ.close).toHaveBeenCalled();
    });

    it('should handle error during queue shutdown gracefully', async () => {
      const mockQ = createMockQueue();
      mockQ.close.mockRejectedValueOnce(new Error('Queue close failure'));
      queue.setOrderQueue(mockQ);

      await expect(queue.shutdownQueue()).resolves.not.toThrow();
    });

    it('should create order worker and wire event listeners', () => {
      const processor = vi.fn().mockResolvedValue({ status: 'confirmed' });
      const worker = queue.createOrderWorker(processor);

      expect(worker).toBeDefined();

      // Test active event
      const incSpy = vi.spyOn(queueActiveJobsGauge, 'inc');
      const decSpy = vi.spyOn(queueActiveJobsGauge, 'dec');

      const mockJob = { id: 'job-1', data: { orderId: 'ord-1' } };

      worker.emit('active', mockJob);
      expect(incSpy).toHaveBeenCalled();

      worker.emit('completed', mockJob);
      expect(decSpy).toHaveBeenCalled();

      worker.emit('failed', mockJob, new Error('Job failed'));
      expect(decSpy).toHaveBeenCalledTimes(2);

      worker.emit('error', new Error('Worker internal error'));

      worker.close();
    });
  });
});
