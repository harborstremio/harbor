import type { SportsGame } from "./espn-types";

export type SportsArtwork = {
  backdrop?: string;
  poster?: string;
  home?: string;
  away?: string;
};
type Entry = { at: number; complete: boolean; art: SportsArtwork };
const STORE_KEY = "harbor.sports.featured-artwork.v1";
const MAX_ENTRIES = 40,
  RETAIN_MS = 7 * 86400000;
const DB = "https://www.thesportsdb.com/api/v1/json/123";
const LEAGUE_IDS: Record<string, string> = {
  F1: "4370",
  NBA: "4387",
  EPL: "4328",
  UFC: "4443",
  BOXING: "4445",
};
const url = (value: unknown): string | undefined => {
  if (typeof value !== "string" || value.length > 2048) return;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password
      ? parsed.href
      : undefined;
  } catch {
    return;
  }
};
const cleanArtwork = (raw: unknown): SportsArtwork => {
  if (!raw || typeof raw !== "object") return {};
  return Object.fromEntries(
    ["backdrop", "poster", "home", "away"].flatMap((key) => {
      const value = url((raw as Record<string, unknown>)[key]);
      return value ? [[key, value]] : [];
    }),
  );
};
const scheduleIdle = (save: () => void) => {
  if (typeof window !== "undefined" && "requestIdleCallback" in window)
    window.requestIdleCallback(save, { timeout: 1500 });
  else setTimeout(save, 250);
};

/** URL metadata only; one bounded read hydrates the first render and writes wait for idle time. */
export function createSportsArtworkCache(
  options: {
    storage?: Pick<Storage, "getItem" | "setItem">;
    asyncStorage?: {
      getItem: (key: string) => Promise<string | null>;
      setItem: (key: string, value: string) => Promise<void>;
    };
    now?: () => number;
    schedule?: (save: () => void) => void;
  } = {},
) {
  const now = options.now ?? Date.now;
  const entries = new Map<string, Entry>();
  let hydrated = false,
    pendingSave = false;
  const validAge = (at: number) =>
    Number.isFinite(at) && now() - at >= -60000 && now() - at < RETAIN_MS;
  const ingest = (saved: string | null | undefined) => {
    try {
      if (!saved || saved.length > 400000) return;
      const decoded = JSON.parse(saved);
      if (decoded?.version !== 1 || !Array.isArray(decoded.entries)) return;
      for (const row of decoded.entries.slice(-MAX_ENTRIES)) {
        if (
          !Array.isArray(row) ||
          typeof row[0] !== "string" ||
          row[0].length > 240 ||
          !row[1] ||
          !validAge(row[1].at)
        )
          continue;
        const art = cleanArtwork(row[1].art);
        if (
          Object.keys(art).length &&
          (!entries.has(row[0]) || entries.get(row[0])!.at < row[1].at)
        )
          entries.set(row[0], {
            at: row[1].at,
            complete: row[1].complete === true,
            art,
          });
      }
      while (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value!);
    } catch {
      /* Corrupt or unavailable storage is not a missing event. */
    }
  };
  const hydrate = () => {
    if (hydrated) return;
    hydrated = true;
    try {
      ingest(options.storage?.getItem(STORE_KEY));
    } catch {
      /* Private mode. */
    }
  };
  let isReady = !options.asyncStorage;
  const ready = options.asyncStorage
    ? options.asyncStorage
        .getItem(STORE_KEY)
        .then(ingest)
        .catch(() => {})
        .finally(() => {
          isReady = true;
        })
    : Promise.resolve();
  const read = (key: string) => {
    hydrate();
    const hit = entries.get(key);
    if (!hit || !validAge(hit.at)) {
      entries.delete(key);
      return;
    }
    entries.delete(key);
    entries.set(key, hit);
    return hit;
  };
  const write = (key: string, art: SportsArtwork, complete: boolean) => {
    const prior = read(key);
    const entry = {
      at: now(),
      complete,
      art: { ...prior?.art, ...cleanArtwork(art) },
    };
    entries.delete(key);
    entries.set(key, entry);
    while (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value!);
    if ((options.storage || options.asyncStorage) && !pendingSave) {
      pendingSave = true;
      (options.schedule ?? scheduleIdle)(() => {
        pendingSave = false;
        const saved = JSON.stringify({
          version: 1,
          entries: [...entries].filter(
            ([, value]) => validAge(value.at) && Object.keys(value.art).length,
          ),
        });
        try {
          options.storage?.setItem(STORE_KEY, saved);
        } catch {
          /* Quota must never block the hero. */
        }
        void options.asyncStorage?.setItem(STORE_KEY, saved).catch(() => {});
      });
    }
    return entry;
  };
  const fresh = (entry: Entry | undefined) =>
    !!entry && now() - entry.at < (entry.complete ? 86400000 : 60000);
  return { read, write, fresh, ready, isReady: () => isReady };
}

