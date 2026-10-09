import type { SportsGame } from "./espn-types";

export type SportsSnapshot = {
  games: SportsGame[];
  at: number;
  stale: boolean;
  failed: number;
  failedKeys: string[];
  pending: number;
};
export type SportsSlice = { at: number; games: SportsGame[] };
export const gameKey = (g: SportsGame) => `${g.source ?? "espn"}:${g.league}:${g.id}`;

const freshFor = (key: string) => (key.endsWith("@upcoming") ? 15 * 60_000 : 90_000);
const sameRecord = (a: object | undefined, b: object | undefined) =>
  a === b ||
  (!!a &&
    !!b &&
    Object.keys(a).length === Object.keys(b).length &&
    Object.entries(a).every(([key, value]) => value === (b as Record<string, unknown>)[key]));
function sameGame(a: SportsGame, b: SportsGame) {
  return (
    a.id === b.id &&
    a.league === b.league &&
    a.source === b.source &&
    a.state === b.state &&
    a.startMs === b.startMs &&
    a.dateOnly === b.dateOnly &&
    a.detail === b.detail &&
    a.artwork === b.artwork &&
    a.poster === b.poster &&
    a.savedAt === b.savedAt &&
    sameRecord(a.home, b.home) &&
    sameRecord(a.away, b.away) &&
    sameRecord(a.context, b.context) &&
    (a.broadcasts ?? []).join("\u0000") === (b.broadcasts ?? []).join("\u0000")
  );
}

/** Keep unchanged fixtures mounted with the same props while scores refresh. */
export function reconcileSportsGames(previous: SportsGame[], next: SportsGame[]) {
  const byKey = new Map(previous.map((game) => [gameKey(game), game]));
  const games = next.map((game) => {
    const old = byKey.get(gameKey(game));
    return old && sameGame(old, game) ? old : game;
  });
  return games.length === previous.length && games.every((game, i) => game === previous[i])
    ? previous
    : games;
}

function renderedSlice(slice: SportsSlice, fresh: boolean): SportsSlice {
  if (fresh) return slice;
  return {
    ...slice,
    games: slice.games.map((game) => ({ ...game, savedAt: slice.at })),
  };
}

/** Synchronous hydration avoids an empty frame on reload or a return to a cached date. */
export function cachedSportsSnapshot(
  keys: string[],
  read: (key: string) => SportsSlice | undefined,
  now = Date.now(),
): SportsSnapshot {
  const slices = keys.flatMap((key) => {
    const hit = read(key);
    return hit ? [{ key, slice: hit }] : [];
  });
  const stale = slices.some(({ key, slice }) => now - slice.at > freshFor(key));
  return {
    games: mergeSlices(
      slices.map(({ key, slice }) => renderedSlice(slice, now - slice.at <= freshFor(key))),
    ),
    at: slices.length ? Math.min(...slices.map(({ slice }) => slice.at)) : 0,
    stale,
    failed: 0,
    failedKeys: [],
    pending: keys.length,
  };
}

export function mergeSlices(slices: SportsSlice[]): SportsGame[] {
  const games = new Map<string, SportsGame>();
  for (const slice of [...slices].sort((a, b) => a.at - b.at)) {
    for (const game of slice.games) games.set(gameKey(game), game);
  }
  const values = [...games.values()];
  const dayKey = (game: SportsGame) => {
    const date = new Date(game.startMs);
    return `${game.league}:${date.getFullYear()}:${date.getMonth()}:${date.getDate()}`;
  };
  const accountDays = new Set(values.filter((game) => game.source === "api-sports").map(dayKey));
  // The account's complete dated board supersedes that league/day in public upcoming calendars.
  return values
    .filter((game) => game.source !== "thesportsdb-hub" || !accountDays.has(dayKey(game)))
    .sort((a, b) => a.startMs - b.startMs);
}

/** One failed league cannot erase its last successful result or hold up its peers. */
export async function loadSportsSlices(
  keys: string[],
  read: (key: string) => SportsSlice | undefined,
  fetch: (key: string) => Promise<SportsGame[]>,
  save: (key: string, slice: SportsSlice) => void,
  emit: (snapshot: SportsSnapshot) => void,
  signal: AbortSignal,
  concurrency = 5,
  maxAge = 0,
) {
  const slices = new Map<string, SportsSlice>();
  const rendered = new Map<string, SportsSlice>();
  let failed = 0;
  const broken = new Set<string>();
  let pending = keys.length;
  const fresh = new Set<string>();
  for (const key of keys) {
    const hit = read(key);
    if (!hit) continue;
    slices.set(key, hit);
    if (Date.now() - hit.at <= freshFor(key)) fresh.add(key);
    rendered.set(key, renderedSlice(hit, fresh.has(key)));
  }
  let previous: SportsGame[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let firstResult = true;
  const publish = () => {
    clearTimeout(timer);
    timer = undefined;
    if (signal.aborted) return;
    const values = [...slices.values()];
    previous = reconcileSportsGames(previous, mergeSlices([...rendered.values()]));
    emit({
      games: previous,
      at: values.length ? Math.min(...values.map((s) => s.at)) : 0,
      stale: [...slices.keys()].some((key) => !fresh.has(key)),
      failed,
      failedKeys: [...broken],
      pending,
    });
  };
  const cancel = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  signal.addEventListener("abort", cancel, { once: true });
  const schedule = () => {
    // The first useful result is immediate; a burst of fast feeds shares one render.
    if (firstResult || pending === 0) {
      firstResult = false;
      publish();
    } else if (!timer) timer = setTimeout(publish, 80);
  };
  publish();
  let cursor = 0;
  try {
    await Promise.all(
      Array.from({ length: Math.min(concurrency, keys.length) }, async () => {
        while (!signal.aborted) {
          const key = keys[cursor++];
          if (key === undefined) return;
          const existing = slices.get(key);
          if (existing && maxAge > 0 && Date.now() - existing.at < maxAge) {
            pending--;
            schedule();
            continue;
          }
          try {
            const games = await fetch(key);
            if (signal.aborted) return;
            const slice = { games, at: Date.now() };
            slices.set(key, slice);
            fresh.add(key);
            broken.delete(key);
            save(key, slice);
            rendered.set(key, slice);
          } catch (reason) {
            if (!signal.aborted) {
              failed++;
              broken.add(key);
              console.warn(
                "[sports] feed failed",
                key,
                reason instanceof Error ? reason.message : String(reason),
              );
              fresh.delete(key);
              const hit = slices.get(key);
              if (hit) rendered.set(key, renderedSlice(hit, false));
            }
          }
          pending--;
          schedule();
        }
      }),
    );
  } finally {
    cancel();
    signal.removeEventListener("abort", cancel);
  }
}

export function eventCards(games: SportsGame[]): SportsGame[] {
  const events = new Map<string, SportsGame>();
  for (const g of games) {
    const key = g.context?.id ? `${g.source ?? "espn"}:${g.league}:${g.context.id}` : gameKey(g);
    const prior = events.get(key);
    // Main cards are later than prelims. Keep the headliner for event discovery.
    const headlineScore = (game: SportsGame) =>
      [game.home, game.away].filter((side) => {
        const last = side.name.toLowerCase().split(" ").at(-1);
        return last && last.length > 2 && game.context?.name.toLowerCase().includes(last);
      }).length;
    if (
      !prior ||
      headlineScore(g) > headlineScore(prior) ||
      (headlineScore(g) === headlineScore(prior) && g.context && g.startMs > prior.startMs)
    )
      events.set(key, g);
  }
  return [...events.values()].sort((a, b) => a.startMs - b.startMs);
}
