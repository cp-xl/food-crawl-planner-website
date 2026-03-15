import { getSessionId } from "./session";

const PROXY_URL = process.env.NEXT_PUBLIC_PROXY_URL ?? "";

type EventName =
  | "search_performed"
  | "place_added"
  | "crawl_planned"
  | "crawl_shared";

interface EventPayload {
  event: EventName;
  suburb?: string;
  searchQuery?: string;
  placeType?: string;
}

export function fireEvent(payload: EventPayload): void {
  if (!PROXY_URL) return;

  // Fire and forget — no await, no error handling
  fetch(`${PROXY_URL}/api/event`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Session-ID": getSessionId(),
    },
    body: JSON.stringify({
      ...payload,
      sessionId: getSessionId(),
      timestamp: new Date().toISOString(),
    }),
  }).catch(() => {});
}
