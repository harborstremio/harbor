import type { Meta } from "@/lib/cinemeta";

export type CinemetaVideo = NonNullable<Meta["videos"]>[number];

export type EpisodeGroup = { seasonNumber: number; episodes: CinemetaVideo[] };

/** The group a provider's unnumbered episodes belong to. CloudStream calls it "No Season", and it
 * is a group of its own rather than a fallback used when there are no seasons at all. */
export const NO_SEASON = -1;

/** A provider that numbers no episodes still has an order, and every layout has to agree on it. */
export function episodeSeason(ep: CinemetaVideo): number {
  return ep.season ?? 0;
}

export function episodeNumber(ep: CinemetaVideo, index: number): number {
  return ep.episode ?? ep.number ?? (ep.season == null ? index + 1 : 1);
}

/** The episodes a provider's own list groups into seasons, in season order, followed by its "No
 * Season" group when it left any episode unnumbered.
 *
 * Appending that group rather than replacing the seasons is what makes those episodes reachable.
 * They used to be dropped whenever any episode was numbered, which is why a bonus episode could
 * only be found through a provider that numbered it the same way as a real one. */
export function groupEpisodes(videos: NonNullable<Meta["videos"]>): EpisodeGroup[] {
  const map = new Map<number, CinemetaVideo[]>();
  const flat: CinemetaVideo[] = [];
  for (const v of videos) {
    if (v.season == null || (v.episode ?? v.number) == null) {
      flat.push(v);
      continue;
    }
    const arr = map.get(v.season) ?? [];
    arr.push(v);
    map.set(v.season, arr);
  }
  const numbered: EpisodeGroup[] = Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([seasonNumber, eps]) => ({
      seasonNumber,
      episodes: eps
        .slice()
        .sort((a, b) => (a.episode ?? a.number ?? 0) - (b.episode ?? b.number ?? 0)),
    }));
  if (flat.length === 0) return numbered;
  // The provider's order is kept. These episodes have no numbers to sort by, and the row's number
  // is its position in this very list, so reordering them here would make that position name a
  // different episode than the one the player is asked for.
  return [...numbered, { seasonNumber: NO_SEASON, episodes: flat }];
}