let storage: Storage | undefined;
try {
  if (typeof localStorage !== "undefined") storage = localStorage;
} catch {
  /* Private mode. */
}
const cache = createSportsArtworkCache({
  storage,
  asyncStorage:
    typeof window === "undefined"
      ? undefined
      : {
          getItem: async (key) => (await import("./artwork-storage")).readArtworkMetadata(key),
          setItem: async (key, value) =>
            (await import("./artwork-storage")).writeArtworkMetadata(key, value),
        },
});
const inflight = new Map<string, Promise<SportsArtwork>>();

export function artworkCacheKey(game: SportsGame): string {
  const event = `${game.league}:${game.context?.id || game.id}`;
  // A fight card shares one event ID; different bouts must never share fighter portraits.
  return game.league === "UFC" ? `${event}:${game.home.id}:${game.away.id}` : event;
}
const eventArtwork = (game: SportsGame) =>
  cleanArtwork({ backdrop: game.artwork, poster: game.poster });
export function cachedArtwork(game: SportsGame): SportsArtwork {
  return { ...cache.read(artworkCacheKey(game))?.art, ...eventArtwork(game) };
}

async function leagueBackdrop(leagueId: string, signal: AbortSignal): Promise<SportsArtwork> {
  const key = `league:${leagueId}`;
  const hit = cache.read(key);
  if (cache.fresh(hit)) return hit!.art;
  if (inflight.has(key)) return inflight.get(key)!;
  const task = (async () => {
    try {
      const { sportsJson } = await import("./hub-runtime");
      const data = await sportsJson(`${DB}/lookupleague.php?id=${leagueId}`, signal);
      const league = (data.leagues as Record<string, unknown>[] | undefined)?.[0];
      const backdrop = url(league?.strFanart1);
      return cache.write(key, { backdrop }, !!backdrop).art;
    } catch {
      return cache.write(key, {}, false).art;
    }
  })().finally(() => inflight.delete(key));
  inflight.set(key, task);
  return task;
}

/** Decoration is independent of scores and requests only visible or featured events. */
export function fetchSportsArtwork(game: SportsGame): Promise<SportsArtwork> {
  if (!cache.isReady()) return cache.ready.then(() => fetchSportsArtwork(game));
  const key = artworkCacheKey(game);
  const hit = cache.read(key);
  if (cache.fresh(hit)) return Promise.resolve(cachedArtwork(game));
  if (inflight.has(key)) return inflight.get(key)!;
  const signal = AbortSignal.timeout(9500);
  const task = (async () => {
    const art = cachedArtwork(game);
    let complete = true;
    if (game.league === "UFC") {
      const { sportsJson } = await import("./hub-runtime");
      await Promise.all(
        (["home", "away"] as const).map(async (side) => {
          const who = game[side];
          if (!/^\d+$/.test(who.id) || /\b(?:TBA|TBD)\b/i.test(who.name)) return;
          try {
            const data = await sportsJson(
              `https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc/athletes/${encodeURIComponent(who.id)}`,
              signal,
            );
            const images = data.images as { href?: string }[] | undefined;
            const portrait = url(images?.[0]?.href);
            if (portrait) art[side] = portrait;
            else {
              complete = false;
              art[side] ||= url(who.logo);
            }
          } catch {
            complete = false;
            art[side] ||= url(who.logo);
          }
        }),
      );
    } else if (!art.backdrop && LEAGUE_IDS[game.league]) {
      // League fanart remains contextual decoration, not an image of this exact event.
      const leagueArt = await leagueBackdrop(LEAGUE_IDS[game.league], signal);
      art.backdrop = leagueArt.backdrop;
      complete = !!leagueArt.backdrop;
    }
    return cache.write(key, art, complete).art;
  })()
    .catch(() => cache.write(key, cachedArtwork(game), false).art)
    .finally(() => inflight.delete(key));
  inflight.set(key, task);
  return task;
}
