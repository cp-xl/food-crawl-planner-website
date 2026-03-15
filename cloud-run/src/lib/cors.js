// CORS middleware — replaces the old Chrome extension origin check.
// Reads ALLOWED_ORIGINS env var (comma-separated) and does exact-match
// against the Origin header. Health check has no Origin — allowed through.

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

module.exports = function cors(req, res, next) {
  // Health check — no Origin header, allow through
  if (req.path === '/health') return next();

  const origin = req.headers.origin ?? '';

  if (!origin || !allowedOrigins.includes(origin)) {
    return res.status(403).json({ error: 'Forbidden', code: 'CORS_REJECTED' });
  }

  res.set('Access-Control-Allow-Origin', origin);
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, X-Session-ID');
  res.set('Access-Control-Max-Age', '86400');

  // Preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  next();
};
