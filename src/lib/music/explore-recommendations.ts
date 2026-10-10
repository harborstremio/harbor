import { safeFetch } from "@/lib/safe-fetch";
import { artistCreditParts } from "./search-artists";
import { genreSearchKey } from "./genre-catalog";
import { loadMusicDiscoveryChart, parseMusicDiscoveryChart } from "./discovery";
import { freshContinuationTracks } from "./queue-continuation";
import type { MusicTrack } from "./types";

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj => value && typeof value === "object" ? value as Obj : {};
async function json(path: string): Promise<Obj> {
  const response = await safeFetch(`https://api.deezer.com/${path}`, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Recommendations unavailable");
  const data = object(await response.json());
  if (data.error) throw new Error("Recommendations unavailable");
  return data;
}
const cache = new Map<string, { at: number; tracks: Promise<MusicTrack[]> }>();
export function artistDiscoveries(artist: string): Promise<MusicTrack[]> {
  const name = artistCreditParts(artist)[0] ?? artist, key = genreSearchKey(name);
  const saved = cache.get(key);
  if (saved && Date.now() - saved.at < 20 * 60_000) return saved.tracks;
  const tracks = (async () => {
    const search = await json(`search/artist?q=${encodeURIComponent(name)}&limit=10`);
    const matches = (Array.isArray(search.data) ? search.data : []).map(object)
      .filter(entry => typeof entry.name === "string" && genreSearchKey(entry.name) === key && Number.isSafeInteger(entry.id))
      .sort((a,b) => Number(b.nb_fan ?? 0) - Number(a.nb_fan ?? 0));
    const id = matches[0]?.id;
    if (!id) return [];
    const results = await Promise.allSettled([json(`artist/${id}/radio?limit=40`), json(`artist/${id}/top?limit=20`)]);
    const rows = results.flatMap(result => result.status === "fulfilled" && Array.isArray(result.value.data) ? result.value.data : []);
    if (results.every(result => result.status === "rejected")) throw new Error("Recommendations unavailable");
    return parseMusicDiscoveryChart(rows).tracks;
  })().catch(error => { cache.delete(key); throw error; });
  cache.set(key,{ at: Date.now(), tracks });
  while(cache.size > 20) cache.delete(cache.keys().next().value!);
  return tracks;
}
export type ExploreRecommendation = { tracks: MusicTrack[]; seed: MusicTrack | null };
/** An unresolvable upload must not leave the shelf empty: try other listening seeds. */
export async function loadExploreRecommendations(seeds: MusicTrack[], excluded: readonly MusicTrack[]): Promise<ExploreRecommendation> {
  for (const seed of seeds.slice(0,3)) {
    const tracks = freshContinuationTracks(await artistDiscoveries(seed.artist).catch(() => []), [...excluded,seed]);
    if (tracks.length >= 4) return { tracks: tracks.slice(0,12), seed };
  }
  // Clearly presented as chart discoveries when listening sources have no usable matches.
  const chart = await loadMusicDiscoveryChart();
  const fresh = freshContinuationTracks(chart.tracks, excluded);
  return { tracks: (fresh.length ? fresh : chart.tracks).slice(0,12), seed: null };
}
