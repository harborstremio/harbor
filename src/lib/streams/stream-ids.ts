import type { PlayEpisode } from "@/lib/view";

export function buildStreamIds(
  metaId: string,
  episode: PlayEpisode | undefined,
  imdbId: string | null,
  defaultVideoId?: string | null,
  omitEpisode?: boolean,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (s: string | undefined | null) => {
    if (!s || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  };

  if (episode?.videoId) push(episode.videoId);
  if (!episode && defaultVideoId) push(defaultVideoId);

  const animeMeta = /^(kitsu|mal|anilist|anidb):/.test(metaId) || episode?.kitsuStreamId != null;
  const mappedImdb =
    episode?.imdbSeason != null && episode?.imdbEpisode != null ? (episode.imdbId ?? imdbId) : null;
  if (mappedImdb && mappedImdb.startsWith("tt")) {
    push(omitEpisode ? `${mappedImdb}:${episode!.imdbSeason}` : `${mappedImdb}:${episode!.imdbSeason}:${episode!.imdbEpisode}`);
  }

  if (episode?.kitsuStreamId) {
    push(episode.kitsuStreamId);
  } else if (metaId.startsWith("kitsu:") && episode) {
    push(`kitsu:${metaId.split(":")[1]}:${episode.episode}`);
  } else if ((metaId.startsWith("kitsu:") || metaId.startsWith("mal:")) && !episode) {
    push(metaId);
  } else if (metaId.startsWith("tt") && episode) {
    if (!animeMeta) push(omitEpisode ? `${metaId}:${episode.season}` : `${metaId}:${episode.season}:${episode.episode}`);
  } else if (metaId.startsWith("tt") && !episode) {
    push(metaId);
  } else if (metaId.startsWith("tmdb:")) {
    if (episode) {
      if (!animeMeta) push(omitEpisode ? `${metaId}:${episode.season}` : `${metaId}:${episode.season}:${episode.episode}`);
    } else {
      push(metaId);
    }
  } else {
    if (episode) push(omitEpisode ? `${metaId}:${episode.season}` : `${metaId}:${episode.season}:${episode.episode}`);
    else push(metaId);
  }

  if (imdbId && imdbId.startsWith("tt")) {
    if (!episode) push(imdbId);
    else if (!animeMeta) push(omitEpisode ? `${imdbId}:${episode.season}` : `${imdbId}:${episode.season}:${episode.episode}`);
  }

  return out;
}
