import { Router } from 'express';
import orderService from '../services/order.service.js';

const router = Router();

/**
 * POST /api/v1/orders
 * Create a new order and queue it for processing
 */
router.post('/', async (req, res, next) => {
  try {
    const order = await orderService.createOrder(req.body);
    res.status(201).json({
      message: 'Order created successfully and queued for processing',
      data: order
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/orders
 * List orders with pagination and status filter
 */
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, status } = req.query;
    const result = await orderService.listOrders({ page, limit, status });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/orders/:id
 * Retrieve order details by ID including item breakdown
 */
router.get('/:id', async (req, res, next) => {
  try {
    const order = await orderService.getOrderById(req.params.id);
    res.status(200).json({
      data: order
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/orders/:id/events
 * Retrieve audit trail / state machine events for an order
 */
router.get('/:id/events', async (req, res, next) => {
  try {
    const order = await orderService.getOrderById(req.params.id);
    res.status(200).json({
      orderId: req.params.id,
      events: order.events || []
    });
  } catch (err) {
    next(err);
  }
});

export default router;
