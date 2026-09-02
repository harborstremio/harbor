import { useEffect, useMemo, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { episodeSpanContains, parseEpisodeSpan } from "@/lib/episode-span";
import { loadLocalLibraryStore, saveLocalLibraryStore } from "@/lib/local-library/storage";

const KEY = "harbor.library.local.v1";
const subs = new Set<() => void>();

export type LocalEntry = {
  id: string;
  path: string;
  filename: string;
  title: string;
  year: number | null;
  type: "movie" | "show";
  resolution?: string | null;
  /** Bytes on disk; absent for libraries scanned before versions were tracked. */
  size?: number | null;
  rating?: number | null;
  runtime?: number | null;
  /** Absent for entries scanned before genres were captured; never backfilled. */
  genres?: string[] | null;
  poster?: string | null;
  tmdbId?: number | null;
  imdbId?: string | null;
  season?: number | null;
  episode?: number | null;
  episodeEnd?: number | null;
  addedAt: number;
  needsReview?: boolean;
  isAnime?: boolean;
  source?: "tmdb" | "nfo";
  folder?: string;
  localArt?: { poster?: string; logo?: string; backdrop?: string };
  /** External subtitle sidecars found beside this exact video file. */
  subtitlePaths?: string[];
};

// Parsing the whole library out of localStorage on every read is O(n) per call,
// and read() is hit once per subscriber per mutation. Cache the parsed array and
// bump a generation counter so derived caches can invalidate against it.
let cache: LocalEntry[] | null = null;
let generation = 0;
let hydrated = false;
let hydration: Promise<void> | null = null;
let dirtyBeforeHydration = false;
let persistQueue = Promise.resolve();

function normalizeEntries(entries: LocalEntry[]): LocalEntry[] {
  return entries.map((entry) => {
    const parsed = parseFilename(entry.filename);
    if (parsed.type !== "show" || parsed.season == null || parsed.episode == null) return entry;
    if (
      entry.type === "show" &&
      entry.season === parsed.season &&
      entry.episode === parsed.episode &&
      entry.episodeEnd === parsed.episodeEnd
    )
      return entry;
    return {
      ...entry,
      type: "show",
      season: parsed.season,
      episode: parsed.episode,
      episodeEnd: parsed.episodeEnd,
    };
  });
}

function readLegacy(): LocalEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? normalizeEntries(parsed as LocalEntry[]) : [];
  } catch {
    return [];
  }
}

function notify(): void {
  for (const subscriber of subs) subscriber();
}

function persist(entries: LocalEntry[]): void {
  const snapshot = entries;
  persistQueue = persistQueue.then(async () => {
    if (await saveLocalLibraryStore(snapshot)) {
      try {
        localStorage.removeItem(KEY);
      } catch {
        /* IndexedDB remains the durable copy. */
      }
      return;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(snapshot));
    } catch (error) {
      console.error("[local-library] could not persist library", error);
    }
  });
}

function ensureHydrated(): void {
  if (hydration) return;
  const legacy = readLegacy();
  if (legacy.length > 0) cache = legacy;
  hydration = (async () => {
    const stored = await loadLocalLibraryStore<LocalEntry>();
    hydrated = true;
    if (dirtyBeforeHydration) {
      persist(cache ?? []);
      notify();
      return;
    }
    if (stored != null && stored.length > 0) {
      cache = normalizeEntries(stored);
      generation += 1;
      notify();
      return;
    }
    cache ??= legacy;
    if (legacy.length > 0) persist(legacy);
    notify();
  })();
}

function read(): LocalEntry[] {
  ensureHydrated();
  return cache ?? [];
}

function write(entries: LocalEntry[]): void {
  cache = entries;
  generation += 1;
  if (!hydrated) dirtyBeforeHydration = true;
  persist(entries);
  notify();
}

/** Bumped on every mutation; derived caches key off this. */
export function localLibraryGeneration(): number {
  return generation;
}

export function readLocalLibrary(): LocalEntry[] {
  return read();
}

/** Wait for the IndexedDB-backed library to be available before bulk reads such as backup export. */
export async function localLibraryReady(): Promise<void> {
  ensureHydrated();
  await hydration;
}

/** Restore a serialized legacy backup without routing the large payload through localStorage. */
export function restoreLocalLibrary(serialized: string): boolean {
  try {
    const value = JSON.parse(serialized);
    if (!Array.isArray(value)) return false;
    write(normalizeEntries(value as LocalEntry[]));
    return true;
  } catch {
    return false;
  }
}

