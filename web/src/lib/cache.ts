const CACHE_PREFIX = "fcp_place_";
const MAX_AGE_DAYS = 2;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function isValidPlaceShape(data: unknown): boolean {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.placeId === "string" &&
    typeof d.name === "string" &&
    typeof d.lat === "number" &&
    typeof d.lng === "number"
  );
}

export function getCachedPlace<T>(placeId: string): T | null {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem(CACHE_PREFIX + placeId);
  if (!raw) return null;

  try {
    const { date, data } = JSON.parse(raw);
    const age =
      (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24);
    if (age > MAX_AGE_DAYS) {
      localStorage.removeItem(CACHE_PREFIX + placeId);
      return null;
    }
    if (!isValidPlaceShape(data)) {
      localStorage.removeItem(CACHE_PREFIX + placeId);
      return null;
    }
    return data as T;
  } catch {
    localStorage.removeItem(CACHE_PREFIX + placeId);
    return null;
  }
}

export function setCachedPlace<T>(placeId: string, data: T): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    CACHE_PREFIX + placeId,
    JSON.stringify({ date: todayKey(), data })
  );
}

export function purgeStaleCache(): void {
  if (typeof window === "undefined") return;

  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(CACHE_PREFIX)) continue;

    try {
      const { date } = JSON.parse(localStorage.getItem(key)!);
      if (new Date(date).getTime() < cutoff) {
        keysToRemove.push(key);
      }
    } catch {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((k) => localStorage.removeItem(k));
}
