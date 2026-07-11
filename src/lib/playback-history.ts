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
};

const STORAGE_KEY = "harbor.playback-history.v1";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 200;

const listeners = new Set<() => void>();

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
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    if (e instanceof DOMException && (e.name === "QuotaExceededError" || e.code === 22)) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
  }
  listeners.forEach((l) => l());
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
      : { ...entry, savedAt: Date.now() };
  writeAll(all);
}

export function readPlayback(metaId: string, season?: number, episode?: number): PlaybackEntry | null {
  const all = readAll();
  return all[entryKey(metaId, season, episode)] ?? null;
}

export function clearPlayback(metaId: string, season?: number, episode?: number): void {
  const all = readAll();
  delete all[entryKey(metaId, season, episode)];
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
    addonId?: string | null;
    resolution?: string | null;
    source?: string | null;
    behaviorHints?: { bingeGroup?: string };
  },
  e: PlaybackEntry,
): boolean {
  const sBinge = s.behaviorHints?.bingeGroup ?? null;
  if (e.bingeGroup && sBinge) return sBinge === e.bingeGroup;
  return !!e.addonId && s.addonId === e.addonId && e.resolution === s.resolution && e.source === s.source;
}
