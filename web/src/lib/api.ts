import { getSessionId } from "./session";
import { getCachedPlace, setCachedPlace } from "./cache";
import type { PlaceCard, SearchResult } from "@/types/place";

const PROXY_URL = process.env.NEXT_PUBLIC_PROXY_URL ?? "";

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Session-ID": getSessionId(),
  };
}

// Map price level string from Places API to numeric 1–4
function parsePriceLevel(raw: string | undefined): number {
  const map: Record<string, number> = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return map[raw ?? ""] ?? 0;
}

// Extract suburb from formatted address (typically the second component)
function extractSuburb(formattedAddress: string): string {
  const parts = formattedAddress.split(",").map((s) => s.trim());
  // Usually: "123 Street, Suburb STATE POSTCODE, Country"
  if (parts.length >= 2) {
    // Remove state + postcode from suburb part
    return parts[1].replace(/\s+(VIC|NSW|QLD|WA|SA|TAS|ACT|NT)\s+\d{4}$/i, "").trim();
  }
  return parts[0];
}

// Determine if currently open from regularOpeningHours
function checkIsOpen(hours: { periods?: Array<{ open: { day: number; hour: number; minute: number }; close?: { day: number; hour: number; minute: number } }> } | undefined): boolean {
  if (!hours?.periods) return false;

  const now = new Date();
  const currentDay = now.getDay(); // 0=Sunday
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const period of hours.periods) {
    if (period.open.day === currentDay) {
      const openMinutes = period.open.hour * 60 + period.open.minute;
      if (period.close) {
        const closeMinutes = period.close.hour * 60 + period.close.minute;
        // Handle overnight closing (close time on next day)
        if (closeMinutes < openMinutes) {
          if (currentMinutes >= openMinutes) return true;
        } else if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
          return true;
        }
      } else {
        // 24-hour open
        return true;
      }
    }
    // Check if a previous day's overnight period covers now
    // e.g. opens Friday 22:00, closes Saturday 02:00 — on Saturday we need to match this period
    if (
      period.close &&
      period.close.day === currentDay &&
      period.open.day !== currentDay
    ) {
      const closeMinutes = period.close.hour * 60 + period.close.minute;
      if (currentMinutes < closeMinutes) return true;
    }
  }
  return false;
}

export interface SearchResponse {
  results: SearchResult[];
}

export async function searchPlaces(
  query: string,
  mapCenter?: { lat: number; lng: number }
): Promise<SearchResponse> {
  const res = await fetch(`${PROXY_URL}/api/search`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      searchQuery: query,
      maxResultCount: 5,
      ...(mapCenter && { mapCenter }),
    }),
  });

  if (!res.ok) {
    throw new Error(`Search failed: ${res.status}`);
  }

  const data = await res.json();
  const places = data.places ?? [];

  const results: SearchResult[] = places.map(
    (p: {
      id: string;
      displayName?: { text: string };
      formattedAddress?: string;
    }) => ({
      placeId: p.id,
      name: p.displayName?.text ?? "Unknown",
      suburb: extractSuburb(p.formattedAddress ?? ""),
      address: p.formattedAddress ?? "",
    })
  );

  return { results };
}

const PLACE_ID_RE = /^[A-Za-z0-9_-]{1,256}$/;

export async function getPlaceDetails(placeId: string): Promise<PlaceCard> {
  if (!PLACE_ID_RE.test(placeId)) {
    throw new Error("Invalid placeId format");
  }

  // Check cache first
  const cached = getCachedPlace<PlaceCard>(placeId);
  if (cached) return cached;

  const res = await fetch(`${PROXY_URL}/api/place/${placeId}`, {
    headers: headers(),
  });

  if (!res.ok) {
    throw new Error(`Place details failed: ${res.status}`);
  }

  const d = await res.json();

  const card: PlaceCard = {
    placeId,
    name: d.displayName?.text ?? "Unknown",
    suburb: extractSuburb(d.formattedAddress ?? ""),
    address: d.formattedAddress ?? "",
    rating: d.rating ?? 0,
    priceLevel: parsePriceLevel(d.priceLevel),
    isOpenNow: checkIsOpen(d.regularOpeningHours),
    photoUrl: d.resolvedPhotoUrl ?? null,
    lat: d.location?.latitude ?? 0,
    lng: d.location?.longitude ?? 0,
    sponsored: false,
  };

  setCachedPlace(placeId, card);
  return card;
}
