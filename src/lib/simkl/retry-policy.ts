function retryAfterMs(value: string | null, now: number): number | null {
  if (!value?.trim()) return null;
  const text = value.trim();
  const delay = /^\d+$/.test(text) ? Number(text) * 1000 : Date.parse(text) - now;
  return Number.isFinite(delay) && delay >= 0
    ? Math.min(delay, Number.MAX_SAFE_INTEGER - now)
    : null;
}

export function simklRetryPolicy(
  status: number,
  body: string,
  retryAfter: string | null,
  attempt: number,
  now = Date.now(),
  random = Math.random(),
): { delayMs: number; cooldown: "app" | "user" | null } {
  let error: unknown;
  try {
    error = JSON.parse(body)?.error;
  } catch {
    /* A bare 429 is a short burst limit. */
  }
  const serverDelay = retryAfterMs(retryAfter, now);
  if (status === 429 && (error === "user_limit_exceeded" || error === "app_limit_exceeded")) {
    return {
      delayMs: Math.max(1000, serverDelay ?? 60000),
      cooldown: error === "user_limit_exceeded" ? "user" : "app",
    };
  }
  // Burst 429 headers can carry the daily reset; only quota errors use that wait.
  const base = status === 429 ? 1000 : Math.min(16, 2 ** attempt) * 1000;
  const delayMs = Math.max(base, status === 429 ? 0 : (serverDelay ?? 0));
  // Surface long outages instead of holding every queued request behind a timer.
  if (delayMs > 30000) return { delayMs, cooldown: "app" };
  return { delayMs: delayMs + Math.floor(random * 1000), cooldown: null };
}
