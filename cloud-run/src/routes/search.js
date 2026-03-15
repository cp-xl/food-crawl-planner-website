const fetchWithTimeout = require('../lib/fetchWithTimeout');
const resolvePhotoUrl = require('../lib/resolvePhotoUrl');
const PLACES_BASE = 'https://places.googleapis.com/v1';
const PHOTO_LIMIT = 5; // Resolve photos for top N results only

module.exports = async function searchRoute(req, res) {
  const { searchQuery, pageToken, mapCenter } = req.body;
  let { maxResultCount = 20 } = req.body;

  if (!searchQuery || typeof searchQuery !== 'string') {
    return res.status(400).json({ error: 'searchQuery is required' });
  }
  if (searchQuery.length > 200) {
    return res.status(400).json({ error: 'searchQuery too long (max 200 characters)' });
  }
  maxResultCount = parseInt(maxResultCount, 10);
  if (!isFinite(maxResultCount) || maxResultCount < 1 || maxResultCount > 20) {
    return res.status(400).json({ error: 'maxResultCount must be 1–20' });
  }
  if (pageToken && (typeof pageToken !== 'string' || pageToken.length > 500)) {
    return res.status(400).json({ error: 'Invalid pageToken' });
  }

  const apiKey = process.env.MAPS_API_KEY;

  const requestBody = { textQuery: searchQuery, maxResultCount };
  if (pageToken) requestBody.pageToken = pageToken;

  // Bias results towards the user's current map centre so "cafes near X" returns
  // results near X, not wherever Google's IP-based default lands.
  if (mapCenter?.lat != null && mapCenter?.lng != null) {
    const lat = parseFloat(mapCenter.lat);
    const lng = parseFloat(mapCenter.lng);
    if (isFinite(lat) && isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      requestBody.locationBias = {
        circle: { center: { latitude: lat, longitude: lng }, radius: 10000 }
      };
    }
  }

  let upstream;
  try {
    upstream = await fetchWithTimeout(`${PLACES_BASE}/places:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.formattedAddress,places.rating,places.priceLevel,places.photos',
      },
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Places search timed out. Please try again.' });
    }
    throw err;
  }

  if (!upstream.ok) {
    const body = await upstream.json().catch(() => ({}));
    const msg  = body?.error?.message ?? '';
    if (upstream.status === 403) {
      console.error(`Maps API 403: ${msg}`);
      return res.status(502).json({ error: 'Places search unavailable. Please try again later.' });
    }
    console.error(`Places Search error ${upstream.status}: ${msg}`);
    return res.status(502).json({ error: `Places search failed (${upstream.status})` });
  }

  const data = await upstream.json();
  const places = data.places ?? [];

  // Resolve photo URLs for the top N results in parallel
  const photoJobs = places.slice(0, PHOTO_LIMIT).map(async (place) => {
    if (!place.photos?.[0]?.name) return;
    try {
      place.resolvedPhotoUrl = await resolvePhotoUrl(place.photos[0].name, apiKey);
    } catch (_) { /* photo resolution is best-effort */ }
  });
  await Promise.allSettled(photoJobs);

  // Strip photos from top 5 (already resolved), keep on overflow for lazy resolution
  for (let i = 0; i < Math.min(PHOTO_LIMIT, places.length); i++) {
    delete places[i].photos;
  }

  const result = { places };
  if (data.nextPageToken) result.nextPageToken = data.nextPageToken;
  return res.json(result);
};
