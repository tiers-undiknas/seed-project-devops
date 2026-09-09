import { httpRequestDurationHistogram } from '../telemetry/metrics.js';

/**
 * Middleware measuring HTTP request duration and recording to Prometheus Histogram
 */
export function metricsMiddleware(req, res, next) {
  const start = process.hrtime();

  res.on('finish', () => {
    // Ignore metrics endpoint to avoid skewing telemetry
    if (req.originalUrl === '/metrics') {
      return;
    }

    const diff = process.hrtime(start);
    const durationInSeconds = diff[0] + diff[1] / 1e9;

    // Use route path if available, or normalize path to avoid cardinality explosion
    const route = req.route?.path || req.baseUrl + (req.route ? req.route.path : '') || req.path;
    const method = req.method;
    const statusCode = String(res.statusCode);

    httpRequestDurationHistogram.observe(
      {
        method,
        route,
        status_code: statusCode
      },
      durationInSeconds
    );
  });

  next();
}

export default metricsMiddleware;
