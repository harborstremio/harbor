import { useSyncExternalStore } from "react";
import type { AddonProgress } from "./streams/addons";
import type { PlayerSrc } from "./view";
import type { PlaybackAudioChoice } from "./player/audio-choice";

export type PlaybackEntry = {
  infoHash?: string | null;
  fileIdx?: number | null;
  addonId?: string | null;
  url?: string | null;
  title?: string | null;
  parsedTitle?: string | null;
  resolution?: string | null;
  releaseGroup?: string | null;
  source?: string | null;
  size?: number | null;
  bingeGroup?: string | null;
  cachedSlugs?: string[];
  savedAt: number;
  /** Written by observed player activity, never by source selection or watched edits. */
  actual?: ActualPlayback;
};

export type PlaybackActor = {
  profileId: string;
  storageProfileId: string;
  accountId: string | null;
};

export type ActualPlayback = {
  id: string;
  actor: PlaybackActor;
  playedAt: number;
  positionMs: number;
  durationMs: number;
  completed: boolean;
  src: Omit<PlayerSrc, "continuation">;
  requiresSourceRefresh?: boolean;
  audioTrack?: PlaybackAudioChoice;
};

export type PlaybackContinuation = {
  id: string;
  positionMs: number;
  source: Omit<PlaybackEntry, "actual">;
  sourceKey: string;
  actor: PlaybackActor;
  restart?: boolean;
  audioTrack?: PlaybackAudioChoice;
};

const STORAGE_KEY_PREFIX = "harbor.playback-history.v1.";
const LEGACY_STORAGE_KEY = "harbor.playback-history.v1";
const PROFILES_KEY = "harbor.profiles.v1";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 200;

const listeners = new Set<() => void>();

export function capturePlaybackActor(): PlaybackActor {
  const storageProfileId = activeProfileId();
  try {
    const state = JSON.parse(localStorage.getItem(PROFILES_KEY) ?? "null") as {
      activeId?: string;
    } | null;
    const session = JSON.parse(
      localStorage.getItem(`harbor.auth.${storageProfileId}`) ?? "null",
    ) as {
      user?: { _id?: string };
    } | null;
    return {
      profileId: state?.activeId ?? storageProfileId,
      storageProfileId,
      accountId: session?.user?._id ?? null,
    };
  } catch {
    return { profileId: storageProfileId, storageProfileId, accountId: null };
  }
}

export function isPlaybackActorCurrent(actor: PlaybackActor): boolean {
  const current = capturePlaybackActor();
  return (
    current.profileId === actor.profileId &&
    current.storageProfileId === actor.storageProfileId &&
    current.accountId === actor.accountId
  );
}

function activeProfileId(): string {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return "";
    const s = JSON.parse(raw) as {
      activeId?: string;
      profiles?: Array<{ id?: string; isPrimary?: boolean; shareStremioWith?: string | null }>;
    };
    const profiles = Array.isArray(s.profiles) ? s.profiles : [];
    const active = profiles.find((p) => p.id === s.activeId) ?? null;
    const own = active?.id ?? profiles.find((p) => p?.isPrimary)?.id ?? "";
    if (!own) return "";
    if (active && typeof active.shareStremioWith === "string" && active.shareStremioWith) {
      const shared = profiles.find((p) => p.id === active.shareStremioWith);
      if (shared?.id) return shared.id;
    }
    return own;
  } catch {
    return "";
  }
}

function primaryProfileId(): string {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    const s = raw
      ? (JSON.parse(raw) as { profiles?: Array<{ id?: string; isPrimary?: boolean }> })
      : null;
    const primary = s?.profiles?.find((p) => p?.isPrimary);
    return (primary && typeof primary.id === "string" && primary.id) || activeProfileId();
  } catch {
    return activeProfileId();
  }
}

function storeKey(): string {
  const id = activeProfileId();
  return id ? STORAGE_KEY_PREFIX + id : LEGACY_STORAGE_KEY;
}

function migrateLegacy(): void {
  try {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacy) return;
    const pid = primaryProfileId();
    if (!pid) return;
    const perKey = STORAGE_KEY_PREFIX + pid;
    if (!localStorage.getItem(perKey)) localStorage.setItem(perKey, legacy);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    /* noop */
  }
}

