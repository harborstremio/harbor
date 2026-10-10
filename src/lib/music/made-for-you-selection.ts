import { artistIdentityKey } from "./artist-popularity";
import { dailyArtistKey, dailyArtistName } from "./daily-discovery-selection";
import { mixRecordings } from "./mix-quality";
import { musicTrackIdentity } from "./track-identity";
import type { ListeningAffinity } from "./listening-affinity";
import type { MusicArtistRef, MusicTrack } from "./types";

export type MixTaste = {
  recents: readonly MusicTrack[];
  liked: readonly MusicTrack[];
  followed: readonly MusicArtistRef[];
  library: readonly MusicTrack[];
  affinity: ListeningAffinity;
};
export type MixArtist = { key: string; name: string; score: number; seeds: MusicTrack[]; ref?: MusicArtistRef };

/** Count breadth of preference, not raw plays: a binge cannot occupy the whole shelf. */
export function rankMixArtists(taste: MixTaste, now = Date.now()): MixArtist[] {
  const artists = new Map<string, MixArtist>();
  for (const ref of taste.followed) {
    const key = artistIdentityKey(ref.name);
    if (key) artists.set(key, { key, name: ref.name, score: 8, seeds: [], ref });
  }
  for (const [source, weight] of [[taste.liked, 2], [taste.library, 1], [taste.recents, .6]] as const) {
    const counts = new Map<string, number>();
    for (const track of mixRecordings(source)) {
      const key = dailyArtistKey(track);
      if (!key) continue;
      const artist = artists.get(key) ?? { key, name: dailyArtistName(track), score: 0, seeds: [] };
      const count = counts.get(key) ?? 0;
      if (count < 5) artist.score += weight;
      counts.set(key, count + 1);
      if (artist.seeds.length < 30 && !artist.seeds.some(value => musicTrackIdentity(value) === musicTrackIdentity(track))) artist.seeds.push(track);
      artists.set(key, artist);
    }
  }
  for (const artist of artists.values()) {
    const repeat = Math.max(0, ...artist.seeds.map(track => {
      const history = taste.affinity[musicTrackIdentity(track)];
      return history ? Math.min(3, Math.log2(1 + history.plays)) / (1 + Math.max(0, now - history.at) / (30 * 86_400_000)) : 0;
    }));
    artist.score += repeat;
  }
  return [...artists.values()].sort((a, b) => b.score - a.score || a.key.localeCompare(b.key)).slice(0, 24);
}
