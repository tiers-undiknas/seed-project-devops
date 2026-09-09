import config from './config/index.js';
import logger from './infra/logger.js';
import database from './infra/database.js';
import redis from './infra/redis.js';
import { createOrderWorker } from './infra/queue.js';
import { processOrderJob } from './services/order-processor.service.js';

let worker = null;

async function startWorker() {
  try {
    logger.info(
      {
        env: config.app.env,
        queue: config.queue.name,
        concurrency: config.queue.concurrency,
        pid: process.pid
      },
      'Starting Order Processing Background Worker...'
    );

    worker = createOrderWorker(processOrderJob);

    logger.info('Worker initialized and listening for jobs');

    setupGracefulShutdown();
  } catch (err) {
    logger.fatal({ err: err.message, stack: err.stack }, 'Fatal error during worker startup');
    process.exit(1);
  }
}

function setupGracefulShutdown() {
  let isShuttingDown = false;

  async function handleSignal(signal) {
    if (isShuttingDown) {
      logger.warn('Forced worker shutdown requested. Exiting immediately.');
      process.exit(1);
    }
    isShuttingDown = true;
    logger.info({ signal }, `Received ${signal}. Gracefully stopping worker...`);

    const forceExitTimeout = setTimeout(() => {
      logger.error('Worker shutdown timed out after 15s. Forcing exit.');
      process.exit(1);
    }, 15000);
    forceExitTimeout.unref();

    try {
      // 1. Wait for currently processing jobs to finish
      if (worker) {
        logger.info('Waiting for in-flight jobs to complete...');
        await worker.close();
        logger.info('Worker closed gracefully');
      }

      // 2. Drain database pool
      await database.shutdown();

      // 3. Disconnect Redis
      await redis.shutdown();

      logger.info('Worker shutdown completed. Process exiting.');
      process.exit(0);
    } catch (err) {
      logger.error({ err: err.message }, 'Error during worker graceful shutdown');
      process.exit(1);
    }
  }

  process.on('SIGTERM', () => handleSignal('SIGTERM'));
  process.on('SIGINT', () => handleSignal('SIGINT'));

  process.on('unhandledRejection', (reason, promise) => {
    logger.error({ reason, promise }, 'Unhandled Rejection in Worker');
  });

  process.on('uncaughtException', (err) => {
    logger.fatal({ err: err.message, stack: err.stack }, 'Uncaught Exception in Worker');
    process.exit(1);
  });
}

startWorker();

export { worker };
