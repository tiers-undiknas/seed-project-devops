/**
 * API Client for interacting with the backend service.
 * In development, requests are proxied via Vite (e.g. /api -> localhost:3000).
 * In production, requests use relative paths or VITE_API_URL if defined.
 */

const BASE_URL = import.meta.env?.VITE_API_URL || '';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  try {
    const response = await fetch(url, { ...options, headers });
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      const errorMsg = isJson ? data?.error?.message || data?.message || response.statusText : data;
      const error = new Error(errorMsg || `Request failed with status ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    if (import.meta.env?.MODE !== 'test') {
      console.error(`[API Error] ${options.method || 'GET'} ${endpoint}:`, err);
    }
    throw err;
  }
}

export const api = {
  // Health
  getHealthLive: () => request('/healthz/live'),
  getHealthReady: () => request('/healthz/ready'),

  // Orders
  listOrders: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/v1/orders${query ? `?${query}` : ''}`);
  },
  getOrderById: (id) => request(`/api/v1/orders/${id}`),
  getOrderEvents: (id) => request(`/api/v1/orders/${id}/events`),
  createOrder: (orderData) =>
    request('/api/v1/orders', {
      method: 'POST',
      body: JSON.stringify(orderData)
    }),

  // Chaos & Diagnostics
  triggerCpuStress: (durationMs = 2000) =>
    request('/api/v1/diagnostics/cpu-stress', {
      method: 'POST',
      body: JSON.stringify({ durationMs })
    }),
  triggerMemoryLeak: (sizeMb = 50) =>
    request('/api/v1/diagnostics/memory-leak', {
      method: 'POST',
      body: JSON.stringify({ sizeMb })
    }),
  triggerCrash: () =>
    request('/api/v1/diagnostics/crash', {
      method: 'POST'
    })
};

export default api;
