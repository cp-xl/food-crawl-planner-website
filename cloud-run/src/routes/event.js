const stripHtml = require('../lib/stripHtml');

const VALID_EVENTS = new Set([
  'search_performed',
  'place_added',
  'crawl_planned',
  'crawl_shared',
]);

const MAX_STRING = 200;

function sanitise(val) {
  if (typeof val !== 'string') return undefined;
  return stripHtml(val).slice(0, MAX_STRING) || undefined;
}

module.exports = async function eventRoute(req, res) {
  const { event, sessionId, timestamp, suburb, searchQuery, placeType } = req.body;

  // Validate event name against known enum
  if (!event || typeof event !== 'string' || !VALID_EVENTS.has(event)) {
    return res.status(400).json({ error: 'Invalid or missing event name', code: 'INVALID_EVENT' });
  }

  // Log to Cloud Logging — structured JSON is automatically parsed by Cloud Logging
  console.log(JSON.stringify({
    severity: 'INFO',
    message: 'analytics_event',
    event,
    sessionId: sanitise(sessionId),
    timestamp: sanitise(timestamp),
    suburb: sanitise(suburb),
    searchQuery: sanitise(searchQuery),
    placeType: sanitise(placeType),
  }));

  // Always return 200 — analytics should never fail the client
  return res.json({ ok: true });
};
