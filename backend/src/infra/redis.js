import Redis from 'ioredis';
import config from '../config/index.js';
import logger from './logger.js';

let redisClient = new Redis(config.redis.url, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 2000);
    return delay;
  }
});

redisClient.on('connect', () => {
  logger.info('Connected to Redis');
});

redisClient.on('error', (err) => {
  logger.error({ err: err.message }, 'Redis client error');
});

/**
 * Health check probe for Redis
 */
export async function healthCheck() {
  const start = Date.now();
  try {
    if (redisClient.status === 'wait') {
      await redisClient.connect();
    }
    const pong = await redisClient.ping();
    const latencyMs = Date.now() - start;
    const ok = pong === 'PONG';
    return { ok, latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - start;
    return { ok: false, latencyMs, error: err.message };
  }
}

/**
 * Graceful Redis disconnect
 */
export async function shutdown() {
  logger.info('Disconnecting Redis client...');
  try {
    if (redisClient.status !== 'end') {
      await redisClient.quit();
    }
    logger.info('Redis client disconnected');
  } catch (err) {
    logger.error({ err: err.message }, 'Error disconnecting Redis');
  }
}

export function setRedisClient(client) {
  redisClient = client;
}

export function getRedisClient() {
  return redisClient;
}

export default {
  healthCheck,
  shutdown,
  setRedisClient,
  getRedisClient
};
