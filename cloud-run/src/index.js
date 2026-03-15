const express       = require('express');
const cors          = require('./lib/cors');
const validateJson  = require('./lib/validateJson');
const rateLimit     = require('./lib/rateLimit');
const parseRoute    = require('./routes/parse');
const searchRoute   = require('./routes/search');
const placeRoute    = require('./routes/place');
const photosRoute   = require('./routes/photos');
const optimiseRoute = require('./routes/optimise');
const crawlRoute    = require('./routes/crawl');
const eventRoute    = require('./routes/event');
const resolveRoute  = require('./routes/resolve');

const app  = express();
const PORT = process.env.PORT || 8080;

// --- Startup checks ---
const REQUIRED_ENV = ['MAPS_API_KEY', 'ALLOWED_ORIGINS', 'FIRESTORE_PROJECT_ID'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`FATAL: Required environment variable ${key} is not set. Exiting.`);
    process.exit(1);
  }
}

const featureLimits = process.env.FEATURE_LIMITS_ENABLED === 'true';
console.log(`FEATURE_LIMITS_ENABLED=${featureLimits}`);

// --- Middleware ---
app.use(express.json({ limit: '10kb' }));
app.use(cors);
app.use(validateJson);
app.use(rateLimit);

// --- Health check (bypasses CORS via cors.js) ---
app.get('/health', (_req, res) => res.json({ ok: true }));

// Catch-all error handler — log the real error server-side (Cloud Logging)
// but only send a generic message to the client. This prevents internal
// details (file paths, stack traces, API errors) from leaking to users.
function safeHandler(routeFn) {
  return (req, res) => routeFn(req, res).catch(e => {
    console.error(`Unhandled error in ${req.path}:`, e);
    res.status(500).json({ error: 'Something went wrong. Please try again.', code: 'INTERNAL_ERROR' });
  });
}

// --- Existing routes (unchanged) ---
app.post('/api/parse',         safeHandler(parseRoute));
app.post('/api/search',        safeHandler(searchRoute));
app.get('/api/place/:placeId', safeHandler(placeRoute));
app.post('/api/photos',        safeHandler(photosRoute));

// --- New routes ---
app.post('/api/optimise', safeHandler(optimiseRoute));
app.post('/api/crawl',    safeHandler(crawlRoute));
app.post('/api/event',    safeHandler(eventRoute));
app.get('/api/resolve',   safeHandler(resolveRoute));

const server = app.listen(PORT, () => console.log(`Listening on port ${PORT}`));

// Graceful shutdown — let in-flight requests finish before Cloud Run kills the instance
process.on('SIGTERM', () => {
  console.log('SIGTERM received, draining connections…');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 25000); // force exit after 25s
});
