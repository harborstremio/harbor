type Json = Record<string, unknown>;
type Loader = (url: string, signal: AbortSignal) => Promise<Json>;

/** Calendar endpoints use UTC dates; a local day can overlap two of them. */
export function utcCalendarDates(day: string): string[] {
  const start = new Date(+day.slice(0, 4), +day.slice(4, 6) - 1, +day.slice(6, 8));
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setMilliseconds(-1);
  if (!Number.isFinite(start.getTime())) return [];
  return [...new Set([start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)])];
}

/** Free calendars change slowly. Space requests so choosing Motorsport cannot burst all series at once. */
export function createMotorsportScheduleCache(
  spacingMs = 2200,
  ttlMs = 15 * 60_000,
  now = Date.now,
) {
  const cache = new Map<string, { at: number; value: Json }>();
  let tail: Promise<unknown> = Promise.resolve();
  let nextStart = 0;
  let cooldownUntil = 0;

  return async (url: string, signal: AbortSignal, load: Loader): Promise<Json> => {
    signal.throwIfAborted();
    const hit = cache.get(url);
    if (hit && now() - hit.at < ttlMs) return hit.value;
    const task = tail
      .catch(() => undefined)
      .then(async () => {
        signal.throwIfAborted();
        // A duplicate queued by the day and discovery views can use the first result.
        const saved = cache.get(url);
        if (saved && now() - saved.at < ttlMs) return saved.value;
        if (now() < cooldownUntil) throw new Error("Sports calendar is temporarily rate limited");
        const wait = nextStart - now();
        if (wait > 0)
          await new Promise<void>((resolve, reject) => {
            const abort = () => {
              clearTimeout(timer);
              signal.removeEventListener("abort", abort);
              reject(signal.reason);
            };
            const timer = setTimeout(() => {
              signal.removeEventListener("abort", abort);
              resolve();
            }, wait);
            signal.addEventListener("abort", abort, { once: true });
          });
        signal.throwIfAborted();
        nextStart = now() + spacingMs;
        try {
          const value = await load(url, signal);
          signal.throwIfAborted();
          if (!("events" in value) || (value.events !== null && !Array.isArray(value.events)))
            throw new Error("Invalid motorsport calendar response");
          cache.delete(url);
          cache.set(url, { at: now(), value });
          while (cache.size > 64) cache.delete(cache.keys().next().value!);
          return value;
        } catch (error) {
          if (/429/.test(String(error))) cooldownUntil = now() + 60_000;
          throw error;
        }
      });
    tail = task;
    return task;
  };
}

export const loadMotorsportSchedule = createMotorsportScheduleCache();