export function localShowEpisodes(show: {
  imdbId?: string | null;
  title?: string | null;
}): LocalEntry[] {
  const wantImdb = show.imdbId ?? null;
  const wantTitle = (show.title ?? "").trim().toLowerCase();
  return read()
    .filter((e) => {
      if (e.type !== "show" || e.season == null || e.episode == null) return false;
      if (wantImdb) return e.imdbId === wantImdb;
      return !!wantTitle && e.title.trim().toLowerCase() === wantTitle;
    })
    .sort((a, b) => (a.season ?? 0) - (b.season ?? 0) || (a.episode ?? 0) - (b.episode ?? 0));
}

export function findLocalEpisode(
  show: { imdbId?: string | null; title?: string | null },
  season: number,
  episode: number,
): LocalEntry | null {
  return (
    localShowEpisodes(show).find((e) =>
      episodeSpanContains(
        { ...e, episodeEnd: e.episodeEnd ?? parseEpisodeSpan(e.filename)?.episodeEnd },
        season,
        episode,
      ),
    ) ?? null
  );
}

export function addLocalEntries(entries: LocalEntry[]): void {
  if (entries.length === 0) return;
  const existing = read();
  const byPath = new Map(existing.map((e) => [e.path, e]));
  for (const e of entries) byPath.set(e.path, e);
  write(Array.from(byPath.values()).sort((a, b) => b.addedAt - a.addedAt));
}

export function removeLocalEntry(id: string): void {
  write(read().filter((e) => e.id !== id));
}

export function removeLocalFolder(folder: string): void {
  write(read().filter((e) => e.folder !== folder));
}

export function updateLocalEntry(id: string, patch: Partial<LocalEntry>): void {
  updateLocalEntries([id], patch);
}

export function updateLocalEntries(ids: string[], patch: Partial<LocalEntry>): void {
  if (ids.length === 0) return;
  const idSet = new Set(ids);
  let changed = false;
  const next = read().map((e) => {
    if (!idSet.has(e.id)) return e;
    changed = true;
    return { ...e, ...patch };
  });
  if (changed) write(next);
}

export function clearLocalLibrary(): void {
  write([]);
}

export function findLocalMovie(tmdbId?: number | null, imdbId?: string | null): LocalEntry | null {
  return (
    read().find(
      (e) =>
        e.type === "movie" &&
        ((tmdbId != null && e.tmdbId === tmdbId) || (imdbId != null && e.imdbId === imdbId)),
    ) ?? null
  );
}

export function findLocalEpisodeByIds(
  season: number,
  episode: number,
  tmdbId?: number | null,
  imdbId?: string | null,
): LocalEntry | null {
  return (
    read().find(
      (e) =>
        e.type === "show" &&
        episodeSpanContains(
          { ...e, episodeEnd: e.episodeEnd ?? parseEpisodeSpan(e.filename)?.episodeEnd },
          season,
          episode,
        ) &&
        ((tmdbId != null && e.tmdbId === tmdbId) || (imdbId != null && e.imdbId === imdbId)),
    ) ?? null
  );
}

export function findLocalSeriesEpisodes(
  tmdbId?: number | null,
  imdbId?: string | null,
): LocalEntry[] {
  if (tmdbId == null && imdbId == null) return [];
  return read()
    .filter(
      (e) =>
        e.type === "show" &&
        ((tmdbId != null && e.tmdbId === tmdbId) || (imdbId != null && e.imdbId === imdbId)),
    )
    .sort((a, b) => (a.season ?? 0) - (b.season ?? 0) || (a.episode ?? 0) - (b.episode ?? 0));
}

export function localEntryToMeta(entry: LocalEntry): Meta | null {
  const kind = entry.type === "show" ? "tv" : "movie";
  const id = entry.tmdbId != null ? `tmdb:${kind}:${entry.tmdbId}` : (entry.imdbId ?? null);
  if (!id) return null;
  return {
    id,
    type: entry.type === "show" ? "series" : "movie",
    name: entry.title,
    poster: entry.poster ?? undefined,
  };
}

export function useLocalLibrary(): LocalEntry[] {
  const [items, setItems] = useState<LocalEntry[]>(() => read());
  useEffect(() => {
    const tick = () => setItems(read());
    subs.add(tick);
    return () => {
      subs.delete(tick);
    };
  }, []);
  return items;
}

export function useLocalLibraryReady(): boolean {
  const [ready, setReady] = useState(hydrated);
  useEffect(() => {
    ensureHydrated();
    if (hydrated) setReady(true);
    const tick = () => setReady(hydrated);
    subs.add(tick);
    return () => {
      subs.delete(tick);
    };
  }, []);
  return ready;
}

let idSetCache: { gen: number; set: Set<string> } | null = null;

