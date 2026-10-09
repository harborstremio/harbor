import type { TraktEpisodeRef } from "./ids";
import type { TraktTarget } from "./types";

const KEY = "harbor.trakt.pendingstops.v1";
// Tracker accounts belong to Harbor profiles; never replay an unowned legacy queue.
import { activeProfileId } from "@/lib/active-profile-id";

let generation = 0;
function storageKey(): string {
  return `${KEY}.${activeProfileId()}`;
}
export function clearPendingStops(): void {
  generation += 1;
  try {
    localStorage.removeItem(storageKey());
  } catch {
    /* ignore unavailable storage */
  }
}
const MAX = 50;
const WATCHED_PCT = 70;

export type PendingStop = {
  metaId: string;
  episode?: TraktEpisodeRef;
  progress: number;
  at: number;
};

export type ScrobbleStopOutcome = "recorded" | "already-recorded" | "not-found" | "failed";

export type FlushDeps = {
  hasSession: () => boolean;
  resolveTarget: (metaId: string, episode?: TraktEpisodeRef) => TraktTarget | null;
  commit: (target: TraktTarget, metaId: string, progress: number) => Promise<ScrobbleStopOutcome>;
};

function keyOf(p: Pick<PendingStop, "metaId" | "episode">): string {
  const e = p.episode;
  return `${p.metaId}|${e?.season ?? ""}|${e?.episode ?? ""}`;
}

function load(): PendingStop[] {
  try {
    const raw = localStorage.getItem(storageKey());
    const parsed = raw ? (JSON.parse(raw) as PendingStop[]) : [];
    return Array.isArray(parsed) ? parsed.filter((p) => p && typeof p.metaId === "string") : [];
  } catch {
    return [];
  }
}

function save(list: PendingStop[]): void {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

export function listPendingStops(): PendingStop[] {
  return load();
}

export function recordPendingStop(
  metaId: string,
  episode: TraktEpisodeRef | undefined,
  progress: number,
): void {
  if (!metaId || progress < WATCHED_PCT) return;
  const next: PendingStop = {
    metaId,
    episode,
    progress: Math.max(0, Math.min(100, progress)),
    at: Date.now(),
  };
  const rest = load().filter((p) => keyOf(p) !== keyOf(next));
  save([next, ...rest]);
}

function clearPending(key: string): void {
  save(load().filter((p) => keyOf(p) !== key));
}

let flushDeps: FlushDeps | null = null;

export async function flushPendingStops(
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
    const target = d.resolveTarget(p.metaId, p.episode);
    if (!target) {
      clearPending(key);
      continue;
    }
    let outcome: ScrobbleStopOutcome = "failed";
    try {
      outcome = await d.commit(target, p.metaId, p.progress >= WATCHED_PCT ? 100 : p.progress);
    } catch {
      outcome = "failed";
    }
    if (!stillOwned()) break;
    // not-found is terminal: the episode is absent from the catalog, so retrying is pointless.
    const terminal = outcome !== "failed";
    if (terminal) {
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
    void flushPendingStops().catch(() => {});
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
