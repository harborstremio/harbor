import { backingTrackVersion } from "./source-version";
import { artistCreditParts } from "./search-artists";
import { musicTrackIdentity } from "./track-identity";
import type { ListeningAffinity } from "./listening-affinity";
import type { MusicPlaylist, MusicTrack } from "./types";

export type DailyMix = {
  id: string;
  index: number;
  artists: string[];
  seeds: MusicTrack[];
  artwork: string[];
};

const MAX_MIXES = 6;
const ARTISTS_PER_MIX = 3;
const NEIGHBOUR_WINDOW = 5;
const MIX_SIZE = 50;

export function mixArtistKey(track: MusicTrack): string {
  return (artistCreditParts(track.artist)[0] ?? track.artist).trim().toLocaleLowerCase();
}

function artistLabel(track: MusicTrack): string {
  return (artistCreditParts(track.artist)[0] ?? track.artist).trim();
}

function trackScore(
  track: MusicTrack,
  index: number,
  liked: Set<string>,
  affinity: ListeningAffinity,
  now: number,
): number {
  const key = musicTrackIdentity(track);
  const repeat = affinity[key];
  const age = repeat ? Math.max(0, (now - repeat.at) / 86_400_000) : 0;
  const plays = repeat ? (Math.log2(1 + repeat.plays) * 4) / (1 + age / 30) : 0;
  return plays + (liked.has(key) ? 2 : 0) + 1 / (1 + index / 8);
}

const PLAYLIST_TIE = 4;

export function planDailyMixes(
  recents: readonly MusicTrack[],
  liked: readonly MusicTrack[],
  affinity: ListeningAffinity,
  now = Date.now(),
  sources: { extra?: readonly MusicTrack[]; playlists?: readonly MusicPlaylist[]; artistGenres?: Record<string, string[]> } = {},
): DailyMix[] {
  const likedKeys = new Set(liked.map(musicTrackIdentity));
  const pool = [...recents, ...liked, ...(sources.extra ?? [])].filter(
    (track) => !backingTrackVersion(track) && track.mediaKind !== "video" && track.artist.trim() && track.title.trim(),
  );

  const artists = new Map<string, { label: string; score: number; tracks: MusicTrack[] }>();
  const seenTrack = new Set<string>();
  pool.forEach((track, index) => {
    const identity = musicTrackIdentity(track);
    if (seenTrack.has(identity)) return;
    seenTrack.add(identity);
    const key = mixArtistKey(track);
    if (!key) return;
    const score = trackScore(track, index, likedKeys, affinity, now);
    const found = artists.get(key);
    if (found) {
      found.score += score;
      found.tracks.push(track);
    } else {
      artists.set(key, { label: artistLabel(track), score, tracks: [track] });
    }
  });

  const compatible = (left: string, right: string) => {
    const tags = sources.artistGenres?.[left] ?? [];
    const other = sources.artistGenres?.[right] ?? [];
    return tags.some(tag => other.includes(tag));
  };
  const near = new Map<string, Map<string, number>>();
  const tie = (left: string, right: string, weight: number) => {
    if (!left || !right || left === right || !compatible(left, right)) return;
    for (const [from, to] of [
      [left, right],
      [right, left],
    ]) {
      const row = near.get(from) ?? new Map<string, number>();
      row.set(to, (row.get(to) ?? 0) + weight);
      near.set(from, row);
    }
  };

  for (const playlist of sources.playlists ?? []) {
    const names = [...new Set(playlist.tracks.map(mixArtistKey).filter(Boolean))];
    for (let a = 0; a < names.length; a += 1) {
      for (let b = a + 1; b < names.length; b += 1) tie(names[a], names[b], PLAYLIST_TIE);
    }
  }

  const order = recents.map(mixArtistKey).filter(Boolean);
  for (let at = 0; at < order.length; at += 1) {
    for (let step = 1; step <= NEIGHBOUR_WINDOW && at + step < order.length; step += 1) {
      tie(order[at], order[at + step], 1);
    }
  }

  const ranked = [...artists.entries()].sort((left, right) => right[1].score - left[1].score);
  const used = new Set<string>();
  const mixes: DailyMix[] = [];
  // A mix has to hold together on its own AND be worth having next to the others. Seeding
  // straight down the score order gives every mix the same scene whenever one scene dominates
  // listening, so the next seed is taken from an artist with no tie to anything already used:
  // that lands each mix in a different corner of what you actually play.
  const nextSeed = (): string | null => {
    let fallback: string | null = null;
    for (const [key] of ranked) {
      if (used.has(key)) continue;
      if (fallback === null) fallback = key;
      let tie = 0;
      for (const [other, weight] of near.get(key) ?? new Map<string, number>()) {
        if (used.has(other)) tie += weight;
      }
      if (tie === 0) return key;
    }
    return fallback;
  };
  while (mixes.length < MAX_MIXES) {
    const key = nextSeed();
    if (key === null) break;
    const group = [key];
    used.add(key);
    const neighbours = [...(near.get(key) ?? new Map<string, number>())]
      .filter(([other]) => !used.has(other) && artists.has(other))
      .sort((left, right) => right[1] - left[1]);
    for (const [other] of neighbours) {
      if (group.length >= ARTISTS_PER_MIX) break;
      if (!group.every(member => compatible(member, other))) continue;
      group.push(other);
      used.add(other);
    }
    // Keep a focused Daily Mix when genre metadata cannot safely connect artists.
    const seeds = group.flatMap((entry) => artists.get(entry)?.tracks.slice(0, 4) ?? []);
    const artwork: string[] = [];
    for (const track of seeds) {
      const art = track.artwork?.trim();
      if (art && !artwork.includes(art)) artwork.push(art);
      if (artwork.length === 4) break;
    }
    mixes.push({
      id: `mix:daily:v2:${group.slice().sort().map(encodeURIComponent).join("|")}`,
      index: mixes.length + 1,
      artists: group.flatMap((entry) => artists.get(entry)?.label ?? []),
      seeds,
      artwork,
    });
  }
  return mixes;
}

