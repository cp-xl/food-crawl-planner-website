const fetchWithTimeout = require('./fetchWithTimeout');
const PLACES_BASE = 'https://places.googleapis.com/v1';

// Resolve a single photo resource name to a Google CDN URL.
// Uses skipHttpRedirect to get the final URL without streaming image bytes.
async function resolvePhotoUrl(photoName, apiKey) {
  const res = await fetchWithTimeout(
    `${PLACES_BASE}/${photoName}/media?maxWidthPx=400&skipHttpRedirect=true`,
    { headers: { 'X-Goog-Api-Key': apiKey } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.photoUri ?? null;
}

module.exports = resolvePhotoUrl;
