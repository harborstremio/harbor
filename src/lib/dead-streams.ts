import type { ScoredStream } from "./streams/types";

type StreamLike = {
  infoHash?: string | null;
  fileIdx?: number | null;
  url?: string | null;
  addonId?: string | null;
  title?: string | null;
};

const STORAGE_KEY = "harbor.dead-streams.v1";
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const STUB_TTL_MS = 4 * 60 * 60 * 1000;
export const SHORT_PLAYBACK_SEC = 180;
const SHORT_RUNTIME_FLOOR_SEC = 90;

type Entry = { ts: number; reason: string; ttl?: number };
type Map = Record<string, Entry>;

function load(): Map {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Map;
  } catch {
    return {};
  }
}

function save(m: Map): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
  } catch {}
}

export function streamFingerprint(s: StreamLike): string | null {
  if (s.infoHash) return `h:${s.infoHash.toLowerCase()}:${s.fileIdx ?? ""}`;
  if (s.url) return `u:${s.url}`;
  if (s.addonId && s.title) return `t:${s.addonId}:${s.title}`;
  return null;
}

export function isStreamDead(s: StreamLike): boolean {
  const keys: string[] = [];
  const id = streamFingerprint(s);
  if (id) keys.push(id);
  if (s.infoHash) keys.push(`h:${s.infoHash.toLowerCase()}:`);
  if (keys.length === 0) return false;
  const m = load();
  for (const k of keys) {
    const e = m[k];
    if (!e) continue;
    const ttl = e.ttl ?? DEFAULT_TTL_MS;
    if (Date.now() - e.ts > ttl) {
      delete m[k];
      save(m);
      continue;
    }
    return true;
  }
  return false;
}

export function markStreamDead(s: StreamLike, reason: string, ttlMs?: number): void {
  const id = streamFingerprint(s);
  if (!id) return;
  const m = load();
  m[id] = { ts: Date.now(), reason, ttl: ttlMs };
  save(m);
}

let lastStubEvent: { at: number; reason: string } | null = null;

export function recordStubEvent(reason: string): void {
  lastStubEvent = { at: Date.now(), reason };
}

export function consumeRecentStubEvent(maxAgeMs: number): { reason: string } | null {
  if (!lastStubEvent) return null;
  if (Date.now() - lastStubEvent.at > maxAgeMs) {
    lastStubEvent = null;
    return null;
  }
  const out = { reason: lastStubEvent.reason };
  lastStubEvent = null;
  return out;
}

export function shouldFlagAsStub(opts: {
  durationSec: number;
  runtimeMinutes: number | null | undefined;
  isAnime?: boolean;
  bytesAdvertised?: number | null;
}): boolean {
  const { durationSec, runtimeMinutes, isAnime, bytesAdvertised } = opts;
  if (durationSec <= 0 || durationSec >= SHORT_PLAYBACK_SEC) return false;
  const runtimeSec = runtimeMinutes ? runtimeMinutes * 60 : null;
  if (runtimeSec != null && runtimeSec < SHORT_RUNTIME_FLOOR_SEC) return false;
  if (isAnime && (runtimeSec == null || runtimeSec < 600)) return false;
  if (bytesAdvertised != null && bytesAdvertised < 100 * 1024 * 1024) return false;
  return true;
}

export function filterDead<T extends StreamLike>(streams: T[]): T[] {
  return streams.filter((s) => !isStreamDead(s));
}

export function clearDeadStreams(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function _typeAssertScored(s: ScoredStream): boolean {
  return !!s.url || !!s.infoHash;
}
