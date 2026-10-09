import { safeFetch } from "@/lib/safe-fetch";
import { MUSICBRAINZ_HEADERS, scheduleMusicBrainzRequest } from "./recording-profile";
import { resolveRoster } from "./mb-roster";
import type { RankedMusicSearchResults } from "./sources";
import { artistIdentityKey } from "./artist-authority";

const SEEDS = 8;
const TAG_LIMIT = 25;
const CACHE_MS = 30 * 60_000;

type Cached = { until: number; value: string[] };
const tagCache = new Map<string, Cached>();

function endpoint(tag: string): string {
  const query = encodeURIComponent(`tag:"${tag.replace(/"/g, "")}" AND NOT type:other`);
  return `https://musicbrainz.org/ws/2/artist?query=${query}&limit=${TAG_LIMIT}&fmt=json`;
}

export async function genreArtistNames(tag: string, signal?: AbortSignal): Promise<string[]> {
  const key = tag.trim().toLowerCase();
  if (!key) return [];
  const saved = tagCache.get(key);
  if (saved && saved.until > Date.now()) return saved.value;
  const names = await scheduleMusicBrainzRequest(async () => {
    const response = await safeFetch(endpoint(key), {
      signal,
      headers: MUSICBRAINZ_HEADERS,
    });
    if (!response.ok) throw new Error("Genre lookup is unavailable");
    const body = (await response.json()) as { artists?: Array<{ name?: unknown }> };
    const seen = new Set<string>();
    const out: string[] = [];
    for (const artist of body.artists ?? []) {
      const name = typeof artist.name === "string" ? artist.name.trim() : "";
      if (!name) continue;
      const id = artistIdentityKey(name);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(name);
    }
    return out;
  }, signal);
  tagCache.set(key, { until: Date.now() + CACHE_MS, value: names });
  while (tagCache.size > 40) tagCache.delete(tagCache.keys().next().value!);
  return names;
}

export async function loadMusicGenre(
  tag: string,
  signal?: AbortSignal,
): Promise<RankedMusicSearchResults> {
  const names = await genreArtistNames(tag, signal);
  return resolveRoster(names.slice(0, SEEDS));
}
