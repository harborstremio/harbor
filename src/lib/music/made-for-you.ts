import { resolveArtist } from "./artist-authority";
import { artistIdentityKey } from "./artist-popularity";
import { filterBlockedTracks } from "./artist-blocks";
import { readArtistGenres } from "./artist-genre-cache";
import { artistRows, artistTop } from "./catalog";
import { dailyArtistKey, dailyArtistName, dailyMixHasVariety, dailyRotation, dailySeed, selectDailyTracks } from "./daily-discovery-selection";
import { genreSearchKey } from "./genre-catalog";
import { readLocalJson, writeLocalJson } from "./local-store";
import { rankMixArtists, type MixArtist, type MixTaste } from "./made-for-you-selection";
import { mixRecordings } from "./mix-quality";
import { musicTrackIdentity } from "./track-identity";
import { genreMixHasVariety, loadMadeForYouGenres } from "./made-for-you-genres";
import type { MusicArtistRef, MusicTrack } from "./types";

export type MadeForYouMix = {
  id: string; kind: "daily" | "artist" | "genre"; index: number; name: string; genreId?: number;
  artists: string[]; tracks: MusicTrack[]; artwork: string[]; seeds: MusicTrack[];
};
type Snapshot = { day: string; personalized: boolean; mixes: MadeForYouMix[]; genres?: boolean };
const pending = new Map<string, Promise<MadeForYouMix[]>>();
const store = (profile: string) => `made-for-you-v2-${dailySeed(profile)}`;
const allowed = (tracks: readonly MusicTrack[]) => mixRecordings(filterBlockedTracks(filterBlockedTracks(tracks, "show"), "play"));

function valid(mix: MadeForYouMix): MadeForYouMix | null {
  if (!mix || !Array.isArray(mix.tracks) || !["daily", "artist", "genre"].includes(mix.kind)) return null;
  const tracks = allowed(mix.tracks);
  if (mix.kind === "genre" ? !genreMixHasVariety(tracks) : mix.kind === "daily" ? !dailyMixHasVariety(tracks) : tracks.length < 5 || tracks.some(track => dailyArtistKey(track) !== artistIdentityKey(mix.name))) return null;
  return { ...mix, tracks };
}

export async function readMadeForYouMix(id: string, profile: string): Promise<MadeForYouMix | null> {
  const saved = await readLocalJson<Snapshot[]>(store(profile));
  const mix = Array.isArray(saved) ? saved.flatMap(value => value.mixes ?? []).find(value => value.id === id) : null;
  return mix ? valid(mix) : null;
}

export async function readMadeForYouShelf(day: string, profile: string, hasListening = false): Promise<MadeForYouMix[]> {
  const saved = await readLocalJson<Snapshot[]>(store(profile));
  const held = Array.isArray(saved) ? saved.find(value => value.day === day) : null;
  if (hasListening && !held?.personalized) return [];
  if (!held?.genres) return [];
  const clean = held?.mixes.flatMap(mix => valid(mix) ?? []) ?? [];
  return clean.length === held?.mixes.length ? clean : [];
}

function describe(id: string, kind: MadeForYouMix["kind"], index: number, name: string, tracks: MusicTrack[], portrait?: string): MadeForYouMix {
  const artists = [...new Map(tracks.map(track => [dailyArtistKey(track), dailyArtistName(track)])).values()];
  const artwork = portrait ? [portrait] : [...new Set(artists.flatMap(artist => tracks.find(track => dailyArtistName(track) === artist)?.artwork ?? []))].slice(0, 4);
  return { id, kind, index, name, tracks, artists: artists.slice(0, 3), artwork, seeds: tracks.slice(0, 4) };
}

