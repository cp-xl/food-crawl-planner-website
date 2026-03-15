const fetchWithTimeout = require('../lib/fetchWithTimeout');
const CLAUDE_API   = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT = `You extract structured search criteria from natural language map search queries.
Return ONLY valid JSON with this exact shape (no extra keys):
{
  "location": "full location string e.g. 'Richmond, Melbourne, Australia'",
  "placeType": "google place type e.g. cafe, restaurant, bar, gym, bakery",
  "searchQuery": "the full text to send to Google Places API e.g. 'Italian cafes in Richmond Melbourne'",
  "constraints": []
}

Supported constraint types (add only what the user mentions):
- { "type": "open_after",  "value": "HH:MM" }   — closes after this time (24h)
- { "type": "open_before", "value": "HH:MM" }   — opens at or before this time (24h)
- { "type": "open_on_day", "value": "monday" }  — must be open on this day of the week (lowercase)
- { "type": "open_now",    "value": "true" }     — must be open right now
- { "type": "min_rating",  "value": "4.0" }     — minimum Google rating (1.0–5.0)
- { "type": "max_price",   "value": "2" }        — max price tier: 1=cheap, 2=moderate, 3=expensive, 4=very expensive

Examples:
"cafes in Richmond that don't close at 3pm"
→ placeType: "cafe", constraints: [{ "type": "open_after", "value": "15:00" }]

"cheap Italian restaurants in Fitzroy open for lunch"
→ placeType: "restaurant", searchQuery: "Italian restaurants in Fitzroy Melbourne",
  constraints: [{ "type": "max_price", "value": "2" }, { "type": "open_before", "value": "12:00" }]

"highly rated ramen places in the CBD open on Sundays"
→ placeType: "restaurant", searchQuery: "ramen in Melbourne CBD",
  constraints: [{ "type": "min_rating", "value": "4.0" }, { "type": "open_on_day", "value": "sunday" }]

"open now coffee shops near me"
→ placeType: "cafe", constraints: [{ "type": "open_now", "value": "true" }]

If no constraints match, return an empty array. Use 24-hour time for time values.`;

module.exports = async function parseRoute(req, res) {
  const { query, mapCenter } = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'query is required' });
  }
  if (query.length > 500) {
    return res.status(400).json({ error: 'query too long (max 500 characters)' });
  }

  // Validate mapCenter coordinates — must be numbers if provided.
  // Prevents prompt injection via string values interpolated into the system prompt.
  let locationHint = '';
  if (mapCenter?.lat != null && mapCenter?.lng != null) {
    const lat = parseFloat(mapCenter.lat);
    const lng = parseFloat(mapCenter.lng);
    if (!isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'Invalid mapCenter coordinates' });
    }
    locationHint = `\nThe user's map is currently centred at coordinates (${lat}, ${lng}). If no location is mentioned in the query, infer the nearest city or suburb from these coordinates and use it as the location.`;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  let upstream;
  try {
    upstream = await fetchWithTimeout(CLAUDE_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 512,
        system: SYSTEM_PROMPT + locationHint,
        messages: [{ role: 'user', content: query }],
      }),
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Search timed out. Please try again.' });
    }
    throw err;
  }

  if (!upstream.ok) {
    const body = await upstream.json().catch(() => ({}));
    const msg  = body?.error?.message ?? '';
    if (msg.includes('credit balance is too low')) {
      return res.status(502).json({ error: 'Service temporarily unavailable. Please try again later.' });
    }
    if (upstream.status === 401) {
      return res.status(502).json({ error: 'Service configuration error. Please contact support.' });
    }
    console.error(`Claude error ${upstream.status}: ${msg}`);
    return res.status(502).json({ error: `Search parsing failed (${upstream.status})` });
  }

  const data = await upstream.json();
  const text = data.content?.[0]?.text ?? '';

  try {
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed  = JSON.parse(cleaned);

    // Schema validation — only allow known constraint types through.
    // Claude might hallucinate extra types or a prompt injection could try
    // to add unexpected ones. We strip anything not on our whitelist so the
    // extension's filtering logic only ever sees types it knows how to handle.
    const VALID_TYPES = new Set(['open_after', 'open_before', 'open_on_day', 'open_now', 'min_rating', 'max_price']);
    if (Array.isArray(parsed.constraints)) {
      parsed.constraints = parsed.constraints.filter(c =>
        c && typeof c.type === 'string' && VALID_TYPES.has(c.type) && c.value !== undefined
      );
    } else {
      parsed.constraints = [];
    }

    // Ensure top-level fields are strings (or absent) — prevents
    // object/array injection into downstream Google API calls.
    for (const key of ['location', 'placeType', 'searchQuery']) {
      if (parsed[key] !== undefined && typeof parsed[key] !== 'string') {
        parsed[key] = String(parsed[key]);
      }
    }

    return res.json(parsed);
  } catch {
    console.error(`Could not parse Claude response: ${text}`);
    return res.status(502).json({ error: 'Could not parse search criteria. Try rephrasing your query.' });
  }
};
