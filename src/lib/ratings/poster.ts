import { useEffect, useState } from "react";
import { tmdbImdbCached } from "@/lib/providers/tmdb/tmdb-imdb-resolve";

const IMDB_IN_KEY = /(tt\d{7,})/;
const KITSU_KEY = /^kitsu:(\d+)/i;
const MAL_KEY = /^mal:(\d+)/i;
const ANILIST_KEY = /^anilist:(\d+)/i;
const ANIDB_KEY = /^anidb:(\d+)/i;

const STORE_KEY = "harbor.ratingposters.v1";
const MAX_CACHED = 4000;

let disk: Record<string, string> | null = null;
const memo = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

function readDisk(): Record<string, string> {
  if (disk) return disk;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    disk = raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    disk = {};
  }
  return disk;
}

function writeDisk(key: string, url: string): void {
  const d = readDisk();
  if (d[key] === url) return;
  d[key] = url;
  const keys = Object.keys(d);
  if (keys.length > MAX_CACHED) {
    for (const k of keys.slice(0, keys.length - MAX_CACHED)) delete d[k];
  }
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(d));
  } catch {
    return;
  }
}

function metahub(tconst: string): string {
  return `https://images.metahub.space/poster/medium/${tconst}/img`;
}

export function ratingPosterSrc(itemKey: string, poster?: string): string | undefined {
  if (poster) return poster;
  if (!itemKey) return undefined;
  const direct = IMDB_IN_KEY.exec(itemKey);
  if (direct) return metahub(direct[1]);
  const mapped = tmdbImdbCached(itemKey);
  if (mapped) {
    const m = IMDB_IN_KEY.exec(mapped);
    if (m) return metahub(m[1]);
  }
  const cached = memo.get(itemKey) ?? readDisk()[itemKey];
  return cached ?? undefined;
}

async function kitsuPoster(kitsuId: number): Promise<string | null> {
  const { kitsuAnime } = await import("@/lib/providers/kitsu");
  const a = await kitsuAnime(kitsuId).catch(() => null);
  return a?.poster ?? null;
}

async function resolveAnime(itemKey: string): Promise<string | null> {
  const kitsu = KITSU_KEY.exec(itemKey);
  if (kitsu) return kitsuPoster(Number(kitsu[1]));

  const { externalToKitsu } = await import("@/lib/providers/anime-mapping");
  const mal = MAL_KEY.exec(itemKey);
  const anilist = ANILIST_KEY.exec(itemKey);
  const anidb = ANIDB_KEY.exec(itemKey);
  const pair: [string, string] | null = mal
    ? ["myanimelist", mal[1]]
    : anilist
      ? ["anilist", anilist[1]]
      : anidb
        ? ["anidb", anidb[1]]
        : null;
  if (!pair) return null;
  const id = await externalToKitsu(pair[0], Number(pair[1])).catch(() => null);
  return id ? kitsuPoster(id) : null;
}

async function resolveManga(title: string): Promise<string | null> {
  if (!title.trim()) return null;
  const { searchManga } = await import("@/lib/manga/api");
  const list = await searchManga(title, 0).catch(() => null);
  return list?.[0]?.cover ?? null;
}

async function resolveSlow(itemKey: string, mediaType: string, title: string): Promise<string | null> {
  if (mediaType === "manga") return resolveManga(title);
  return resolveAnime(itemKey);
}

export function useRatingPoster(
  itemKey: string,
  mediaType: string,
  title: string,
  poster?: string,
): string | undefined {
  const fast = ratingPosterSrc(itemKey, poster);
  const [slow, setSlow] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (fast || !itemKey) return;
    let alive = true;
    const hit = memo.get(itemKey);
    if (hit !== undefined) {
      if (hit) setSlow(hit);
      return;
    }
    let job = inflight.get(itemKey);
    if (!job) {
      job = resolveSlow(itemKey, mediaType, title)
        .catch(() => null)
        .then((url) => {
          memo.set(itemKey, url);
          inflight.delete(itemKey);
          if (url) writeDisk(itemKey, url);
          return url;
        });
      inflight.set(itemKey, job);
    }
    void job.then((url) => {
      if (alive && url) setSlow(url);
    });
    return () => {
      alive = false;
    };
  }, [itemKey, mediaType, title, fast]);

  return fast ?? slow;
}
