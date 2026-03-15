const resolvePhotoUrl = require('../lib/resolvePhotoUrl');

const PHOTO_NAME_RE = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;
const MAX_BATCH = 20;

module.exports = async function photosRoute(req, res) {
  const { photoNames } = req.body;

  if (!Array.isArray(photoNames) || photoNames.length === 0) {
    return res.status(400).json({ error: 'photoNames must be a non-empty array' });
  }
  if (photoNames.length > MAX_BATCH) {
    return res.status(400).json({ error: `photoNames exceeds max batch size (${MAX_BATCH})` });
  }

  // Validate each photo name
  for (const name of photoNames) {
    if (typeof name !== 'string' || name.length > 512 || !PHOTO_NAME_RE.test(name)) {
      return res.status(400).json({ error: 'Invalid photo name in batch' });
    }
  }

  const apiKey = process.env.MAPS_API_KEY;
  const photoUrls = {};

  const jobs = photoNames.map(async (name) => {
    try {
      const url = await resolvePhotoUrl(name, apiKey);
      if (url) photoUrls[name] = url;
    } catch (_) { /* best-effort */ }
  });
  await Promise.allSettled(jobs);

  return res.json({ photoUrls });
};
