import type { ExternalCwSource } from "@/lib/stremio";
import { privateCwProfileId } from "./cw-profile";

const KEY = "harbor.resume";
const PRIVATE_PREFIX = "harbor.resume.private.v1.";

function readKey(): string {
  const profileId = privateCwProfileId();
  return profileId ? PRIVATE_PREFIX + profileId : KEY;
}

type Entry = { ms: number; t: number; s?: number; pct?: number; source?: ExternalCwSource };

function entryKey(id: string, season?: number, episode?: number): string {
  if (typeof season === "number" && typeof episode === "number") {
    return `${id}|s${season}e${episode}`;
  }
  return id;
}

function readAll(key = readKey()): Record<string, Entry> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, Entry>) : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, Entry>, key: string): void {
  try {
    localStorage.setItem(key, JSON.stringify(all));
  } catch {
    /* noop */
  }
}

export function saveResumeMs(
  id: string,
  ms: number,
  season?: number,
  episode?: number,
  displaySeason?: number,
  pct?: number,
  source?: ExternalCwSource,
  ownerId?: string,
): void {
  if (!Number.isFinite(ms) || ms < 0) return;
  if (typeof season === "number" && typeof episode === "number") {
    if (season < 0 || episode < 1) return;
  }
  const s = typeof displaySeason === "number" && displaySeason >= 1 ? displaySeason : undefined;
  const p = pct !== undefined && Number.isFinite(pct) && pct >= 0 && pct <= 1 ? pct : undefined;
  const entry: Entry = {
    ms,
    t: Date.now(),
    ...(s !== undefined ? { s } : {}),
    ...(p !== undefined ? { pct: p } : {}),
    ...(source !== undefined ? { source } : {}),
  };
  // Imported/cloud progress never establishes a profile's playback ownership.
  for (const key of ownerId ? [KEY, PRIVATE_PREFIX + ownerId] : [KEY]) {
    const all = readAll(key);
    all[entryKey(id, season, episode)] = entry;
    writeAll(all, key);
  }
}

export function saveResumeBatch(
  entries: {
    id: string;
    ms: number;
    season?: number;
    episode?: number;
    t?: number;
    pct?: number;
    source?: ExternalCwSource;
  }[],
): void {
  if (entries.length === 0) return;
  const all = readAll(KEY);
  const now = Date.now();
  for (const e of entries) {
    if (!Number.isFinite(e.ms) || e.ms < 0) continue;
    if (typeof e.season === "number" && typeof e.episode === "number") {
      if (e.season < 0 || e.episode < 1) continue;
    }
    const p =
      e.pct !== undefined && Number.isFinite(e.pct) && e.pct >= 0 && e.pct <= 1 ? e.pct : undefined;
    all[entryKey(e.id, e.season, e.episode)] = {
      ms: e.ms,
      t: e.t ?? now,
      ...(p !== undefined ? { pct: p } : {}),
      ...(e.source !== undefined ? { source: e.source } : {}),
    };
  }
  writeAll(all, KEY);
}

export function readResumeMs(id: string, season?: number, episode?: number): number {
  const all = readAll();
  return all[entryKey(id, season, episode)]?.ms ?? 0;
}

export function readResumeEntry(
  id: string,
  season?: number,
  episode?: number,
): { ms: number; t: number; s?: number; pct?: number; source?: ExternalCwSource } | null {
  const all = readAll();
  const e = all[entryKey(id, season, episode)];
  return e
    ? {
        ms: e.ms,
        t: e.t,
        ...(e.s !== undefined ? { s: e.s } : {}),
        ...(e.pct !== undefined ? { pct: e.pct } : {}),
        ...(e.source !== undefined ? { source: e.source } : {}),
      }
    : null;
}

export function readResumeSource(
  id: string,
  season?: number,
  episode?: number,
): ExternalCwSource | undefined {
  return readAll()[entryKey(id, season, episode)]?.source;
}

export function clearResume(id: string, season?: number, episode?: number, ownerId?: string): void {
  for (const key of ownerId ? [KEY, PRIVATE_PREFIX + ownerId] : [readKey()]) {
    const all = readAll(key);
    delete all[entryKey(id, season, episode)];
    writeAll(all, key);
  }
}

export function lastPlayedEpisode(seriesId: string): {
  season: number;
  episode: number;
  ms: number;
  t: number;
  displaySeason?: number;
  pct?: number;
  source?: ExternalCwSource;
} | null {
  const all = readAll();
  const prefix = `${seriesId}|s`;
  let best: {
    season: number;
    episode: number;
    ms: number;
    t: number;
    displaySeason?: number;
    pct?: number;
    source?: ExternalCwSource;
  } | null = null;
  for (const [key, value] of Object.entries(all)) {
    if (!key.startsWith(prefix)) continue;
    const m = key.match(/\|s(\d+)e(\d+)$/);
    if (!m) continue;
    const season = parseInt(m[1], 10);
    const episode = parseInt(m[2], 10);
    if (season < 1 || episode < 1) continue;
    if (!best || value.t > best.t) {
      best = {
        season,
        episode,
        ms: value.ms,
        t: value.t,
        displaySeason: value.s,
        pct: value.pct,
        source: value.source,
      };
    }
  }
  return best;
}
