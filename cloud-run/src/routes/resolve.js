const fetchWithTimeout = require('../lib/fetchWithTimeout');

// Only accept Google Maps short links — prevents this from being an open redirect proxy
const SHORT_LINK_RE = /^https:\/\/maps\.app\.goo\.gl\/[A-Za-z0-9]+$/;
const GOOGLE_MAPS_RE = /^https:\/\/(www\.)?google\.[a-z.]+\/maps\//;

module.exports = async function resolveRoute(req, res) {
  const url = req.query.url;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url query parameter is required', code: 'MISSING_URL' });
  }

  if (!SHORT_LINK_RE.test(url)) {
    return res.status(400).json({ error: 'Only https://maps.app.goo.gl/* URLs are accepted', code: 'INVALID_URL' });
  }

  // Follow the redirect server-side
  let response;
  try {
    response = await fetchWithTimeout(url, { redirect: 'follow' });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'URL resolution timed out. Please try again.', code: 'TIMEOUT' });
    }
    throw err;
  }

  const resolvedUrl = response.url;

  // Validate the resolved URL is a legitimate Google Maps domain
  if (!GOOGLE_MAPS_RE.test(resolvedUrl)) {
    console.error(`Resolved URL is not Google Maps: ${resolvedUrl}`);
    return res.status(400).json({ error: 'Resolved URL is not a Google Maps link', code: 'INVALID_RESOLVED_URL' });
  }

  return res.json({ resolvedUrl });
};
