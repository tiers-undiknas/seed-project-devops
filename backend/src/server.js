import createApp from './app.js';
import config from './config/index.js';
import logger from './infra/logger.js';
import database from './infra/database.js';
import redis from './infra/redis.js';
import { shutdownQueue } from './infra/queue.js';
import { runMigrations } from './db/migrate.js';

let server;

async function startServer() {
  try {
    logger.info({ env: config.app.env }, 'Starting Order Processing Engine API Server...');

    // Run database migrations on startup if not in test
    if (config.app.env !== 'test') {
      try {
        await runMigrations();
      } catch (err) {
        logger.error({ err: err.message }, 'Failed to run migrations on startup');
        // Do not immediately exit; let readiness probe report unhealthy state
      }
    }

    const app = createApp();
    server = app.listen(config.app.port, config.app.host, () => {
      logger.info(
        {
          port: config.app.port,
          host: config.app.host,
          pid: process.pid
        },
        `HTTP API Server is actively listening on http://${config.app.host}:${config.app.port}`
      );
    });

    setupGracefulShutdown();
  } catch (err) {
    logger.fatal({ err: err.message, stack: err.stack }, 'Fatal error during server startup');
    process.exit(1);
  }
}

function setupGracefulShutdown() {
  let isShuttingDown = false;

  async function handleSignal(signal) {
    if (isShuttingDown) {
      logger.warn('Forced shutdown requested. Exiting immediately.');
      process.exit(1);
    }
    isShuttingDown = true;
    logger.info({ signal }, `Received ${signal}. Initiating graceful shutdown...`);

    // 1. Stop accepting new HTTP requests
    if (server) {
      server.close((err) => {
        if (err) {
          logger.error({ err: err.message }, 'Error closing HTTP server');
        } else {
          logger.info('HTTP server stopped accepting new connections');
        }
      });
    }

    // Set a force-exit safety timeout (10 seconds)
    const forceExitTimeout = setTimeout(() => {
      logger.error('Graceful shutdown timed out after 10s. Forcing exit.');
      process.exit(1);
    }, 10000);
    forceExitTimeout.unref();

    try {
      // 2. Close BullMQ queue producer
      await shutdownQueue();

      // 3. Drain PostgreSQL connection pool
      await database.shutdown();

      // 4. Disconnect Redis
      await redis.shutdown();

      logger.info('Graceful shutdown completed successfully. Process exiting.');
      process.exit(0);
    } catch (err) {
      logger.error({ err: err.message }, 'Error during graceful shutdown sequence');
      process.exit(1);
    }
  }

  process.on('SIGTERM', () => handleSignal('SIGTERM'));
  process.on('SIGINT', () => handleSignal('SIGINT'));

  process.on('unhandledRejection', (reason, promise) => {
    logger.error({ reason, promise }, 'Unhandled Rejection at Promise');
  });

  process.on('uncaughtException', (err) => {
    logger.fatal({ err: err.message, stack: err.stack }, 'Uncaught Exception');
    process.exit(1);
  });
}

startServer();

export { server };
