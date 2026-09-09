import { describe, it, expect } from 'vitest';
import config from '../../src/config/index.js';

describe('Configuration Layer', () => {
  it('should export a frozen configuration object', () => {
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('should provide default application values', () => {
    expect(config.app.port).toBeTypeOf('number');
    expect(config.app.host).toBeTypeOf('string');
    expect(config.app.env).toBeDefined();
  });

  it('should provide database configuration properties', () => {
    expect(config.db.url).toBeTypeOf('string');
    expect(config.db.poolMin).toBeGreaterThanOrEqual(1);
    expect(config.db.poolMax).toBeGreaterThanOrEqual(config.db.poolMin);
    expect(config.db.connectionTimeoutMillis).toBeGreaterThan(0);
    expect(config.db.idleTimeoutMillis).toBeGreaterThan(0);
  });

  it('should provide Redis and queue configurations', () => {
    expect(config.redis.url).toBeTypeOf('string');
    expect(config.queue.name).toBeTypeOf('string');
    expect(config.queue.concurrency).toBeGreaterThan(0);
  });

  it('should provide telemetry metrics configurations', () => {
    expect(config.metrics.enabled).toBe(true);
    expect(config.metrics.prefix).toBeTypeOf('string');
  });
});
