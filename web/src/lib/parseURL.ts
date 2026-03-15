// Future: TikTok and Instagram post URL parsing

const MAPS_PLACE_RE =
  /google\.com\/maps\/place\/([^/@]+)/;
const MAPS_QUERY_RE =
  /google\.com\/maps\?.*q=([^&]+)/;
const SHORT_LINK_RE =
  /maps\.app\.goo\.gl\/\w+/;

export interface ParsedURL {
  type: "place_name" | "short_link";
  query: string;
  originalUrl: string;
}

export function isGoogleMapsURL(input: string): boolean {
  return (
    input.includes("google.com/maps") || input.includes("maps.app.goo.gl")
  );
}

export function parseURL(url: string): ParsedURL | null {
  // Short link — needs proxy resolution
  if (SHORT_LINK_RE.test(url)) {
    return { type: "short_link", query: url, originalUrl: url };
  }

  // Full place URL: /maps/place/NAME/@lat,lng,...
  const placeMatch = url.match(MAPS_PLACE_RE);
  if (placeMatch) {
    const name = decodeURIComponent(placeMatch[1].replace(/\+/g, " "));
    return { type: "place_name", query: name, originalUrl: url };
  }

  // Query URL: /maps?q=NAME
  const queryMatch = url.match(MAPS_QUERY_RE);
  if (queryMatch) {
    const name = decodeURIComponent(queryMatch[1].replace(/\+/g, " "));
    return { type: "place_name", query: name, originalUrl: url };
  }

  return null;
}
