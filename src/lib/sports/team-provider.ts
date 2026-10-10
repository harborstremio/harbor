import { safeFetch } from "@/lib/safe-fetch";
import type { LeagueDef } from "./espn-types";

type Json = Record<string, unknown>;
type EventRow = Record<string, string | null>;
type Request = (url: string, signal: AbortSignal) => Promise<Json>;

/** Share a paced transport between directory and followed-team schedules. No automatic retries on throttling. */
export function createTeamProviderTransport(
  request: Request,
  spacingMs = 2200,
  timeoutMs = 10_000,
) {
  let tail: Promise<unknown> = Promise.resolve();
  let nextStart = 0;
  let blockedUntil = 0;
  return (url: string, signal: AbortSignal): Promise<Json> => {
    const work = tail
      .catch(() => {})
      .then(async () => {
        signal.throwIfAborted();
        if (Date.now() < blockedUntil)
          throw new Error("Sports team provider temporarily rate limited");
        const wait = nextStart - Date.now();
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
        nextStart = Date.now() + spacingMs;
        const controller = new AbortController();
        const abort = () => controller.abort(signal.reason);
        signal.addEventListener("abort", abort, { once: true });
        let timer: ReturnType<typeof setTimeout> | undefined;
        let cancel: (() => void) | undefined;
        try {
          return await Promise.race([
            Promise.resolve().then(() => request(url, controller.signal)),
            new Promise<never>((_, reject) => {
              cancel = () =>
                reject(controller.signal.reason ?? new DOMException("Aborted", "AbortError"));
              controller.signal.addEventListener("abort", cancel, { once: true });
              timer = setTimeout(
                () => controller.abort(new DOMException("Team provider timed out", "TimeoutError")),
                timeoutMs,
              );
            }),
          ]);
        } catch (error) {
          if (/429/.test(String(error))) blockedUntil = Date.now() + 60_000;
          throw error;
        } finally {
          clearTimeout(timer);
          signal.removeEventListener("abort", abort);
          if (cancel) controller.signal.removeEventListener("abort", cancel);
        }
      });
    tail = work;
    return work;
  };
}

export const loadTeamProviderJson = createTeamProviderTransport(async (url, signal) => {
  const response = await safeFetch(url, { signal });
  if (!response.ok) throw new Error(`Sports team provider HTTP ${response.status}`);
  return response.json();
});

/** IDs must match both the selected competition and followed team; free feeds may return demo payloads. */
export async function readSportsDbTeamSchedule(
  league: Pick<LeagueDef, "path">,
  teamId: string,
  json: Request,
): Promise<EventRow[]> {
  if (!/^\d+$/.test(league.path) || !/^\d+$/.test(teamId)) return [];
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException("Team schedule timed out", "TimeoutError")),
    30_000,
  );
  try {
    const feeds = await Promise.allSettled(
      ["eventsnext.php", "eventslast.php"].map((endpoint) =>
        json(
          `https://www.thesportsdb.com/api/v1/json/123/${endpoint}?id=${teamId}`,
          controller.signal,
        ),
      ),
    );
    const events = new Map<string, EventRow>();
    for (const result of feeds) {
      if (result.status !== "fulfilled") continue;
      const rows = result.value.events ?? result.value.results;
      if (!Array.isArray(rows)) continue;
      for (const raw of rows.slice(0, 100)) {
        if (!raw || typeof raw !== "object") continue;
        const row = raw as EventRow;
        if (
          row.idLeague !== league.path ||
          (row.idHomeTeam !== teamId && row.idAwayTeam !== teamId) ||
          !row.idEvent
        )
          continue;
        events.set(row.idEvent, row);
      }
    }
    if (feeds.every((feed) => feed.status === "rejected"))
      throw new Error("Team schedule is unavailable");
    return [...events.values()];
  } finally {
    clearTimeout(timer);
  }
}
