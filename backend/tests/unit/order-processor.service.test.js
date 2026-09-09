import { describe, it, expect, vi, beforeEach } from 'vitest';
import orderProcessor from '../../src/services/order-processor.service.js';
import orderService from '../../src/services/order.service.js';

describe('Order Processor Service (Worker Job Handler Unit Tests)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should skip processing if order is already confirmed', async () => {
    vi.spyOn(orderService, 'getOrderById').mockResolvedValue({
      id: 'test-order-uuid',
      status: 'confirmed'
    });
    const updateSpy = vi.spyOn(orderService, 'updateOrderStatus');

    const job = { id: 'job-1', data: { orderId: 'test-order-uuid' } };
    const res = await orderProcessor.processOrderJob(job);

    expect(res.skipped).toBe(true);
    expect(res.status).toBe('confirmed');
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('should process order successfully through state machine to confirmed', async () => {
    const mockOrder = {
      id: 'a0000000-0000-4000-a000-000000000001',
      customer_name: 'David Good',
      customer_email: 'david@company.com',
      total_amount: 150000,
      status: 'pending'
    };

    vi.spyOn(orderService, 'getOrderById').mockResolvedValue(mockOrder);
    const updateSpy = vi.spyOn(orderService, 'updateOrderStatus').mockResolvedValue({
      ...mockOrder,
      status: 'confirmed'
    });

    const job = { id: 'job-valid', attemptsMade: 0, data: { orderId: mockOrder.id } };
    const res = await orderProcessor.processOrderJob(job);

    expect(res.success).toBe(true);
    expect(res.status).toBe('confirmed');
    // First update to processing, then update to confirmed
    expect(updateSpy).toHaveBeenCalledTimes(2);
    expect(updateSpy).toHaveBeenNthCalledWith(1, mockOrder.id, 'processing', null, expect.any(Object));
    expect(updateSpy).toHaveBeenNthCalledWith(2, mockOrder.id, 'confirmed', null, expect.any(Object));
  });

  it('should execute failure fallback and mark order failed on simulated failure trigger', async () => {
    const mockOrder = {
      id: 'a0000000-0000-4000-a000-000000000002',
      customer_name: 'Failure Test Customer',
      customer_email: 'fail-trigger@example.com',
      total_amount: 250000,
      status: 'pending'
    };

    vi.spyOn(orderService, 'getOrderById').mockResolvedValue(mockOrder);
    const updateSpy = vi.spyOn(orderService, 'updateOrderStatus').mockResolvedValue({
      ...mockOrder,
      status: 'failed'
    });

    const job = { id: 'job-fail', attemptsMade: 0, data: { orderId: mockOrder.id } };
    const res = await orderProcessor.processOrderJob(job);

    expect(res.success).toBe(false);
    expect(res.status).toBe('failed');
    expect(res.reason).toContain('Payment declined');
    // First to processing, then to failed with reason
    expect(updateSpy).toHaveBeenCalledTimes(2);
    expect(updateSpy).toHaveBeenNthCalledWith(2, mockOrder.id, 'failed', expect.stringContaining('Payment declined'), expect.any(Object));
  });

  it('should throw and record error on unhandled exception in order lookup', async () => {
    vi.spyOn(orderService, 'getOrderById').mockRejectedValue(new Error('DB Connection Refused'));

    const job = { id: 'job-err', data: { orderId: 'bad-id' } };
    await expect(orderProcessor.processOrderJob(job)).rejects.toThrow('DB Connection Refused');
  });
});