export function subscribePlayback(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function entryKey(metaId: string, season?: number, episode?: number): string {
  if (typeof season === "number" && typeof episode === "number") {
    return `${metaId}|s${season}e${episode}`;
  }
  return metaId;
}

function readAll(): Record<string, PlaybackEntry> {
  migrateLegacy();
  try {
    const raw = localStorage.getItem(storeKey());
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, PlaybackEntry>;
    const now = Date.now();
    const fresh: Record<string, PlaybackEntry> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (!v?.savedAt) continue;
      if (now - v.savedAt > TTL_MS) continue;
      fresh[k] = v;
    }
    return fresh;
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, PlaybackEntry>): void {
  try {
    const keys = Object.keys(map);
    if (keys.length > MAX_ENTRIES) {
      const sorted = Object.entries(map).sort((a, b) => b[1].savedAt - a[1].savedAt);
      map = Object.fromEntries(sorted.slice(0, MAX_ENTRIES));
    }
    localStorage.setItem(storeKey(), JSON.stringify(map));
  } catch {
    // A failed replacement must leave the last persisted source/session intact.
    return;
  }
  listeners.forEach((l) => l());
}

export function playbackHistoryRawKeys(): string[] {
  migrateLegacy();
  try {
    const raw = localStorage.getItem(storeKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, PlaybackEntry>;
    return Object.keys(parsed);
  } catch {
    return [];
  }
}

export function savePlayback(
  metaId: string,
  entry: Omit<PlaybackEntry, "savedAt">,
  season?: number,
  episode?: number,
): void {
  const all = readAll();
  const key = entryKey(metaId, season, episode);
  const prev = all[key];
  const thin = !entry.infoHash && !entry.addonId && !entry.url;
  all[key] =
    thin && prev
      ? {
          ...prev,
          title: entry.title ?? prev.title,
          parsedTitle: entry.parsedTitle ?? prev.parsedTitle,
          savedAt: Date.now(),
        }
      : { ...entry, actual: prev?.actual, savedAt: Date.now() };
  writeAll(all);
}

export function recordActualPlayback(playback: ActualPlayback): boolean {
  if (!isPlaybackActorCurrent(playback.actor) || !validActualPlayback(playback)) return false;
  const all = readAll();
  const key = entryKey(
    playback.src.meta.id,
    playback.src.episode?.season,
    playback.src.episode?.episode,
  );
  const previous = all[key];
  const previousActual = previous?.actual;
  // mpv can clear its track list at natural EOF. That is not a new audio
  // choice; keep only the last observed choice from this exact session.
  const actual =
    playback.completed &&
    !playback.audioTrack &&
    previousActual?.audioTrack &&
    validActualPlayback(previousActual) &&
    previousActual.id === playback.id &&
    isPlaybackActorCurrent(previousActual.actor) &&
    playbackSourceKey(previousActual.src) === playbackSourceKey(playback.src)
      ? { ...playback, audioTrack: previousActual.audioTrack }
      : playback;
  const next = {
    ...all,
    [key]: {
      ...previous,
      title: previous?.title ?? playback.src.meta.name,
      savedAt: Math.max(previous?.savedAt ?? 0, playback.playedAt),
      actual,
    },
  };
  const entries = Object.entries(next).sort((a, b) => b[1].savedAt - a[1].savedAt);
  try {
    localStorage.setItem(
      storeKey(),
      JSON.stringify(Object.fromEntries(entries.slice(0, MAX_ENTRIES))),
    );
  } catch {
    return false;
  }
  listeners.forEach((listener) => listener());
  return true;
}

function validActualPlayback(value: ActualPlayback): boolean {
  return (
    !!value &&
    typeof value.id === "string" &&
    !!value.id &&
    Number.isFinite(value.playedAt) &&
    Number.isFinite(value.positionMs) &&
    value.positionMs >= 0 &&
    Number.isFinite(value.durationMs) &&
    value.durationMs >= 0 &&
    !!value.actor &&
    typeof value.actor.storageProfileId === "string" &&
    typeof value.src?.url === "string" &&
    !!value.src.url &&
    typeof value.src?.meta?.id === "string" &&
    !!value.src.meta.id &&
    typeof value.src.meta.name === "string"
  );
}

export function readLastActualPlayback(): ActualPlayback | null {
  const actor = capturePlaybackActor();
  let last: ActualPlayback | null = null;
  for (const entry of Object.values(readAll())) {
    const actual = entry.actual;
    if (
      !actual ||
      !validActualPlayback(actual) ||
      actual.actor.storageProfileId !== actor.storageProfileId ||
      actual.actor.accountId !== actor.accountId
    )
      continue;
    if (!last || actual.playedAt > last.playedAt) last = actual;
  }
  return last;
}

export function playbackSourceKey(
  src: Pick<PlayerSrc, "url" | "historyUrl" | "streamRef" | "homeServer">,
): string {
  if (src.homeServer)
    return `server:${src.homeServer.connectionId}:${src.homeServer.itemId}:${src.homeServer.versionId}`;
  if (src.streamRef?.infoHash)
    return `torrent:${src.streamRef.infoHash.toLowerCase()}:${src.streamRef.fileIdx ?? ""}`;
  return src.historyUrl ?? src.url;
}

export function readActualPlaybackFor(src: PlayerSrc): ActualPlayback | null {
  const entry = readAll()[entryKey(src.meta.id, src.episode?.season, src.episode?.episode)]?.actual;
  const actor = capturePlaybackActor();
  return entry &&
    validActualPlayback(entry) &&
    entry.actor.storageProfileId === actor.storageProfileId &&
    entry.actor.accountId === actor.accountId &&
    playbackSourceKey(entry.src) === playbackSourceKey(src)
    ? entry
    : null;
}

export function readPlayback(
  metaId: string,
  season?: number,
  episode?: number,
): PlaybackEntry | null {
  const all = readAll();
  return all[entryKey(metaId, season, episode)] ?? null;
}

export function clearPlayback(metaId: string, season?: number, episode?: number): void {
  const all = readAll();
  const key = entryKey(metaId, season, episode);
  const actual = all[key]?.actual;
  if (actual) all[key] = { savedAt: actual.playedAt, title: actual.src.meta.name, actual };
  else delete all[key];
  writeAll(all);
}

export function streamMatchesEntry(
  s: {
    infoHash?: string | null;
    fileIdx?: number | null;
    url?: string | null;
    addonId?: string | null;
    parsedTitle?: string | null;
    resolution?: string | null;
    source?: string | null;
    size?: number | null;
  },
  e: PlaybackEntry,
): boolean {
  if (e.infoHash && s.infoHash) {
    if (s.infoHash.toLowerCase() !== e.infoHash.toLowerCase()) return false;
    if (e.fileIdx == null || s.fileIdx == null) return true;
    return s.fileIdx === e.fileIdx;
  }
  if (
    e.addonId &&
    s.addonId === e.addonId &&
    e.parsedTitle &&
    s.parsedTitle === e.parsedTitle &&
    e.resolution === s.resolution &&
    e.source === s.source &&
    (e.fileIdx == null || s.fileIdx == null || e.fileIdx === s.fileIdx) &&
    (e.size == null || s.size == null || e.size === s.size)
  ) {
    return true;
  }
  if (e.url && s.url) return s.url === e.url;
  return false;
}

export type WatchedSet = { ids: Set<string>; titles: Set<string> };

export function watchTitleKey(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/\(\d{4}\)/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function recentlyPlayed(): WatchedSet {
  const ids = new Set<string>();
  const titles = new Set<string>();
  for (const [key, entry] of Object.entries(readAll())) {
    const base = key.split("|")[0];
    if (base) ids.add(base);
    const parsed = watchTitleKey(entry.parsedTitle);
    if (parsed) titles.add(parsed);
    const raw = watchTitleKey(entry.title);
    if (raw) titles.add(raw);
  }
  return { ids, titles };
}

export function useWatchedCount(): number {
  return useSyncExternalStore(
    subscribePlayback,
    () => recentlyPlayed().ids.size,
    () => 0,
  );
}

export function playbackEntries(): Array<{
  metaId: string;
  savedAt: number;
  title?: string;
  parsedTitle?: string;
}> {
  const out: Array<{ metaId: string; savedAt: number; title?: string; parsedTitle?: string }> = [];
  for (const [key, entry] of Object.entries(readAll())) {
    const metaId = key.split("|")[0];
    if (!metaId || typeof entry.savedAt !== "number") continue;
    out.push({
      metaId,
      savedAt: entry.savedAt,
      title: entry.title ?? undefined,
      parsedTitle: entry.parsedTitle ?? undefined,
    });
  }
  return out;
}

export function readLastSeriesPlayback(metaId: string): PlaybackEntry | null {
  const all = readAll();
  const prefix = `${metaId}|`;
  let best: PlaybackEntry | null = null;
  for (const [key, entry] of Object.entries(all)) {
    if (key !== metaId && !key.startsWith(prefix)) continue;
    if (!best || entry.savedAt > best.savedAt) best = entry;
  }
  return best;
}

export function streamMatchesSource(
  s: {
    infoHash?: string | null;
    addonId?: string | null;
    resolution?: string | null;
    source?: string | null;
    behaviorHints?: { bingeGroup?: string };
  },
  e: PlaybackEntry,
): boolean {
  if (e.infoHash && s.infoHash) {
    return s.infoHash.toLowerCase() === e.infoHash.toLowerCase();
  }
  const sBinge = s.behaviorHints?.bingeGroup ?? null;
  if (e.bingeGroup && sBinge) return sBinge === e.bingeGroup;
  return (
    !!e.addonId && s.addonId === e.addonId && e.resolution === s.resolution && e.source === s.source
  );
}

export function streamMatchesReleaseLineage(
  s: {
    infoHash?: string | null;
    addonId?: string | null;
    resolution?: string | null;
    source?: string | null;
    releaseGroupNormalized?: string | null;
    behaviorHints?: { bingeGroup?: string };
  },
  e: PlaybackEntry,
): boolean {
  if (streamMatchesSource(s, e)) return true;
  if (!e.releaseGroup || !s.releaseGroupNormalized) return false;
  if (s.releaseGroupNormalized !== e.releaseGroup) return false;
  if (e.addonId && s.addonId !== e.addonId) return false;
  return e.resolution === s.resolution && e.source === s.source;
}

export function preferredSourceAddonPending(
  entry: PlaybackEntry | null,
  sourceMatched: boolean,
  pipelineDone: boolean,
  progress: AddonProgress,
): boolean {
  const addonId = entry?.addonId;
  if (!addonId || sourceMatched || pipelineDone) return false;
  if (!progress.queriedAddonIds.includes(addonId)) return false;
  return !progress.settledAddonIds.includes(addonId);
}
