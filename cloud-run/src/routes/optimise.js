const fetchWithTimeout = require('../lib/fetchWithTimeout');

const ROUTES_API = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const PLACE_ID_RE = /^[A-Za-z0-9_-]{1,256}$/;

module.exports = async function optimiseRoute(req, res) {
  const { origin, places } = req.body;

  // Validate origin
  if (!origin || typeof origin !== 'object') {
    return res.status(400).json({ error: 'origin is required', code: 'INVALID_ORIGIN' });
  }
  const originLat = parseFloat(origin.lat);
  const originLng = parseFloat(origin.lng);
  if (!isFinite(originLat) || !isFinite(originLng) ||
      originLat < -90 || originLat > 90 || originLng < -180 || originLng > 180) {
    return res.status(400).json({ error: 'origin must have valid lat/lng', code: 'INVALID_ORIGIN' });
  }

  // Validate places
  if (!Array.isArray(places) || places.length < 2 || places.length > 8) {
    return res.status(400).json({ error: 'places must be an array of 2–8 items', code: 'INVALID_PLACES' });
  }
  for (const p of places) {
    if (!p.placeId || !PLACE_ID_RE.test(p.placeId)) {
      return res.status(400).json({ error: 'Invalid placeId in places array', code: 'INVALID_PLACE_ID' });
    }
    const lat = parseFloat(p.lat);
    const lng = parseFloat(p.lng);
    if (!isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'Each place must have valid lat/lng', code: 'INVALID_PLACE_COORDS' });
    }
  }

  const apiKey = process.env.GOOGLE_ROUTES_API_KEY;

  // Build waypoints — origin is the start, all places are intermediates,
  // last place is the destination. Routes API optimises intermediate waypoints.
  const intermediates = places.slice(0, -1).map(p => ({
    location: { latLng: { latitude: parseFloat(p.lat), longitude: parseFloat(p.lng) } },
  }));
  const lastPlace = places[places.length - 1];

  const requestBody = {
    origin: {
      location: { latLng: { latitude: originLat, longitude: originLng } },
    },
    destination: {
      location: { latLng: { latitude: parseFloat(lastPlace.lat), longitude: parseFloat(lastPlace.lng) } },
    },
    intermediates,
    travelMode: 'DRIVE',
    optimizeWaypointOrder: true,
    routingPreference: 'TRAFFIC_AWARE',
  };

  let upstream;
  try {
    upstream = await fetchWithTimeout(ROUTES_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.optimizedIntermediateWaypointIndex',
      },
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Route optimisation timed out. Please try again.', code: 'TIMEOUT' });
    }
    throw err;
  }

  if (!upstream.ok) {
    const body = await upstream.json().catch(() => ({}));
    console.error(`Routes API error ${upstream.status}:`, body?.error?.message ?? body);
    return res.status(500).json({ error: 'Route optimisation failed. Please try again.', code: 'ROUTES_API_ERROR' });
  }

  const data = await upstream.json();
  const route = data.routes?.[0];

  if (!route) {
    console.error('Routes API returned no routes');
    return res.status(500).json({ error: 'No route found. Please try again.', code: 'NO_ROUTE' });
  }

  // Rebuild ordered placeIds from the optimised waypoint indices
  const optimisedIndices = route.optimizedIntermediateWaypointIndex ?? [];
  const orderedPlaceIds = [];

  // Map optimised intermediate indices back to place IDs
  for (const idx of optimisedIndices) {
    if (places[idx]) {
      orderedPlaceIds.push(places[idx].placeId);
    }
  }
  // Add the destination (last place) at the end
  orderedPlaceIds.push(lastPlace.placeId);

  // If any places weren't included in the optimised list (shouldn't happen), append them
  for (const p of places) {
    if (!orderedPlaceIds.includes(p.placeId)) {
      orderedPlaceIds.push(p.placeId);
    }
  }

  return res.json({ orderedPlaceIds });
};
