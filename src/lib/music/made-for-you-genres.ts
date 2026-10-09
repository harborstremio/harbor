import { artistIdentityKey, resolveArtist } from "./artist-authority";
import { loadArtistProfile } from "./artist-profile";
import { readArtistGenres } from "./artist-genre-cache";
import { dailyArtistKey, dailyArtistName, dailySeed, dailyRotation } from "./daily-discovery-selection";
import { mixRecordings } from "./mix-quality";
import { musicTrackIdentity } from "./track-identity";
import { MUSIC_GENRES, genreSearchKey } from "./genre-catalog";
import { primaryGenre } from "./genre-membership";
import type { MixArtist } from "./made-for-you-selection";
import type { MadeForYouMix } from "./made-for-you";
import type { MusicTrack } from "./types";

const scenes = new Set(["hip-hop", "electronic", "dance", "pop", "rock", "rnb", "metal", "jazz", "country", "reggae", "reggaeton", "classical", "afrobeats", "k-pop", "j-pop"]);

export function genreMixHasVariety(tracks: readonly MusicTrack[]) {
  const counts = new Map<string, number>();
  for (const track of tracks) counts.set(dailyArtistKey(track), (counts.get(dailyArtistKey(track)) ?? 0) + 1);
  return tracks.length >= 8 && tracks.length <= 30 && counts.size >= 2 && [...counts.values()].every(count => count <= 5);
}

function selectGenreTracks(pool: readonly MusicTrack[], day: string, seed: string) {
  const artists = new Map<string, MusicTrack[]>();
  for (const track of mixRecordings(pool)) {
    const key = dailyArtistKey(track), lane = artists.get(key) ?? [];
    lane.push(track); artists.set(key, lane);
  }
  const lanes = dailyRotation([...artists], day, seed, ([key]) => key)
    .map(([key, tracks]) => dailyRotation(tracks, day, `${seed}:${key}`, musicTrackIdentity).slice(0, 5));
  const tracks = Array.from({ length: 5 }, (_, index) => lanes.flatMap(lane => lane[index] ?? [])).flat().slice(0, 30);
  return genreMixHasVariety(tracks) ? tracks : [];
}

/** Artist genre evidence is required; a related-artist queue alone does not establish a genre. */
export function planMadeForYouGenres(ranked: readonly MixArtist[], pool: readonly MusicTrack[], tags: ReadonlyMap<string, readonly string[]>, day: string, profile: string): MadeForYouMix[] {
  const scene = MUSIC_GENRES.filter(genre => scenes.has(genre.slug));
  // One home per artist. Without this a pop mix fills with whoever is merely tagged pop.
  const homeOf = (name: string) => primaryGenre(scene, tags.get(genreSearchKey(name)) ?? []);
  const genres = scene.map(genre => ({ genre,
    score: ranked.reduce((score, artist) => score + (homeOf(artist.name)?.id === genre.id ? artist.score : 0), 0),
  })).filter(row => row.score > 0).sort((a, b) => b.score - a.score || a.genre.id - b.genre.id);
  const mixes: MadeForYouMix[] = [];
  const queues = new Set<string>();
  for (const { genre } of genres) {
    const eligible = pool.filter(track => homeOf(dailyArtistName(track))?.id === genre.id);
    const tracks = selectGenreTracks(eligible, day, `${profile}:genre:${genre.id}`);
    if (!tracks.length) continue;
    const artists = [...new Map(tracks.map(track => [dailyArtistKey(track), dailyArtistName(track)])).values()];
    // Overlapping genre tags must not turn the same catalog into two different cards.
    const signature = mixRecordings(eligible).map(musicTrackIdentity).sort().join("\n");
    if (queues.has(signature)) continue;
    queues.add(signature);
    const artwork = [...new Set(artists.flatMap(artist => tracks.find(track => dailyArtistName(track) === artist)?.artwork ?? []))].slice(0, 4);
    mixes.push({ id: `mix:personal:v2:${dailySeed(profile)}:${day}:genre:${genre.id}`, kind: "genre", genreId: genre.id,
      index: mixes.length + 1, name: genre.name, artists: artists.slice(0, 3), tracks, seeds: tracks.slice(0, 4), artwork });
    if (mixes.length === 4) break;
  }
  return mixes;
}

export async function loadMadeForYouGenres(ranked: readonly MixArtist[], pool: readonly MusicTrack[], day: string, profile: string) {
  const tags = new Map(await readArtistGenres());
  // Fill only missing metadata for the listener's leading artists; no catalog-wide scan.
  const missing = ranked.slice(0, 8).filter(artist => !tags.get(genreSearchKey(artist.name))?.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(2, missing.length) }, async () => {
    while (next < missing.length) {
      const artist = missing[next++];
      const ref = artist.ref ?? (await resolveArtist(artist.name).catch(() => null))?.canonical;
      if (!ref || artistIdentityKey(ref.name) !== artist.key) continue;
      const data = await loadArtistProfile(ref, "en", undefined, false).catch(() => null);
      if (data?.genres.length) tags.set(genreSearchKey(artist.name), data.genres);
    }
  }));
  return planMadeForYouGenres(ranked, pool, tags, day, profile);
}
