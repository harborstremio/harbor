const KEY = "harbor.simkl.pendingwatched.v1";
// Tracker accounts belong to Harbor profiles; never replay an unowned legacy queue.
import { activeProfileId } from "@/lib/active-profile-id";

let generation = 0;
function storageKey(): string {
  return `${KEY}.${activeProfileId()}`;
}
export function clearPendingWatches(): void {
  generation += 1;
  try {
    localStorage.removeItem(storageKey());
  } catch {
    /* ignore unavailable storage */
  }
}
const MAX = 50;

export type PendingEpisode = {
  season: number;
  episode: number;
  imdbId?: string;
  imdbSeason?: number;
  imdbEpisode?: number;
  tvdbEpisodeId?: number;
};

export type PendingWatch = {
  metaId: string;
  episode?: PendingEpisode;
  imdb?: string;
  at: number;
};

export type FlushDeps = {
  hasSession: () => boolean;
  stopScrobble: (metaId: string, episode: PendingEpisode | undefined) => Promise<boolean>;
  recordWatched: (
    metaId: string,
    episode: PendingEpisode | undefined,
    imdb?: string,
  ) => Promise<boolean>;
};

function keyOf(p: Pick<PendingWatch, "metaId" | "episode">): string {
  const e = p.episode;
  return `${p.metaId}|${e?.season ?? ""}|${e?.episode ?? ""}`;
}

function validSeason(v: number | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

function validEpisode(v: number | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 1;
}

function load(): PendingWatch[] {
  try {
    const raw = localStorage.getItem(storageKey());
    const parsed = raw ? (JSON.parse(raw) as PendingWatch[]) : [];
    return Array.isArray(parsed) ? parsed.filter((p) => p && typeof p.metaId === "string") : [];
  } catch {
    return [];
  }
}

function save(list: PendingWatch[]): void {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

export function listPendingWatches(): PendingWatch[] {
  return load();
}

function cleanEpisode(ep: PendingEpisodeInput): PendingEpisode | undefined {
  if (ep == null) return undefined;
  if (!validSeason(ep.season) || !validEpisode(ep.episode)) return undefined;
  const out: PendingEpisode = { season: ep.season, episode: ep.episode };
  if (typeof ep.imdbId === "string" && /^tt\d+$/.test(ep.imdbId)) out.imdbId = ep.imdbId;
  if (typeof ep.imdbSeason === "number" && Number.isFinite(ep.imdbSeason) && ep.imdbSeason >= 0) {
    out.imdbSeason = ep.imdbSeason;
  }
  if (
    typeof ep.imdbEpisode === "number" &&
    Number.isFinite(ep.imdbEpisode) &&
    ep.imdbEpisode >= 1
  ) {
    out.imdbEpisode = ep.imdbEpisode;
  }
  if (
    typeof ep.tvdbEpisodeId === "number" &&
    Number.isFinite(ep.tvdbEpisodeId) &&
    ep.tvdbEpisodeId > 0
  ) {
    out.tvdbEpisodeId = ep.tvdbEpisodeId;
  }
  return out;
}

export type PendingEpisodeInput =
  | {
      season?: number;
      episode?: number;
      imdbId?: string;
      imdbSeason?: number;
      imdbEpisode?: number;
      tvdbEpisodeId?: number;
    }
  | undefined
  | null;

export function recordPendingWatch(
  metaId: string,
  episode: PendingEpisodeInput,
  imdb?: string,
): void {
  if (!metaId) return;
  const clean = cleanEpisode(episode);
  if (episode != null && !clean) return;
  const next: PendingWatch = {
    metaId,
    ...(clean ? { episode: clean } : {}),
    ...(imdb ? { imdb } : {}),
    at: Date.now(),
  };
  const rest = load().filter((p) => keyOf(p) !== keyOf(next));
  save([next, ...rest]);
}

function clearPending(key: string): void {
  save(load().filter((p) => keyOf(p) !== key));
}

let flushDeps: FlushDeps | null = null;

export async function flushPendingWatches(
  deps?: FlushDeps,
): Promise<{ flushed: number; remaining: number }> {
  const d = deps ?? flushDeps;
  if (!d || !d.hasSession()) return { flushed: 0, remaining: load().length };
  const owner = storageKey();
  const started = generation;
  const stillOwned = () => owner === storageKey() && started === generation && d.hasSession();
  let flushed = 0;
  for (const p of load()) {
    if (!stillOwned()) break;
    const key = keyOf(p);
    let stopOk = false;
    let histOk = false;
    try {
      // Replays the terminal stop first: this is what clears Simkl's
      // "actively playing" state. The history write alone does not.
      stopOk = await d.stopScrobble(p.metaId, p.episode);
    } catch {
      stopOk = false;
    }
    try {
      if (!stillOwned()) break;
      histOk = await d.recordWatched(p.metaId, p.episode, p.imdb);
    } catch {
      histOk = false;
    }
    if (stopOk && histOk && stillOwned()) {
      flushed += 1;
      clearPending(key);
    }
  }
  return { flushed, remaining: load().length };
}

let onlineArmed = false;

export function armOnlineFlush(deps: FlushDeps): () => void {
  flushDeps = deps;
  if (typeof window === "undefined") return () => {};
  const onOnline = () => {
    void flushPendingWatches().catch(() => {});
  };
  if (!onlineArmed) {
    onlineArmed = true;
    window.addEventListener("online", onOnline);
    return () => {
      onlineArmed = false;
      window.removeEventListener("online", onOnline);
    };
  }
  window.addEventListener("online", onOnline);
  return () => window.removeEventListener("online", onOnline);
}
