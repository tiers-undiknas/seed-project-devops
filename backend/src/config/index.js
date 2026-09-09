/**
 * Application Configuration Module
 * 100% Stateless & 12-Factor App compliant - strictly read from environment variables.
 */

function validateEnv() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isTest = nodeEnv === 'test';

  if (!isTest) {
    const requiredVars = ['DATABASE_URL', 'REDIS_URL'];
    const missing = requiredVars.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`[Config Error] Missing required environment variables: ${missing.join(', ')}`);
    }
  }
}

validateEnv();

const config = Object.freeze({
  app: {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info')
  },
  db: {
    url: process.env.DATABASE_URL || 'postgresql://devops_user:devops_pass@localhost:5432/order_processing',
    poolMin: parseInt(process.env.DB_POOL_MIN || '2', 10),
    poolMax: parseInt(process.env.DB_POOL_MAX || '10', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '5000', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10)
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  },
  queue: {
    name: process.env.QUEUE_NAME || 'order-processing',
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5', 10)
  },
  metrics: {
    enabled: process.env.METRICS_ENABLED !== 'false',
    prefix: process.env.METRICS_PREFIX || 'ope_'
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*'
  }
});

export default config;
