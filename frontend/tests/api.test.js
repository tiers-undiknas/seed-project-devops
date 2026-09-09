import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '../src/api.js';

describe('Frontend API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should call getHealthLive endpoint', async () => {
    const mockData = { status: 'UP', pid: 1234 };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: () => 'application/json'
      },
      json: async () => mockData
    });

    const res = await api.getHealthLive();
    expect(global.fetch).toHaveBeenCalledWith(
      '/healthz/live',
      expect.objectContaining({ headers: expect.any(Object) })
    );
    expect(res).toEqual(mockData);
  });

  it('should call getHealthReady endpoint', async () => {
    const mockData = { status: 'READY' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: () => 'application/json'
      },
      json: async () => mockData
    });

    const res = await api.getHealthReady();
    expect(global.fetch).toHaveBeenCalledWith(
      '/healthz/ready',
      expect.objectContaining({ headers: expect.any(Object) })
    );
    expect(res).toEqual(mockData);
  });

  it('should call createOrder with POST method and serialized payload', async () => {
    const mockOrder = { id: 'test-uuid', total_amount: 1000 };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: () => 'application/json'
      },
      json: async () => ({ data: mockOrder })
    });

    const payload = {
      customer_name: 'Test Customer',
      customer_email: 'test@example.com',
      items: [{ sku: 'SKU1', name: 'Item', price: 1000, quantity: 1 }]
    };

    const res = await api.createOrder(payload);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/orders',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload)
      })
    );
    expect(res.data).toEqual(mockOrder);
  });

  it('should throw structured error on non-ok response', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: {
        get: () => 'application/json'
      },
      json: async () => ({
        error: { message: 'Invalid payload' }
      })
    });

    await expect(api.createOrder({})).rejects.toThrow('Invalid payload');
  });

  it('should invoke diagnostics endpoints properly', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: () => 'application/json'
      },
      json: async () => ({ message: 'ok' })
    });

    await api.triggerCpuStress(1000);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/diagnostics/cpu-stress',
      expect.objectContaining({ method: 'POST' })
    );

    await api.triggerMemoryLeak(20);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/diagnostics/memory-leak',
      expect.objectContaining({ method: 'POST' })
    );

    await api.triggerCrash();
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/diagnostics/crash',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
