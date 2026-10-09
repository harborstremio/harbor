import { safeFetch } from "@/lib/safe-fetch";
import { getSecret, loadSecrets } from "@/lib/secret-store";
import { LASTFM_API_KEY } from "./lastfm";
import { resolveArtist } from "./artist-authority";
import type { MusicArtistRef } from "./types";
type Obj = Record<string, unknown>;
export type GenreArtistStats = { artist: MusicArtistRef; fans?: number; listeners?: number; plays?: number };
const object = (value: unknown): Obj => value && typeof value === "object" ? value as Obj : {};
export const realCount = (value: unknown): number | undefined => {
  if (typeof value !== "number" && !(typeof value === "string" && /^\d+$/.test(value))) return undefined;
  const count = Number(value); return Number.isSafeInteger(count) && count >= 0 ? count : undefined;
};
const cache = new Map<string, { at: number; value: Promise<GenreArtistStats> }>();
async function json(url: string): Promise<Obj> {
  const response = await safeFetch(url, { signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Artist statistics unavailable");
  const data = object(await response.json()); if (data.error) throw new Error("Artist statistics unavailable");
  return data;
}
async function artistStats(artist: MusicArtistRef, apiKey: string | null): Promise<GenreArtistStats> {
  const key = `${artist.id}:${Boolean(apiKey)}`, saved = cache.get(key);
  if (saved && Date.now() - saved.at < 30 * 60_000) return saved.value;
  const value = (async () => {
    const resolved = artist.id.startsWith("musicbrainz:artist:")
      ? await resolveArtist(artist.name).catch(() => null) : null;
    const canonical = resolved?.canonical;
    const id = /^deezer:artist:(\d+)$/.exec(canonical?.id ?? artist.id)?.[1];
    const [deezer,lastfm] = await Promise.all([
      id ? json(`https://api.deezer.com/artist/${id}`).catch(() => null) : null,
      apiKey ? json(`https://ws.audioscrobbler.com/2.0/?${new URLSearchParams({ method: "artist.getInfo", artist: artist.name, api_key: apiKey, format: "json" })}`).catch(() => null) : null,
    ]);
    const stats = object(object(lastfm?.artist).stats);
    return { artist: { ...artist, artwork: typeof deezer?.picture_big === "string" ? deezer.picture_big : canonical?.artwork || artist.artwork },
      fans: realCount(deezer?.nb_fan), listeners: realCount(stats.listeners), plays: realCount(stats.playcount) };
  })();
  cache.set(key,{ at: Date.now(), value });
  while(cache.size > 100) cache.delete(cache.keys().next().value!);
  return value;
}
export async function loadGenreArtistStats(artists: MusicArtistRef[]): Promise<GenreArtistStats[]> {
  await loadSecrets().catch(() => {});
  const key = getSecret(LASTFM_API_KEY) ?? null;
  const result: GenreArtistStats[] = [];
  // Detail-only, bounded enrichment; browsing 134 tiles performs no artist requests.
  for(let at=0; at<artists.length; at+=3) result.push(...await Promise.all(artists.slice(at,at+3).map(artist => artistStats(artist,key))));
  return result;
}
