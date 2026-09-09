import Joi from 'joi';
import database from '../infra/database.js';
import { getOrderQueue } from '../infra/queue.js';
import { ordersCreatedCounter } from '../telemetry/metrics.js';
import { AppError } from '../middleware/error-handler.js';
import logger from '../infra/logger.js';

export const TAX_RATE = 0.11; // 11% PPN

export const orderItemSchema = Joi.object({
  sku: Joi.string().trim().required(),
  name: Joi.string().trim().required(),
  price: Joi.number().positive().precision(2).required(),
  quantity: Joi.number().integer().positive().required()
});

export const createOrderSchema = Joi.object({
  customer_name: Joi.string().trim().min(2).max(255).required(),
  customer_email: Joi.string().email().required(),
  items: Joi.array().items(orderItemSchema).min(1).required()
});

/**
 * Pure calculation function for order total including tax
 */
export function calculateTotal(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { subtotal: 0, tax: 0, total: 0 };
  }

  const subtotal = items.reduce((sum, item) => {
    const price = Number(item.price);
    const quantity = Number(item.quantity);
    if (isNaN(price) || isNaN(quantity) || price < 0 || quantity < 0) {
      throw new AppError('Invalid price or quantity in order items', 400, 'INVALID_ITEM_CALCULATION');
    }
    return sum + price * quantity;
  }, 0);

  const subtotalRounded = Math.round(subtotal * 100) / 100;
  const tax = Math.round(subtotalRounded * TAX_RATE * 100) / 100;
  const total = Math.round((subtotalRounded + tax) * 100) / 100;

  return {
    subtotal: subtotalRounded,
    tax,
    total
  };
}

/**
 * Create order and enqueue processing job
 */
export async function createOrder(payload) {
  const { error, value } = createOrderSchema.validate(payload, { abortEarly: false });
  if (error) {
    throw error;
  }

  const { subtotal, tax, total } = calculateTotal(value.items);

  const enrichedItems = {
    line_items: value.items,
    breakdown: { subtotal, tax, tax_rate: TAX_RATE }
  };

  // Insert order
  const orderInsertQuery = `
    INSERT INTO orders (customer_name, customer_email, items, total_amount, status)
    VALUES ($1, $2, $3, $4, 'pending')
    RETURNING *;
  `;

  const orderRes = await database.query(orderInsertQuery, [
    value.customer_name,
    value.customer_email,
    JSON.stringify(enrichedItems),
    total
  ]);

  const order = orderRes.rows[0];

  // Insert initial event
  const eventInsertQuery = `
    INSERT INTO order_events (order_id, event_type, payload)
    VALUES ($1, 'ORDER_CREATED', $2);
  `;
  await database.query(eventInsertQuery, [order.id, JSON.stringify({ total, itemsCount: value.items.length })]);

  // Enqueue job to Redis via BullMQ
  try {
    const queue = getOrderQueue();
    await queue.add(
      'process-order',
      {
        orderId: order.id,
        customerEmail: order.customer_email,
        total: order.total_amount
      },
      {
        jobId: `order-${order.id}`
      }
    );
  } catch (err) {
    logger.error({ orderId: order.id, err: err.message }, 'Failed to enqueue order processing job');
    // We do not roll back the order creation, but mark it for retry or audit
  }

  // Update telemetry
  if (ordersCreatedCounter) {
    ordersCreatedCounter.inc({ status: 'pending' });
  }

  logger.info({ orderId: order.id, total, status: order.status }, 'New order created and enqueued');

  return order;
}

/**
 * Retrieve order by UUID
 */
export async function getOrderById(id) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    throw new AppError('Invalid order ID format. Must be a valid UUID.', 400, 'INVALID_UUID');
  }

  const orderQuery = 'SELECT * FROM orders WHERE id = $1;';
  const orderRes = await database.query(orderQuery, [id]);

  if (orderRes.rows.length === 0) {
    throw new AppError(`Order with ID ${id} not found`, 404, 'ORDER_NOT_FOUND');
  }

  const order = orderRes.rows[0];

  // Fetch associated events
  const eventsQuery = 'SELECT * FROM order_events WHERE order_id = $1 ORDER BY created_at ASC;';
  const eventsRes = await database.query(eventsQuery, [id]);

  return {
    ...order,
    events: eventsRes.rows
  };
}

/**
 * List orders with pagination and filtering
 */
export async function listOrders({ page = 1, limit = 10, status } = {}) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  const params = [];

  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countQuery = `SELECT COUNT(*) FROM orders ${whereClause};`;
  const countRes = await database.query(countQuery, params);
  const total = parseInt(countRes.rows[0].count, 10);

  // Get paginated data
  const dataParams = [...params, limitNum, offset];
  const dataQuery = `
    SELECT * FROM orders
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length};
  `;
  const dataRes = await database.query(dataQuery, dataParams);

  return {
    data: dataRes.rows,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    }
  };
}

/**
 * Update order status and log event
 */
export async function updateOrderStatus(id, status, failureReason = null, payload = {}) {
  const query = `
    UPDATE orders
    SET status = $1, failure_reason = $2, updated_at = NOW()
    WHERE id = $3
    RETURNING *;
  `;
  const res = await database.query(query, [status, failureReason, id]);

  if (res.rows.length === 0) {
    throw new AppError(`Order with ID ${id} not found`, 404, 'ORDER_NOT_FOUND');
  }

  // Insert event
  const eventQuery = `
    INSERT INTO order_events (order_id, event_type, payload)
    VALUES ($1, $2, $3);
  `;
  await database.query(eventQuery, [id, `STATUS_${status.toUpperCase()}`, JSON.stringify({ failureReason, ...payload })]);

  return res.rows[0];
}

export default {
  calculateTotal,
  createOrder,
  getOrderById,
  listOrders,
  updateOrderStatus,
  TAX_RATE
};
