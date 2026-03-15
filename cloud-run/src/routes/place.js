const fetchWithTimeout = require('../lib/fetchWithTimeout');
const resolvePhotoUrl = require('../lib/resolvePhotoUrl');
const PLACES_BASE = 'https://places.googleapis.com/v1';
// Only alphanumeric, hyphens, and underscores are valid in a Places API place ID
const PLACE_ID_RE = /^[A-Za-z0-9_-]+$/;

const FIELD_MASK = [
  // Hours + location
  'regularOpeningHours',
  'formattedAddress',
  'googleMapsUri',
  // Rating
  'rating',
  'userRatingCount',
  // Price
  'priceLevel',
  // Vibe — editorial + reviews
  'editorialSummary',
  'reviews',
  // Vibe — atmosphere attributes
  'outdoorSeating',
  'liveMusic',
  'servesCocktails',
  'servesBeer',
  'servesWine',
  'servesCoffee',
  'servesDessert',
  // Context
  'goodForGroups',
  'goodForChildren',
  'primaryTypeDisplayName',
  // Timezone — used by the extension to evaluate open_now in the place's local time
  'utcOffsetMinutes',
  // Photo
  'photos',
].join(',');

module.exports = async function placeRoute(req, res) {
  const { placeId } = req.params;

  if (!placeId || placeId.length > 256 || !PLACE_ID_RE.test(placeId)) {
    return res.status(400).json({ error: 'Invalid placeId' });
  }

  const apiKey = process.env.MAPS_API_KEY;

  let upstream;
  try {
    upstream = await fetchWithTimeout(`${PLACES_BASE}/places/${placeId}`, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Place details timed out. Please try again.' });
    }
    throw err;
  }

  if (!upstream.ok) {
    const body = await upstream.text();
    console.error(`Place Details error ${upstream.status}: ${body}`);
    return res.status(502).json({ error: `Place details failed (${upstream.status})` });
  }

  const detail = await upstream.json();

  // Resolve first photo to a Google CDN URL (best-effort)
  if (detail.photos?.[0]?.name) {
    try {
      detail.resolvedPhotoUrl = await resolvePhotoUrl(detail.photos[0].name, apiKey);
    } catch (_) { /* photo resolution is best-effort */ }
  }
  delete detail.photos;

  return res.json(detail);
};
