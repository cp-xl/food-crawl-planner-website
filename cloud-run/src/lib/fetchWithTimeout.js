// Fetch with a 30-second timeout via AbortController.
// Prevents indefinite hangs if an upstream API (Claude, Google Places) stalls.
const DEFAULT_TIMEOUT_MS = 30000;

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

module.exports = fetchWithTimeout;
