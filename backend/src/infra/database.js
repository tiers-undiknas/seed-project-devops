import pg from 'pg';
import config from '../config/index.js';
import logger from './logger.js';

const { Pool } = pg;

let pool = new Pool({
  connectionString: config.db.url,
  min: config.db.poolMin,
  max: config.db.poolMax,
  connectionTimeoutMillis: config.db.connectionTimeoutMillis,
  idleTimeoutMillis: config.db.idleTimeoutMillis
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle PostgreSQL client');
});

/**
 * Execute SQL query with logging and timing
 */
export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug({ query: text, rowCount: res.rowCount, durationMs: duration }, 'Executed DB query');
    return res;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error({ query: text, durationMs: duration, err: error.message }, 'DB query error');
    throw error;
  }
}

/**
 * Health check probe for PostgreSQL
 */
export async function healthCheck() {
  const start = Date.now();
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      const latencyMs = Date.now() - start;
      return { ok: true, latencyMs };
    } finally {
      client.release();
    }
  } catch (err) {
    const latencyMs = Date.now() - start;
    return { ok: false, latencyMs, error: err.message };
  }
}

/**
 * Graceful pool drain
 */
export async function shutdown() {
  logger.info('Draining PostgreSQL pool...');
  try {
    await pool.end();
    logger.info('PostgreSQL pool drained successfully');
  } catch (err) {
    logger.error({ err: err.message }, 'Error closing PostgreSQL pool');
  }
}

/**
 * Allow setting pool instance (useful for unit/integration testing mocks)
 */
export function setPool(newPool) {
  pool = newPool;
}

export function getPool() {
  return pool;
}

export default {
  query,
  healthCheck,
  shutdown,
  setPool,
  getPool
};
