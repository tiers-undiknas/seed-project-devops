import { Queue, Worker } from 'bullmq';
import config from '../config/index.js';
import logger from './logger.js';
import { queueActiveJobsGauge } from '../telemetry/metrics.js';

let orderQueue = null;

function getRedisConnectionOptions() {
  const url = new URL(config.redis.url);
  return {
    host: url.hostname || 'localhost',
    port: parseInt(url.port || '6379', 10),
    password: url.password || undefined,
    username: url.username || undefined,
    maxRetriesPerRequest: null
  };
}

export function getOrderQueue() {
  if (!orderQueue) {
    orderQueue = new Queue(config.queue.name, {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        removeOnComplete: {
          count: 1000
        },
        removeOnFail: {
          count: 5000
        }
      }
    });

    orderQueue.on('error', (err) => {
      logger.error({ err: err.message }, 'BullMQ Queue error');
    });
  }
  return orderQueue;
}

export function createOrderWorker(processor) {
  const worker = new Worker(config.queue.name, processor, {
    connection: getRedisConnectionOptions(),
    concurrency: config.queue.concurrency
  });

  worker.on('active', (job) => {
    logger.info({ jobId: job.id, orderId: job.data.orderId }, 'Job started processing');
    if (queueActiveJobsGauge) {
      queueActiveJobsGauge.inc();
    }
  });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, orderId: job.data.orderId }, 'Job completed successfully');
    if (queueActiveJobsGauge) {
      queueActiveJobsGauge.dec();
    }
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, orderId: job?.data?.orderId, err: err.message }, 'Job failed');
    if (queueActiveJobsGauge) {
      queueActiveJobsGauge.dec();
    }
  });

  worker.on('error', (err) => {
    logger.error({ err: err.message }, 'BullMQ Worker error');
  });

  return worker;
}

export async function shutdownQueue() {
  if (orderQueue) {
    logger.info('Closing BullMQ queue...');
    try {
      await orderQueue.close();
      logger.info('BullMQ queue closed');
    } catch (err) {
      logger.error({ err: err.message }, 'Error closing queue');
    }
  }
}

export function setOrderQueue(mockQueue) {
  orderQueue = mockQueue;
}

export default {
  getOrderQueue,
  createOrderWorker,
  shutdownQueue,
  setOrderQueue
};
