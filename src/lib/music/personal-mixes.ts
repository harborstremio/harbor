import { backingTrackVersion } from "./source-version";
import { resolveArtist } from "./artist-authority";
import { loadArtistProfile } from "./artist-profile";
import { artistTop } from "./catalog";
import { loadMusicGenreSelection, type MusicGenreSelection } from "./discovery";
import { genreArtistNames } from "./genre-page";
import { genreMatchesTags } from "./genre-membership";
import { MUSIC_GENRES, genreSearchKey, musicGenre } from "./genre-catalog";
import { filterBlockedTracks } from "./artist-blocks";
import { artistCreditParts } from "./search-artists";
import { mixArtistKey, type DailyMix } from "./daily-mixes";
import { musicTrackIdentity } from "./track-identity";
import type { MusicTrack } from "./types";

export type PersonalMix = DailyMix & { kind: "artist" | "genre"; name: string; tracks: MusicTrack[] };

export function exclusiveArtistTracks(name: string, tracks: readonly MusicTrack[]): MusicTrack[] {
  const key = genreSearchKey(name);
  return uniqueMixTracks(tracks.filter(track => genreSearchKey(mixArtistKey(track)) === key));
}

export function uniqueMixTracks(tracks: readonly MusicTrack[]): MusicTrack[] {
  const seen = new Set<string>();
  return filterBlockedTracks([...tracks], "show").filter(track => {
    const key = musicTrackIdentity(track);
    if (backingTrackVersion(track) || track.mediaKind === "video" || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 50);
}

const artistGenres: Record<string, string[]> = {};
export function cachedMixArtistGenres() { return artistGenres; }
const rosters = new Map<number, { until: number; pending: Promise<string[]> }>();
async function genreRoster(id: number): Promise<string[]> {
  const genre = musicGenre(id);
  if (!genre) return [];
  const cached = rosters.get(id);
  if (cached && cached.until > Date.now()) return cached.pending;
  const pending = genreArtistNames(genre.name).then(async names => names.length || !genre.aliases[0]
    ? names : genreArtistNames(genre.aliases[0]));
  rosters.set(id, { until: Date.now() + 30 * 60_000, pending });
  void pending.catch(() => { if (rosters.get(id)?.pending === pending) rosters.delete(id); });
  return pending;
}

/** A genre-labelled chart is only a candidate pool; require independent artist genre evidence. */
export async function filterGenreMixTracks(id: number, tracks: readonly MusicTrack[]): Promise<MusicTrack[]> {
  const genre = musicGenre(id);
  if (!genre) return [];
  const names = new Set((await genreRoster(id).catch(() => [])).map(genreSearchKey));
  return uniqueMixTracks(tracks.filter(track => {
    const artist = mixArtistKey(track);
    return names.has(genreSearchKey(artist)) || genreMatchesTags(genre, artistGenres[artist] ?? []);
  }));
}

async function genreMixTracks(id: number, selection: MusicGenreSelection, seeds: readonly MusicTrack[] = []): Promise<MusicTrack[]> {
  const tracks = await filterGenreMixTracks(id, [...seeds, ...selection.tracks]);
  if (tracks.length >= 12) return tracks;
  const names = [...new Set([...tracks.map(track => artistCreditParts(track.artist)[0] ?? track.artist),
    ...await genreRoster(id).catch(() => [])])].slice(0, 3);
  const pages = await Promise.all(names.map(async name => {
    const ref = (await resolveArtist(name).catch(() => null))?.canonical;
    return ref ? exclusiveArtistTracks(name, await artistTop(ref).catch(() => [])) : [];
  }));
  return filterGenreMixTracks(id, [...tracks, ...pages.flat()]);
}
const portraits = new Map<string, Promise<string>>();
export function mixArtistPortrait(name: string): Promise<string> {
  const key = genreSearchKey(name);
  let pending = portraits.get(key);
  if (!pending) {
    pending = resolveArtist(name).then(result => result.canonical?.artwork ?? "").catch(() => "");
    portraits.set(key, pending);
    if (portraits.size > 100) portraits.delete(portraits.keys().next().value!);
  }
  return pending;
}

/** Genre queues come only from that genre's catalog selection, never general artist radio. */
export async function loadPersonalMixes(seeds: readonly MusicTrack[], tasteIds: readonly number[], onUpdate?: (mixes: PersonalMix[]) => void): Promise<PersonalMix[]> {
  const names = new Map<string, string>();
  for (const track of filterBlockedTracks([...seeds], "show")) {
    const key = mixArtistKey(track);
    if (key && !names.has(key)) names.set(key, (artistCreditParts(track.artist)[0] ?? track.artist).trim());
    if (names.size === 4) break;
  }
  const genres = new Set(tasteIds.filter(id => musicGenre(id)).slice(0, 4));
  const artists: PersonalMix[] = [];
  // Bound lookups: four artist catalogs and four genre selections at most.
  await Promise.all([...names].map(async ([key, name]) => {
    const identity = await resolveArtist(name).catch(() => null);
    const ref = identity?.canonical;
    if (!ref) return;
    const catalog = await artistTop(ref).catch(() => []);
    const tracks = exclusiveArtistTracks(ref.name, [...seeds, ...catalog]);
    if (tracks.length >= 2) artists.push({ id: `mix:artist:${key}`, kind: "artist", name: ref.name, index: artists.length + 1, artists: [ref.name], seeds: tracks.slice(0, 4), artwork: ref.artwork ? [ref.artwork] : [], tracks });
    onUpdate?.([...artists]);
    {
      const profile = await loadArtistProfile(ref, "en", undefined, false).catch(() => null);
      artistGenres[key] = (profile?.genres ?? []).map(genreSearchKey);
      onUpdate?.([...artists]);
      for (const tag of profile?.genres ?? []) {
        if (genres.size >= 4) break;
        const genre = MUSIC_GENRES.find(value => [value.name, ...value.aliases].some(term => genreSearchKey(term) === genreSearchKey(tag)));
        if (genre) genres.add(genre.id);
        if (genres.size >= 4) break;
      }
    }
  }));
  const genreMixes: PersonalMix[] = [];
  for (const id of [...genres].slice(0, 4)) {
    const genre = musicGenre(id)!;
    const selection = await loadMusicGenreSelection(id).catch(() => null);
    if (!selection) continue;
    const tracks = await genreMixTracks(id, selection, seeds);
    if (tracks.length < 2) continue;
    const lead = selection.artists.find(artist => tracks.some(track => genreSearchKey(mixArtistKey(track)) === genreSearchKey(artist.name)));
    const portrait = lead?.artwork || await mixArtistPortrait(mixArtistKey(tracks[0]));
    genreMixes.push({ id: `mix:genre:${id}`, kind: "genre", name: genre.name, index: artists.length + genreMixes.length + 1, artists: [...new Set(tracks.slice(0, 8).map(track => track.artist))].slice(0, 3), seeds: tracks.slice(0, 4), artwork: portrait ? [portrait] : [], tracks });
    onUpdate?.([...artists, ...genreMixes]);
  }
  return [...artists, ...genreMixes];
}
/** Rebuild a named mix without falling through to unrelated similar-song recommendations. */
export async function reloadPersonalMix(id: string, seed: MusicTrack): Promise<MusicTrack[]> {
  if (id.startsWith("mix:genre:")) {
    const genreId = Number(id.slice("mix:genre:".length));
    const selection = await loadMusicGenreSelection(genreId);
    return genreMixTracks(genreId, selection);
  }
  const identity = await resolveArtist(seed.artist, { track: seed });
  if (!identity.canonical) return [];
  return exclusiveArtistTracks(identity.canonical.name, await artistTop(identity.canonical));
}
