const { nanoid } = require('nanoid');
const db = require('../lib/firestore');
const stripHtml = require('../lib/stripHtml');

const PLACE_ID_RE = /^[A-Za-z0-9_-]{1,256}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_LENGTH = 6;
const MAX_RETRIES = 1;

module.exports = async function crawlRoute(req, res) {
  const { places, name, sessionId } = req.body;

  // Validate places
  if (!Array.isArray(places) || places.length < 1 || places.length > 8) {
    return res.status(400).json({ error: 'places must be an array of 1–8 items', code: 'INVALID_PLACES' });
  }
  for (const pid of places) {
    if (typeof pid !== 'string' || !PLACE_ID_RE.test(pid)) {
      return res.status(400).json({ error: 'Invalid placeId in places array', code: 'INVALID_PLACE_ID' });
    }
  }

  // Validate name
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'name is required', code: 'INVALID_NAME' });
  }
  const sanitisedName = stripHtml(name).slice(0, 60);
  if (sanitisedName.length === 0) {
    return res.status(400).json({ error: 'name must not be empty after sanitisation', code: 'INVALID_NAME' });
  }

  // Validate sessionId
  if (!sessionId || typeof sessionId !== 'string' || !UUID_RE.test(sessionId)) {
    return res.status(400).json({ error: 'Valid sessionId is required', code: 'INVALID_SESSION' });
  }

  // Generate slug and check uniqueness
  let slug;
  let attempts = 0;
  while (attempts <= MAX_RETRIES) {
    slug = nanoid(SLUG_LENGTH);
    const existing = await db.collection('crawls').doc(slug).get();
    if (!existing.exists) break;
    attempts++;
    if (attempts > MAX_RETRIES) {
      console.error('Slug collision after retries');
      return res.status(500).json({ error: 'Failed to generate unique URL. Please try again.', code: 'SLUG_COLLISION' });
    }
  }

  // Write to Firestore
  await db.collection('crawls').doc(slug).set({
    slug,
    places,
    name: sanitisedName,
    createdAt: new Date(),
    sessionId,
  });

  return res.json({ slug, url: `/crawl/${slug}` });
};
