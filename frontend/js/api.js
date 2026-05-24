/* ════════════════════════════
   FraudShield API Client
   ════════════════════════════ */
const BASE_URL = window.location.origin;

const api = {
  async get(path) {
    const res = await fetch(BASE_URL + path);
    if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
    return res.json();
  },

  async post(path, body) {
    const res = await fetch(BASE_URL + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
    return res.json();
  },

  // Analytics
  summary: () => api.get('/api/analytics/summary'),
  byCategory: () => api.get('/api/analytics/by-category'),
  byHour: () => api.get('/api/analytics/by-hour'),
  recentTrend: () => api.get('/api/analytics/recent-trend'),
  scoreDistribution: () => api.get('/api/analytics/score-distribution'),
  modelMetrics: () => api.get('/api/analytics/model-metrics'),
  alerts: (includeResolved = false) => api.get(`/api/analytics/alerts?include_resolved=${includeResolved}`),
  resolveAlert: (id) => api.post(`/api/analytics/alerts/${id}/resolve`, {}),

  // Transactions
  transactions: (limit = 50, filter = '') =>
    api.get(`/api/transactions/?limit=${limit}${filter ? '&status=' + filter : ''}`),
  scoreTransaction: (data) => api.post('/api/transactions/score', data),
  generateDemo: (count = 15) => api.get(`/api/transactions/demo/generate?count=${count}`),
};