export async function loadDailyMixTracks(
  mix: DailyMix,
  skip: readonly MusicTrack[] = [],
): Promise<MusicTrack[]> {
  const { hydrateMusicContextTracks, heldMusicContextTracks, rememberMusicContextTracks } = await import("./recent-context");
  await hydrateMusicContextTracks();
  const heard = new Set(skip.map(musicTrackIdentity));
  const allowed = new Set(mix.artists.map(name => name.trim().toLocaleLowerCase()));
  const cached = heldMusicContextTracks("similar", mix.id);
  if (cached?.length) {
    const coherent = cached.filter(track => !backingTrackVersion(track) && allowed.has(mixArtistKey(track)));
    if (coherent.length) return coherent.filter(track => !heard.has(musicTrackIdentity(track)));
  }
  const { resolveArtist } = await import("./artist-authority");
  const { artistTop } = await import("./catalog");
  const pages = await Promise.all(mix.artists.map(async name => {
    const ref = (await resolveArtist(name).catch(() => null))?.canonical;
    return ref ? artistTop(ref).catch(() => []) : [];
  }));
  const lanes = mix.artists.map(name => [...mix.seeds, ...pages.flat()].filter(track => mixArtistKey(track) === name.trim().toLocaleLowerCase()));
  const out: MusicTrack[] = [];
  const seen = new Set<string>();
  for (let index = 0; lanes.some(lane => lane[index]) && out.length < MIX_SIZE; index++) {
    for (const lane of lanes) {
      const track = lane[index];
      if (!track || track.mediaKind === "video" || backingTrackVersion(track)) continue;
      const key = musicTrackIdentity(track);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ...track, mediaKind: "audio" });
      if (out.length === MIX_SIZE) break;
    }
  }
  if (!out.length) throw new Error("music.radio.error");
  rememberMusicContextTracks("similar", mix.id, out);
  return out.filter(track => !heard.has(musicTrackIdentity(track)));
}
