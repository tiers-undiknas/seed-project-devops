import database from '../infra/database.js';
import orderService from './order.service.js';
import { orderProcessingDurationHistogram } from '../telemetry/metrics.js';
import logger from '../infra/logger.js';

/**
 * Process an order job from BullMQ
 */
export async function processOrderJob(job) {
  const { orderId } = job.data;
  const start = Date.now();

  logger.info({ orderId, jobId: job.id }, 'Worker: Starting order processing');

  try {
    // 1. Fetch order
    const order = await orderService.getOrderById(orderId);

    // If order is already completed or cancelled, skip
    if (order.status === 'confirmed' || order.status === 'failed') {
      logger.warn({ orderId, status: order.status }, 'Worker: Order already resolved, skipping');
      return { skipped: true, status: order.status };
    }

    // 2. Mark as processing
    await orderService.updateOrderStatus(orderId, 'processing', null, {
      workerId: process.pid,
      jobId: job.id
    });

    // 3. Simulated inventory & payment processing latency (100ms - 500ms in normal run, or 0ms in tests)
    const simulatedDelay = process.env.NODE_ENV === 'test' ? 10 : 300;
    await new Promise((resolve) => setTimeout(resolve, simulatedDelay));

    // 4. Check for simulated failure trigger (useful for testing & chaos scenarios)
    const isSimulatedFailure =
      order.customer_email?.includes('fail') ||
      order.customer_name?.toLowerCase().includes('fail') ||
      Number(order.total_amount) > 100000000; // Limit for demo

    if (isSimulatedFailure) {
      const reason = 'Payment declined: Insufficient funds or fraud check triggered';
      await orderService.updateOrderStatus(orderId, 'failed', reason, {
        step: 'PAYMENT_GATEWAY',
        attempt: job.attemptsMade + 1
      });

      const durationSeconds = (Date.now() - start) / 1000;
      if (orderProcessingDurationHistogram) {
        orderProcessingDurationHistogram.observe({ status: 'failed' }, durationSeconds);
      }

      logger.warn({ orderId, reason }, 'Worker: Order processing failed (simulated)');
      return { success: false, status: 'failed', reason };
    }

    // 5. Success flow: Mark as confirmed
    await orderService.updateOrderStatus(orderId, 'confirmed', null, {
      paymentReference: `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      processedBy: `worker-${process.pid}`
    });

    const durationSeconds = (Date.now() - start) / 1000;
    if (orderProcessingDurationHistogram) {
      orderProcessingDurationHistogram.observe({ status: 'confirmed' }, durationSeconds);
    }

    logger.info({ orderId, durationSeconds }, 'Worker: Order successfully confirmed');
    return { success: true, status: 'confirmed', durationSeconds };
  } catch (err) {
    const durationSeconds = (Date.now() - start) / 1000;
    if (orderProcessingDurationHistogram) {
      orderProcessingDurationHistogram.observe({ status: 'error' }, durationSeconds);
    }
    logger.error({ orderId, err: err.message }, 'Worker: Unexpected error during order processing');
    throw err;
  }
}

export default {
  processOrderJob
};
