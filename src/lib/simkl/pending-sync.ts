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
  /** True when Simkl already lists the item as watched — the entry needs no write. */
  isWatched?: (
    metaId: string,
    episode: PendingEpisode | undefined,
    imdb?: string,
  ) => Promise<boolean>;
  /** True when Simkl still holds an active playback session for the item. */
  hasActivePlayback?: (
    metaId: string,
    episode: PendingEpisode | undefined,
    imdb?: string,
  ) => Promise<boolean>;
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
  scheduleSoon();
}

function clearPending(key: string): void {
  save(load().filter((p) => keyOf(p) !== key));
}

let flushDeps: FlushDeps | null = null;

// A queued watch must not wait for the next app launch. Retry shortly after a
// failure (past Simkl's 20s per-user scrobble lock), then on a slow clock.
const RETRY_INTERVAL_MS = 60_000;
const RETRY_SOON_MS = 20_000;

let retryTimer: number | null = null;
let soonTimer: number | null = null;
let flushing: Promise<{ flushed: number; remaining: number }> | null = null;

function hasWork(): boolean {
  if (!flushDeps || !flushDeps.hasSession()) return false;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  return load().length > 0;
}

function attemptFlush(): void {
  if (!hasWork()) return;
  void flushPendingWatches().catch(() => {});
}

/** Give a freshly queued watch a quick second chance before the slow clock. */
function scheduleSoon(): void {
  if (typeof window === "undefined") return;
  if (soonTimer != null) window.clearTimeout(soonTimer);
  soonTimer = window.setTimeout(() => {
    soonTimer = null;
    attemptFlush();
  }, RETRY_SOON_MS);
}

function startRetryTimer(): void {
  if (typeof window === "undefined" || retryTimer != null) return;
  retryTimer = window.setInterval(attemptFlush, RETRY_INTERVAL_MS);
}

function stopRetryTimer(): void {
  if (retryTimer != null) {
    window.clearInterval(retryTimer);
    retryTimer = null;
  }
  if (soonTimer != null) {
    window.clearTimeout(soonTimer);
    soonTimer = null;
  }
}

export function flushPendingWatches(
  deps?: FlushDeps,
): Promise<{ flushed: number; remaining: number }> {
  if (flushing) return flushing;
  flushing = replayPending(deps).finally(() => {
    flushing = null;
  });
  return flushing;
}

async function replayPending(deps?: FlushDeps): Promise<{ flushed: number; remaining: number }> {
  const d = deps ?? flushDeps;
  if (!d || !d.hasSession()) return { flushed: 0, remaining: load().length };
  const owner = storageKey();
  const started = generation;
  const stillOwned = () => owner === storageKey() && started === generation && d.hasSession();
  let flushed = 0;
  for (const p of load()) {
    if (!stillOwned()) break;
    const key = keyOf(p);
    // An item Simkl already lists as watched needs no write; replaying one
    // would only re-mark an entry the user may have removed from their history.
    try {
      if (d.isWatched && (await d.isWatched(p.metaId, p.episode, p.imdb))) {
        if (!stillOwned()) break;
        flushed += 1;
        clearPending(key);
        continue;
      }
    } catch {
      /* An unavailable lookup falls through to the write path. */
    }
    let stopOk = false;
    let histOk = false;
    try {
      // The terminal stop clears Simkl's "actively playing" state, which the
      // history write alone does not. Gated on a live session when the caller
      // can tell: without one it would only re-mark an unmarked item.
      if (!d.hasActivePlayback || (await d.hasActivePlayback(p.metaId, p.episode, p.imdb))) {
        if (!stillOwned()) break;
        stopOk = await d.stopScrobble(p.metaId, p.episode);
      }
    } catch {
      stopOk = false;
    }
    try {
      if (!stillOwned()) break;
      histOk = await d.recordWatched(p.metaId, p.episode, p.imdb);
    } catch {
      histOk = false;
    }
    // Either confirmed write means Simkl holds the watch: the stop is posted at
    // full progress, and the history write accepts the already-watched no-op.
    // Requiring both would loop forever whenever one lands and the other
    // reports the item as already present.
    if ((stopOk || histOk) && stillOwned()) {
      flushed += 1;
      clearPending(key);
    }
  }
  return { flushed, remaining: load().length };
}

/**
 * Arms the pending-watch replay: a failed write is retried on a timer and when
 * the browser regains its connection, instead of waiting for a relaunch.
 */
export function armPendingFlush(deps: FlushDeps): () => void {
  flushDeps = deps;
  if (typeof window === "undefined") return () => {};
  const onOnline = () => attemptFlush();
  window.addEventListener("online", onOnline);
  startRetryTimer();
  attemptFlush();
  return () => {
    window.removeEventListener("online", onOnline);
    stopRetryTimer();
  };
}
