import type { PlayEpisode } from "./view";

export type AnimeTrackerTarget = { id: string; episode: number | undefined };

const entryId = (id: string | undefined): string | null =>
  /^(?:kitsu|mal|anilist):\d+$/.test(id ?? "") ? id! : null;

/** AniList/MAL progress counts episodes within the resolved entry, not a TV season. */
export function animeTrackerTarget(
  metaId: string,
  episode: PlayEpisode | undefined,
  fallbackEpisode: number | undefined,
): AnimeTrackerTarget | null {
  const stream = /^kitsu:(\d+):(\d+)$/.exec(episode?.kitsuStreamId ?? "");
  const streamEntry = stream ? `kitsu:${stream[1]}` : null;
  const id = entryId(episode?.sourceMetaId) ?? streamEntry ?? entryId(metaId);
  if (!id) return null;
  return {
    id,
    // A matching stream ID explicitly binds this number to this entry. An
    // absoluteNumber or imdbEpisode alone carries no such ownership evidence.
    episode: stream && id === streamEntry ? Number(stream[2]) : (fallbackEpisode ?? episode?.episode),
  };
}