/** Snapshot once per day. Likes and history seed distinct scenes; playback never reshuffles a mounted shelf. */
export async function loadMadeForYou(taste: MixTaste, day: string, profile: string, onUpdate?: (mixes: MadeForYouMix[]) => void): Promise<MadeForYouMix[]> {
  const key = `${profile}:${day}`;
  const personalized = !!(taste.recents.length || taste.liked.length || taste.followed.length);
  const existing = pending.get(key);
  if (existing) {
    const mixes = await existing;
    // Initial library hydration may finish before listening preferences arrive.
    if (personalized && !(await readMadeForYouShelf(day, profile, true)).length && mixes.length) return loadMadeForYou(taste, day, profile, onUpdate);
    return mixes;
  }
  const request = (async () => {
    const saved = await readLocalJson<Snapshot[]>(store(profile));
    const history = Array.isArray(saved) ? saved : [];
    const held = history.find(value => value.day === day);
    const ranked = rankMixArtists({ ...taste, liked: allowed(taste.liked), recents: allowed(taste.recents), library: allowed(taste.library) });
    const withGenres = async (base: MadeForYouMix[], pool: MusicTrack[]) => {
      onUpdate?.(base);
      const genres = await loadMadeForYouGenres(ranked, allowed([...pool, ...ranked.flatMap(artist => artist.seeds)]), day, profile).catch(() => []);
      const mixes = [...base.filter(mix => mix.kind !== "genre"), ...genres];
      if (mixes.length) writeLocalJson(store(profile), [...history.filter(value => value.day !== day).slice(-2), { day, personalized, mixes, genres: true }]);
      return mixes;
    };
    if (held?.mixes.length && (!personalized || held.personalized)) {
      const clean = held.mixes.flatMap(mix => valid(mix) ?? []);
      if (clean.length === held.mixes.length) return held.genres ? clean : withGenres(clean, clean.flatMap(mix => mix.tracks));
    }
    if (!ranked.length) return [];
    const tags = await readArtistGenres();
    // Three requests at a time across the entire shelf, including shared artist catalogs.
    let active = 0;
    const waiting: Array<() => void> = [];
    const limited = async <T,>(run: () => Promise<T>): Promise<T> => {
      if (active >= 3) await new Promise<void>(resolve => waiting.push(resolve));
      else active++;
      try { return await run(); } finally { const next = waiting.shift(); if (next) next(); else active--; }
    };
    const catalog = new Map<string, Promise<{ ref: MusicArtistRef | null; tracks: MusicTrack[] }>>();
    const fetchArtist = (artist: MixArtist | MusicArtistRef) => {
      const key = artistIdentityKey(artist.name);
      let result = catalog.get(key);
      if (!result) {
        result = limited(async () => {
          const seeds = "seeds" in artist ? artist.seeds : ranked.find(value => value.key === key)?.seeds ?? [];
          const hint = "ref" in artist ? artist.ref : "id" in artist ? artist : undefined;
          // MusicBrainz artist_tracks enumerates recordings, not top songs; never use it as a recommendation fallback.
          const resolved = hint && !hint.id.startsWith("musicbrainz:") ? hint : (await resolveArtist(artist.name, { track: seeds[0] }).catch(() => null))?.canonical;
          const ref = resolved && !resolved.id.startsWith("musicbrainz:") && artistIdentityKey(resolved.name) === key ? resolved : null;
          const tracks = allowed([...seeds, ...(ref ? await artistTop(ref).catch(() => []) : [])]).filter(track => dailyArtistKey(track) === key);
          return { ref, tracks };
        });
        catalog.set(key, result);
      }
      return result;
    };
    const relations = new Map<string, Set<string>>();
    const candidates: Array<{ anchor: MixArtist; tracks: MusicTrack[]; portrait?: string }> = [];
    const chosen = new Set<string>();
    // Prefer a different corner of the listener's taste before a second anchor from the same scene.
    while (candidates.length < 6 && chosen.size < Math.min(10, ranked.length)) {
      const anchor = ranked.find(value => !chosen.has(value.key) && ![...relations.values()].some(names => names.has(value.key))) ?? ranked.find(value => !chosen.has(value.key));
      if (!anchor) break;
      chosen.add(anchor.key);
      const own = await fetchArtist(anchor);
      const rows = own.ref ? await limited(() => artistRows(own.ref!).catch(() => [])) : [];
      const related = rows.flatMap(row => row.id === "artist:related" || row.title === "music.detail.relatedArtists" ? row.items.filter((item): item is MusicArtistRef & { kind: "artist" } => item.kind === "artist") : []);
      const names = new Set(related.map(ref => artistIdentityKey(ref.name)));
      const ownTags = tags.get(genreSearchKey(anchor.name)) ?? [];
      const familiar = ranked.filter(value => value.key !== anchor.key && (names.has(value.key) || ownTags.some(tag => (tags.get(genreSearchKey(value.name)) ?? []).includes(tag))));
      relations.set(anchor.key, new Set([...names, ...familiar.map(value => value.key)]));
      const neighbours = [...familiar, ...dailyRotation(related, day, `${profile}:${anchor.key}`, ref => artistIdentityKey(ref.name))];
      const seen = new Set([anchor.key]);
      const unique = neighbours.filter(value => { const key = artistIdentityKey(value.name); if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 7);
      const pages = await Promise.all(unique.map(fetchArtist));
      candidates.push({ anchor, tracks: [...own.tracks, ...pages.flatMap(page => page.tracks)], portrait: own.ref?.artwork || anchor.ref?.artwork });
      const mixes = buildMixes(candidates, day, profile);
      onUpdate?.(mixes);
    }
    const mixes = buildMixes(candidates, day, profile);
    return withGenres(mixes, candidates.flatMap(candidate => candidate.tracks));
  })();
  pending.set(key, request);
  try { return await request; } finally { pending.delete(key); }
}

function buildMixes(candidates: Array<{ anchor: MixArtist; tracks: MusicTrack[]; portrait?: string }>, day: string, profile: string): MadeForYouMix[] {
  const daily: MadeForYouMix[] = [], artists: MadeForYouMix[] = [];
  const used = new Set<string>();
  for (const { anchor, tracks, portrait } of candidates) {
    const id = `mix:personal:v2:${dailySeed(profile)}:${day}:${dailySeed(anchor.key)}`;
    const pool = allowed(tracks);
    const fresh = pool.filter(track => !used.has(musicTrackIdentity(track)));
    const selected = selectDailyTracks(fresh, day, anchor.key);
    // Don't pad a shelf with duplicate queues or relabel a single artist as a Daily Mix.
    if (selected.length && selected.some(track => dailyArtistKey(track) === anchor.key)) {
      selected.forEach(track => used.add(musicTrackIdentity(track)));
      daily.push(describe(id, "daily", daily.length + 1, anchor.name, selected));
    }
    const artistTracks = dailyRotation(pool.filter(track => dailyArtistKey(track) === anchor.key), day, profile, musicTrackIdentity).slice(0, 40);
    if (artists.length < 4 && artistTracks.length >= 5) artists.push(describe(`${id}:artist`, "artist", artists.length + 1, anchor.name, artistTracks, portrait));
  }
  // Alternate types while streaming so already visible cards keep their positions.
  return candidates.flatMap(({ anchor }) => [...daily.filter(mix => mix.name === anchor.name), ...artists.filter(mix => mix.name === anchor.name)]);
}
