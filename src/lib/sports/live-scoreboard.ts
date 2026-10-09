type RawEvent = Record<string, unknown> & { id: string };
type Json = (url: string, signal: AbortSignal) => Promise<Record<string, unknown>>;
const LIMIT = 1000;
const DAY_MS = 86400_000;

function rangeDays(range: string): string[] {
  const match = /^(\d{8})(?:-(\d{8}))?$/.exec(range);
  if (!match) throw new Error("Invalid live scoreboard date range");
  const parse = (day: string) => {
    const date = new Date(Date.UTC(+day.slice(0, 4), +day.slice(4, 6) - 1, +day.slice(6, 8)));
    if (date.toISOString().slice(0, 10).replaceAll("-", "") !== day)
      throw new Error("Invalid live scoreboard date");
    return date.getTime();
  };
  const first = parse(match[1]),
    last = parse(match[2] ?? match[1]);
  if (last < first || last - first > 3 * DAY_MS)
    throw new Error("Live scoreboard date range is too wide");
  return Array.from({ length: (last - first) / DAY_MS + 1 }, (_, i) =>
    new Date(first + i * DAY_MS).toISOString().slice(0, 10).replaceAll("-", ""),
  );
}

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};
const array = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function mergeCompetitions(first: unknown, next: unknown): unknown[] {
  const found = new Map<string, unknown>();
  for (const row of [...array(first), ...array(next)]) {
    const id = object(row).id;
    if (typeof id === "string" || typeof id === "number") found.set(String(id), row);
  }
  return [...found.values()];
}

function mergeEvent(first: RawEvent, next: RawEvent): RawEvent {
  const groups = new Map<string, Record<string, unknown>>();
  for (const value of [...array(first.groupings), ...array(next.groupings)]) {
    const row = object(value),
      grouping = object(row.grouping);
    const key = String(grouping.id ?? grouping.uid ?? grouping.slug ?? grouping.displayName ?? "");
    const previous = groups.get(key);
    groups.set(
      key,
      previous
        ? {
            ...previous,
            ...row,
            competitions: mergeCompetitions(previous.competitions, row.competitions),
          }
        : row,
    );
  }
  return {
    ...first,
    ...next,
    competitions: mergeCompetitions(first.competitions, next.competitions),
    ...(groups.size ? { groupings: [...groups.values()] } : {}),
  };
}

/** ESPN rejects date ranges outright and silently resets limits above 1000 to 25, so a range is read one day at a time. */
export async function fetchLiveScoreboardEvents(
  endpoint: string,
  range: string,
  signal: AbortSignal,
  json: Json,
): Promise<RawEvent[]> {
  const days = rangeDays(range).length ? rangeDays(range) : [range];
  const read = async (dates: string): Promise<RawEvent[]> => {
    signal.throwIfAborted();
    const url = new URL(endpoint);
    url.searchParams.set("dates", dates);
    url.searchParams.set("limit", String(LIMIT));
    const data = await json(url.href, signal);
    signal.throwIfAborted();
    if (
      !Array.isArray(data.events) ||
      data.events.some(
        (row) => !row || typeof row !== "object" || typeof object(row).id !== "string",
      )
    ) {
      throw new Error("Invalid live scoreboard response");
    }
    return data.events as RawEvent[];
  };
  const events = new Map<string, RawEvent>();
  for (const day of days) {
    // Sequential within a slice keeps the shared feed concurrency limit meaningful.
    const page = await read(day);
    if (page.length >= LIMIT) throw new Error("Live scoreboard coverage is incomplete");
    for (const event of page) {
      const previous = events.get(event.id);
      events.set(event.id, previous ? mergeEvent(previous, event) : event);
    }
  }
  return [...events.values()];
}