function localLibraryIdSet(): Set<string> {
  if (idSetCache && idSetCache.gen === generation) return idSetCache.set;
  const out = new Set<string>();
  for (const e of read()) {
    if (e.tmdbId != null) {
      const kind = e.type === "show" ? "tv" : "movie";
      out.add(`tmdb:${kind}:${e.tmdbId}`);
    }
    if (e.imdbId) out.add(e.imdbId);
  }
  idSetCache = { gen: generation, set: out };
  return out;
}

export function useInLocalLibrary(
  id: string | undefined,
  altIds?: Array<string | null | undefined>,
): boolean {
  const candidates = useMemo(() => {
    const arr: string[] = [];
    if (id) arr.push(id);
    if (altIds) for (const a of altIds) if (a) arr.push(a);
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, altIds?.join("|")]);

  const check = () => {
    if (candidates.length === 0) return false;
    const set = localLibraryIdSet();
    return candidates.some((c) => set.has(c));
  };

  const [has, setHas] = useState<boolean>(check);
  useEffect(() => {
    setHas(check());
    const tick = () => setHas(check());
    subs.add(tick);
    return () => {
      subs.delete(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates.join("|")]);
  return has;
}

const VIDEO_EXTS = new Set([
  "mkv",
  "mp4",
  "m4v",
  "mov",
  "avi",
  "wmv",
  "webm",
  "ts",
  "m2ts",
  "mpg",
  "mpeg",
  "flv",
  "ogv",
]);

export function isVideoFile(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return VIDEO_EXTS.has(ext);
}

const NOISE = [
  "1080p",
  "720p",
  "2160p",
  "4k",
  "uhd",
  "hdr",
  "hdr10",
  "dv",
  "bluray",
  "bdrip",
  "brrip",
  "webrip",
  "web-dl",
  "webdl",
  "hdtv",
  "dvdrip",
  "remux",
  "x264",
  "x265",
  "h264",
  "h265",
  "hevc",
  "av1",
  "10bit",
  "atmos",
  "ddp",
  "dts",
  "ac3",
  "aac",
  "yify",
  "yts",
  "rarbg",
  "fgt",
  "evo",
  "psa",
];
const NOISE_RX = new RegExp(`\\b(${NOISE.join("|")})\\b`, "gi");
const TV_RX =
  /\bs(\d{1,2})[\s._-]*e(\d{1,3})(?!\d)|\b(\d{1,2})x(\d{1,3})(?!\d)|\bseason[\s._-]*(\d{1,2})[\s._-]*(?:episode|ep)[\s._-]*(\d{1,3})(?!\d)/i;
const YEAR_RX = /\b(19\d{2}|20\d{2})\b/;
const EXTRAS_RX = /(?:^|[\s._-])s(\d{1,2})[\s._-]*(?:extras?|bonus)(?:[\s._-]|$)/i;

export type ParsedFilename = {
  title: string;
  year: number | null;
  type: "movie" | "show";
  season: number | null;
  episode: number | null;
  episodeEnd: number | null;
  resolution: string | null;
};

export function parseFilename(filename: string): ParsedFilename {
  const stem = filename.replace(/\.(mkv|mp4|m4v|mov|avi|wmv|webm|ts|m2ts|mpg|mpeg|flv|ogv)$/i, "");
  const span = parseEpisodeSpan(stem);
  const tv = stem.match(TV_RX);
  const extras = !span && !tv ? stem.match(EXTRAS_RX) : null;
  const season = extras ? 0 : (span?.season ?? (tv ? parseInt(tv[1] ?? tv[3] ?? tv[5], 10) : null));
  const episode = extras
    ? parseInt(extras[1], 10)
    : (span?.episode ?? (tv ? parseInt(tv[2] ?? tv[4] ?? tv[6], 10) : null));
  const yearMatch = stem.match(YEAR_RX);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
  const resMatch = stem.match(/\b(2160p|1080p|720p|480p|4k|uhd)\b/i);
  const resolution = resMatch ? resMatch[1].toLowerCase() : null;
  let title = stem;
  if (tv) title = title.slice(0, tv.index);
  if (extras?.index != null) title = title.slice(0, extras.index);
  if (yearMatch && yearMatch.index != null && yearMatch.index < title.length) {
    title = title.slice(0, yearMatch.index);
  }
  title = title
    .replace(/[._]+/g, " ")
    .replace(NOISE_RX, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(?:\[|\(|\{).*?(?:\]|\)|\})/g, "")
    .replace(/(?:\[|\]|\(|\)|\{|\})/g, " ")
    .replace(/[\s\-–—_]+$/g, "")
    .replace(/^[\s\-–—_]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!title) title = stem;
  return {
    title,
    year,
    type: span || tv || extras ? "show" : "movie",
    season,
    episode,
    episodeEnd: span?.episodeEnd ?? episode,
    resolution,
  };
}
