import { activeProfileId } from "@/lib/active-profile-id";
import type { PmdbTarget } from "./types";

const KEY = "harbor.publicmetadb.pendingresume.v1";
const MAX = 20;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type PendingResume = {
  key: string;
  target: PmdbTarget;
  positionMs: number;
  runtimeMs: number;
  at: number;
};

export type ResumeFlushDeps = {
  hasSession: () => boolean;
  save: (target: PmdbTarget, positionMs: number, runtimeMs: number) => Promise<boolean>;
};

export function pendingResumeKey(target: PmdbTarget): string {
  const id =
    target.tmdb_id != null
      ? `tmdb:${target.tmdb_id}`
      : `${target.id_type ?? "?"}:${target.id_value ?? "?"}`;
  return `${target.media_type}|${id}|${target.season ?? ""}|${target.episode ?? ""}`;
}

let generation = 0;
function storageKey(): string {
  return `${KEY}.${activeProfileId()}`;
}

export function clearPendingResumes(): void {
  generation += 1;
  try {
    localStorage.removeItem(storageKey());
  } catch {
    /* ignore unavailable storage */
  }
}

function validTarget(t: PmdbTarget | undefined | null): t is PmdbTarget {
  if (!t || typeof t !== "object") return false;
  return t.media_type === "movie" || t.media_type === "tv";
}

function load(): PendingResume[] {
  try {
    const raw = localStorage.getItem(storageKey());
    const parsed = raw ? (JSON.parse(raw) as PendingResume[]) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p) =>
        p &&
        typeof p.key === "string" &&
        validTarget(p.target) &&
        Number.isFinite(p.positionMs) &&
        Number.isFinite(p.runtimeMs) &&
        (p.runtimeMs as number) > 0 &&
        typeof p.at === "number",
    );
  } catch {
    return [];
  }
}

function save(list: PendingResume[]): void {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

export function listPendingResumes(): PendingResume[] {
  return load();
}

function dropPending(key: string): void {
  save(load().filter((p) => p.key !== key));
}

export function removePendingResume(key: string): void {
  dropPending(key);
}

export function recordPendingResume(
  target: PmdbTarget,
  positionMs: number,
  runtimeMs: number,
  at: number = Date.now(),
): string | null {
  if (!validTarget(target)) return null;
  if (!Number.isFinite(positionMs) || !Number.isFinite(runtimeMs) || runtimeMs <= 0) return null;
  if (!Number.isFinite(at)) return null;
  const key = pendingResumeKey(target);
  const next: PendingResume = {
    key,
    target,
    positionMs: Math.round(positionMs),
    runtimeMs: Math.round(runtimeMs),
    at,
  };
  const rest = load().filter((p) => {
    if (p.key !== key) return true;
    // Newest write wins: a stale retry must not clobber fresher progress.
    return p.at > at;
  });
  if (rest.some((p) => p.key === key)) return key;
  save([next, ...rest]);
  return key;
}

let flushDeps: ResumeFlushDeps | null = null;

export async function flushPendingResumes(
  deps?: ResumeFlushDeps,
): Promise<{ flushed: number; remaining: number }> {
  const d = deps ?? flushDeps;
  if (!d || !d.hasSession()) return { flushed: 0, remaining: load().length };
  const owner = storageKey();
  const started = generation;
  const stillOwned = () => owner === storageKey() && started === generation && d.hasSession();
  const now = Date.now();

  // Expired entries can never succeed usefully; drop them without network.
  const fresh = load().filter((p) => now - p.at < TTL_MS);
  if (fresh.length !== load().length) save(fresh);

  let flushed = 0;
  for (const p of fresh) {
    if (!stillOwned()) break;
    let ok = false;
    try {
      ok = await d.save(p.target, p.positionMs, p.runtimeMs);
    } catch {
      ok = false;
    }
    if (!stillOwned()) break;
    if (!ok) break;
    flushed += 1;
    dropPending(p.key);
  }
  return { flushed, remaining: load().length };
}

let onlineArmed = false;

export function armOnlineFlush(deps: ResumeFlushDeps): () => void {
  flushDeps = deps;
  if (typeof window === "undefined") return () => {};
  const onOnline = () => {
    void flushPendingResumes().catch(() => {});
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
