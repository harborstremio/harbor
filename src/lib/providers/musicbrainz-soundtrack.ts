import { useEffect, useState } from "react";
import { lruSet } from "@/lib/cache";
import { safeFetch } from "@/lib/safe-fetch";
import {
  rankSoundtrackCandidates,
  readReleaseGroup,
  soundtrackCandidates,
  type FilmSoundtrack,
} from "./musicbrainz-soundtrack-pick";

export type { FilmSoundtrack } from "./musicbrainz-soundtrack-pick";

const WS = "https://musicbrainz.org/ws/2";
const AGENT = "Harbor/0.9 (https://harbor.site)";
const TIMEOUT_MS = 8000;
const MAX_BYTES = 256 * 1024;
const CACHE_MAX = 120;
const CONFIRM_LIMIT = 3;

type Fetched = { data?: unknown; missing?: boolean };

async function readJson(path: string): Promise<Fetched> {
  const abort = new AbortController();
  const timer = window.setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const res = await safeFetch(`${WS}/${path}`, {
      signal: abort.signal,
      headers: { Accept: "application/json", "User-Agent": AGENT },
    });
    if (res.status === 404) {
      await res.body?.cancel();
      return { missing: true };
    }
    const size = Number(res.headers.get("content-length"));
    const isJson = (res.headers.get("content-type") ?? "").includes("json");
    if (!res.ok || !isJson || size > MAX_BYTES) {
      await res.body?.cancel();
      return {};
    }
    return { data: (await res.json()) as unknown };
  } catch {
    return {};
  } finally {
    window.clearTimeout(timer);
  }
}

async function scheduled(path: string): Promise<Fetched> {
  try {
    const { scheduleMusicBrainzRequest } = await import("@/lib/music/recording-profile");
    return await scheduleMusicBrainzRequest(() => readJson(path));
  } catch {
    return {};
  }
}

async function resolve(imdbId: string): Promise<{ album: FilmSoundtrack | null; store: boolean }> {
  const resource = encodeURIComponent(`https://www.imdb.com/title/${imdbId}/`);
  const linked = await scheduled(`url?resource=${resource}&inc=release-group-rels&fmt=json`);
  if (linked.missing) return { album: null, store: true };
  if (!linked.data) return { album: null, store: false };
  const ordered = rankSoundtrackCandidates(soundtrackCandidates(linked.data)).slice(
    0,
    CONFIRM_LIMIT,
  );
  if (ordered.length === 0) return { album: null, store: true };
  let asSingle: FilmSoundtrack | null = null;
  let complete = true;
  for (const candidate of ordered) {
    const group = await scheduled(
      `release-group/${candidate.id}?inc=artist-credits%2Baliases&fmt=json`,
    );
    if (!group.data) {
      if (!group.missing) complete = false;
      continue;
    }
    const confirmed = readReleaseGroup(group.data, candidate.title);
    if (!confirmed) continue;
    if (!confirmed.single) return { album: confirmed.album, store: true };
    asSingle ??= confirmed.album;
  }
  if (asSingle) return { album: asSingle, store: true };
  return { album: null, store: complete };
}

const cache = new Map<string, FilmSoundtrack | null>();
const inflight = new Map<string, Promise<FilmSoundtrack | null>>();
const subs = new Set<() => void>();

const isTitleId = (value?: string): value is string => !!value && /^tt\d+$/.test(value);

export function cachedFilmSoundtrack(imdbId?: string): FilmSoundtrack | null {
  return imdbId ? (cache.get(imdbId) ?? null) : null;
}

export function fetchFilmSoundtrack(imdbId: string): Promise<FilmSoundtrack | null> {
  if (!isTitleId(imdbId)) return Promise.resolve(null);
  if (cache.has(imdbId)) return Promise.resolve(cache.get(imdbId) ?? null);
  const pending = inflight.get(imdbId);
  if (pending) return pending;
  const run = (async () => {
    try {
      const { album, store } = await resolve(imdbId);
      if (store) lruSet(cache, imdbId, album, CACHE_MAX);
      subs.forEach((fn) => fn());
      return album;
    } catch {
      return null;
    } finally {
      inflight.delete(imdbId);
    }
  })();
  inflight.set(imdbId, run);
  return run;
}

export function useFilmSoundtrack(imdbId?: string): FilmSoundtrack | null {
  const [album, setAlbum] = useState<FilmSoundtrack | null>(() => cachedFilmSoundtrack(imdbId));
  useEffect(() => {
    setAlbum(cachedFilmSoundtrack(imdbId));
    if (!isTitleId(imdbId)) return;
    void fetchFilmSoundtrack(imdbId);
    const read = () => setAlbum(cachedFilmSoundtrack(imdbId));
    subs.add(read);
    return () => {
      subs.delete(read);
    };
  }, [imdbId]);
  return album;
}
