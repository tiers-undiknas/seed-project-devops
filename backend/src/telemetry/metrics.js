import client from 'prom-client';
import config from '../config/index.js';

const register = new client.Registry();

if (config.metrics.enabled) {
  client.collectDefaultMetrics({
    register,
    prefix: config.metrics.prefix
  });
}

export const httpRequestDurationHistogram = new client.Histogram({
  name: `${config.metrics.prefix}http_request_duration_seconds`,
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register]
});

export const ordersCreatedCounter = new client.Counter({
  name: `${config.metrics.prefix}orders_created_total`,
  help: 'Total number of orders created',
  labelNames: ['status'],
  registers: [register]
});

export const orderProcessingDurationHistogram = new client.Histogram({
  name: `${config.metrics.prefix}order_processing_duration_seconds`,
  help: 'Duration of order processing in background worker in seconds',
  labelNames: ['status'],
  buckets: [0.1, 0.5, 1, 2, 3, 5, 10],
  registers: [register]
});

export const queueActiveJobsGauge = new client.Gauge({
  name: `${config.metrics.prefix}queue_active_jobs`,
  help: 'Number of currently active jobs in the queue',
  registers: [register]
});

export async function getMetrics() {
  return register.metrics();
}

export function getContentType() {
  return register.contentType;
}

export { register };

export default {
  register,
  getMetrics,
  getContentType,
  httpRequestDurationHistogram,
  ordersCreatedCounter,
  orderProcessingDurationHistogram,
  queueActiveJobsGauge
};
