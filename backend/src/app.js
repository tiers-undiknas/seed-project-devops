import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import config from './config/index.js';
import { requestIdMiddleware, httpLogger } from './middleware/request-id.js';
import metricsMiddleware from './middleware/metrics.middleware.js';
import errorHandler from './middleware/error-handler.js';
import { getMetrics, getContentType } from './telemetry/metrics.js';

// Route imports
import healthRoutes from './routes/health.routes.js';
import diagnosticsRoutes from './routes/diagnostics.routes.js';
import orderRoutes from './routes/order.routes.js';

export function createApp() {
  const app = express();

  // Basic security and performance middlewares
  app.use(helmet());
  app.use(
    cors({
      origin: config.cors.origin,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id']
    })
  );
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Observability & Tracing middlewares
  app.use(requestIdMiddleware);
  if (config.app.env !== 'test') {
    app.use(httpLogger);
  }
  app.use(metricsMiddleware);

  // Prometheus Metrics endpoint
  app.get('/metrics', async (req, res, next) => {
    try {
      res.setHeader('Content-Type', getContentType());
      const metrics = await getMetrics();
      res.send(metrics);
    } catch (err) {
      next(err);
    }
  });

  // Application Routes
  app.use('/healthz', healthRoutes);
  app.use('/api/v1/diagnostics', diagnosticsRoutes);
  app.use('/api/v1/orders', orderRoutes);

  // 404 Catch-all handler
  app.use((req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Endpoint ${req.method} ${req.originalUrl} does not exist`,
        requestId: req.id
      }
    });
  });

  // Centralized Error handler
  app.use(errorHandler);

  return app;
}

export default createApp;
