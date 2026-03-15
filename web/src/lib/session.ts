const SESSION_KEY = "anonymousUserId";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getSessionId(): string {
  if (typeof window === "undefined") return "";

  const stored = localStorage.getItem(SESSION_KEY);
  if (stored && UUID_RE.test(stored)) {
    return stored;
  }

  const id = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, id);
  return id;
}
