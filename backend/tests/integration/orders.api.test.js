import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import createApp from '../../src/app.js';
import database from '../../src/infra/database.js';
import queue from '../../src/infra/queue.js';
import { createMockPool, createMockQueue } from '../helpers/mocks.js';

describe('Orders & Telemetry API (Integration)', () => {
  let app;
  let mockPool;
  let mockQueue;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockPool = createMockPool();
    mockQueue = createMockQueue();
    database.setPool(mockPool);
    queue.setOrderQueue(mockQueue);
    app = createApp();
  });

  describe('POST /api/v1/orders', () => {
    it('should return 400 with structured validation error when payload is missing fields', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          customer_name: '' // Missing email & items
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toBeInstanceOf(Array);
      expect(res.headers['x-request-id']).toBeDefined();
    });

    it('should return 201 when order is successfully created', async () => {
      const mockOrder = {
        id: '33333333-3333-4333-a333-333333333333',
        customer_name: 'Sarah DevOps',
        customer_email: 'sarah@example.com',
        total_amount: 166500,
        status: 'pending',
        created_at: new Date().toISOString()
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [mockOrder] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          customer_name: 'Sarah DevOps',
          customer_email: 'sarah@example.com',
          items: [
            { sku: 'INFRA-01', name: 'Virtual Machine', price: 150000, quantity: 1 }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toContain('Order created successfully');
      expect(res.body.data.id).toBe(mockOrder.id);
      expect(res.headers['x-request-id']).toBeDefined();
    });
  });

  describe('GET /api/v1/orders', () => {
    it('should return 200 with paginated order list', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: '44444444-4444-4444-a444-444444444444',
              customer_name: 'Alice',
              status: 'confirmed'
            }
          ]
        });

      const res = await request(app).get('/api/v1/orders?page=1&limit=5');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination.total).toBe(10);
      expect(res.body.pagination.page).toBe(1);
    });
  });

  describe('GET /api/v1/orders/:id', () => {
    it('should return 400 for invalid UUID format', async () => {
      const res = await request(app).get('/api/v1/orders/not-a-uuid');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_UUID');
    });

    it('should return 200 with order details and events', async () => {
      const targetId = '55555555-5555-4555-a555-555555555555';
      const mockOrder = {
        id: targetId,
        customer_name: 'Charlie',
        status: 'pending'
      };
      const mockEvents = [
        { id: 'e1', event_type: 'ORDER_CREATED', created_at: new Date().toISOString() }
      ];

      mockPool.query
        .mockResolvedValueOnce({ rows: [mockOrder] })
        .mockResolvedValueOnce({ rows: mockEvents });

      const res = await request(app).get(`/api/v1/orders/${targetId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(targetId);
      expect(res.body.data.events).toHaveLength(1);
    });
  });

  describe('GET /api/v1/orders/:id/events', () => {
    it('should return 200 with events list for given order ID', async () => {
      const targetId = '66666666-6666-4666-a666-666666666666';
      const mockOrder = {
        id: targetId,
        customer_name: 'Eve'
      };
      const mockEvents = [
        { id: 'ev-1', event_type: 'ORDER_CREATED' },
        { id: 'ev-2', event_type: 'STATUS_PROCESSING' }
      ];

      mockPool.query
        .mockResolvedValueOnce({ rows: [mockOrder] })
        .mockResolvedValueOnce({ rows: mockEvents });

      const res = await request(app).get(`/api/v1/orders/${targetId}/events`);

      expect(res.status).toBe(200);
      expect(res.body.orderId).toBe(targetId);
      expect(res.body.events).toHaveLength(2);
    });
  });

  describe('GET /metrics (Prometheus Telemetry)', () => {
    it('should return 200 with prometheus plaintext metrics', async () => {
      const res = await request(app).get('/metrics');

      expect(res.status).toBe(200);
      expect(res.text).toContain('ope_http_request_duration_seconds');
      expect(res.text).toContain('ope_orders_created_total');
      expect(res.text).toContain('process_cpu_user_seconds_total');
    });
  });

  describe('404 Catch-all handler', () => {
    it('should return structured 404 error for unknown routes', async () => {
      const res = await request(app).get('/api/v1/non-existent-endpoint');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});
