import { artistIdentityKey } from "./artist-popularity";
import { resolveArtist } from "./artist-authority";
import { filterBlockedTracks } from "./artist-blocks";
import { artistTop } from "./catalog";
import { loadMusicGenreSelection } from "./discovery";
import { loadGenreArtistRoster } from "./genre-artist-roster";
import { musicGenre } from "./genre-catalog";
import { readLocalJson, writeLocalJson } from "./local-store";
import { dailyArtistKey, dailyArtistName, dailyDayKey, dailyMixHasVariety, dailyRotation, dailySeed, selectDailyTracks } from "./daily-discovery-selection";
import type { MusicTrack } from "./types";

export type DailyDiscoveryMix = {
  id: string; name: string; index: number; genreId: number; artists: string[];
  tracks: MusicTrack[]; artwork: string[]; seeds: MusicTrack[];
};

const PREFIX = "mix:discovery:v1:";
const STORE = "daily-discovery-v1";
const MAX_STORED = 24;
const DEFAULT_GENRES = [132, 116, 152, 165, 113, 98, 129, 169];
const snapshots = new Map<string, MusicTrack[]>();
const pending = new Map<string, Promise<DailyDiscoveryMix | null>>();
let hydration: Promise<void> | undefined;

export function parseDailyDiscoveryId(id: string): { day: string; genreId: number; seed: string } | null {
  const match = /^mix:discovery:v1:(\d{4}-\d{2}-\d{2}):(\d+):([a-z0-9]+)$/.exec(id);
  if (!match || !musicGenre(Number(match[2])) || !Number.isFinite(Date.parse(`${match[1]}T12:00:00Z`))) return null;
  return { day: match[1], genreId: Number(match[2]), seed: match[3] };
}

/** Deliberately accepts no history, likes, current track, affinity or imported playlists. */
export function planDailyDiscovery(tasteIds: readonly number[], day = dailyDayKey(), profile = "default") {
  const tastes = [...new Set(tasteIds.filter(id => musicGenre(id)))].sort((a, b) => a - b);
  const seed = dailySeed(`${profile}:${tastes.join(",")}`);
  return dailyRotation(tastes.length ? tastes : DEFAULT_GENRES.filter(id => musicGenre(id)), day, seed, String)
    .slice(0, 4).map((genreId, index) => ({ id: `${PREFIX}${day}:${genreId}:${seed}`, genreId, index: index + 1 }));
}

async function hydrate(): Promise<void> {
  hydration ??= readLocalJson<Record<string, MusicTrack[]>>(STORE).then(saved => {
    for (const [id, tracks] of Object.entries(saved ?? {}).slice(-MAX_STORED)) {
      if (parseDailyDiscoveryId(id) && Array.isArray(tracks) && tracks.every(track => track && typeof track.title === "string" && typeof track.artist === "string") && dailyMixHasVariety(tracks)) snapshots.set(id, tracks);
    }
  }).catch(() => {});
  await hydration;
}

function describe(id: string, genreId: number, index: number, tracks: MusicTrack[]): DailyDiscoveryMix {
  const artists = new Map<string, string>();
  const artwork: string[] = [];
  for (const track of tracks) {
    const key = dailyArtistKey(track);
    if (artists.has(key)) continue;
    artists.set(key, dailyArtistName(track));
    if (track.artwork && !artwork.includes(track.artwork) && artwork.length < 4) artwork.push(track.artwork);
  }
  return { id, genreId, index, name: musicGenre(genreId)!.name, tracks, seeds: tracks.slice(0, 4), artwork, artists: [...artists.values()].slice(0, 3) };
}

async function boundedMap<T, R>(values: readonly T[], concurrency: number, run: (value: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(values.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (next < values.length) { const index = next++; results[index] = await run(values[index]); }
  }));
  return results;
}

export async function loadDailyDiscoveryMix(id: string, index = 1): Promise<DailyDiscoveryMix | null> {
  const parts = parseDailyDiscoveryId(id);
  if (!parts) return null;
  await hydrate();
  const held = snapshots.get(id);
  if (held) {
    const allowed = filterBlockedTracks(held, "show");
    if (dailyMixHasVariety(allowed)) return describe(id, parts.genreId, index, allowed);
  }
  const existing = pending.get(id);
  if (existing) return existing.then(mix => mix ? { ...mix, index } : null);
  const request = (async () => {
    const { genreId, day, seed } = parts;
    const [selection, roster] = await Promise.all([
      loadMusicGenreSelection(genreId).catch(() => null),
      loadGenreArtistRoster(genreId).catch(() => null),
    ]);
    // Independent tags prove membership; a provider's generic chart cannot seed every genre.
    const names = new Set((roster?.artists ?? []).map(artist => artistIdentityKey(artist.name)));
    if (names.size < 5) return null;
    const candidates = (selection?.tracks ?? []).filter(track => names.has(dailyArtistKey(track)));
    const artists = dailyRotation(roster!.artists, day, seed, artist => artistIdentityKey(artist.name));
    const artistTracks = async (artist: typeof artists[number]) => {
      const canonical = (await resolveArtist(artist.name, { hint: [artist] }).catch(() => null))?.canonical;
      const tracks = await artistTop(canonical ?? artist).catch(() => []);
      return tracks.filter(track => dailyArtistKey(track) === artistIdentityKey(artist.name));
    };
    const pages = await boundedMap(artists.slice(0, 8), 3, artistTracks);
    let tracks = selectDailyTracks(filterBlockedTracks([...candidates, ...pages.flat()], "show"), day, seed);
    // A few missing catalogs should not empty a whole scene. One bounded reserve pass only.
    if (!tracks.length) {
      pages.push(...await boundedMap(artists.slice(8, 12), 3, artistTracks));
      tracks = selectDailyTracks(filterBlockedTracks([...candidates, ...pages.flat()], "show"), day, seed);
    }
    if (!tracks.length) return null;
    snapshots.delete(id);
    snapshots.set(id, tracks);
    while (snapshots.size > MAX_STORED) snapshots.delete(snapshots.keys().next().value!);
    writeLocalJson(STORE, Object.fromEntries(snapshots));
    return describe(id, genreId, index, tracks);
  })();
  pending.set(id, request);
  try { return await request; } finally { pending.delete(id); }
}

export async function loadDailyDiscoveryMixes(tasteIds: readonly number[], day: string, profile: string, onUpdate?: (mixes: DailyDiscoveryMix[]) => void): Promise<DailyDiscoveryMix[]> {
  const ready: DailyDiscoveryMix[] = [];
  const completed = new Set<number>();
  let revealed = 0;
  await boundedMap(planDailyDiscovery(tasteIds, day, profile), 2, async plan => {
    const mix = await loadDailyDiscoveryMix(plan.id, plan.index).catch(() => null);
    if (mix) ready.push(mix);
    completed.add(plan.index);
    while (completed.has(revealed + 1)) revealed++;
    ready.sort((a, b) => a.index - b.index);
    // Reveal in shelf order so a slower first catalog cannot shove visible cards sideways.
    onUpdate?.(ready.filter(value => value.index <= revealed));
  });
  return ready;
}
