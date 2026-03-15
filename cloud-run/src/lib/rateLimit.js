// In-process token bucket rate limiter — 30 requests per IP per minute.
// Sufficient for a single Cloud Run instance. If you scale to multiple
// instances, replace this with a shared store (e.g. Cloud Memorystore/Redis).

const WINDOW_MS    = 60_000;
const MAX_REQ      = 30;
const PRUNE_EVERY  = 100;        // prune stale buckets every N requests
const buckets      = new Map();  // ip → { count, resetAt }
let   requestCount = 0;

module.exports = function rateLimit(req, res, next) {
  const ip  = req.headers['x-forwarded-for']?.split(',')[0].trim()
            ?? req.socket.remoteAddress
            ?? 'unknown';
  const now = Date.now();
  let bucket = buckets.get(ip);

  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(ip, bucket);
  }

  bucket.count++;
  if (bucket.count > MAX_REQ) {
    return res.status(429).json({ error: 'Too many requests. Please slow down.' });
  }

  // Periodically prune expired buckets to prevent unbounded memory growth
  if (++requestCount >= PRUNE_EVERY) {
    requestCount = 0;
    for (const [key, b] of buckets) {
      if (now > b.resetAt) buckets.delete(key);
    }
  }

  next();
};
