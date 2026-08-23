import type { PlayEpisode } from "@/lib/view";

export function buildStreamIds(
  metaId: string,
  episode: PlayEpisode | undefined,
  imdbId: string | null,
  defaultVideoId?: string | null,
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
  const imdbEpAligned = !animeMeta || episode?.episode === episode?.imdbEpisode;
  const continuousAnime =
    animeMeta && episode?.imdbEpisode != null && episode?.episode != null &&
    episode.episode !== episode.imdbEpisode;
  const courOffset =
    animeMeta &&
    episode?.imdbEpisode != null &&
    episode?.episode != null &&
    episode.episode < episode.imdbEpisode;
  if (!animeMeta && mappedImdb && mappedImdb.startsWith("tt") && imdbEpAligned) {
    push(`${mappedImdb}:${episode!.imdbSeason}:${episode!.imdbEpisode}`);
  }

  if (episode?.kitsuStreamId) {
    push(episode.kitsuStreamId);
  } else if (/^(kitsu|mal|anilist|anidb):/.test(metaId) && episode) {
    if (episode.imdbSeason !== 0) {
      push(`${metaId.split(":")[0]}:${metaId.split(":")[1]}:${episode.episode}`);
    }
  } else if ((metaId.startsWith("kitsu:") || metaId.startsWith("mal:")) && !episode) {
    push(metaId);
  } else if (metaId.startsWith("tt") && episode) {
    if (!animeMeta) push(`${metaId}:${episode.season}:${episode.episode}`);
  } else if (metaId.startsWith("tt") && !episode) {
    push(metaId);
  } else if (metaId.startsWith("tmdb:")) {
    if (episode) {
      if (!animeMeta) push(`${metaId}:${episode.season}:${episode.episode}`);
    } else {
      push(metaId);
    }
  } else {
    if (episode) push(`${metaId}:${episode.season}:${episode.episode}`);
    else push(metaId);
  }

  if (imdbId && imdbId.startsWith("tt")) {
    if (!episode) push(imdbId);
    else if (!animeMeta) push(`${imdbId}:${episode.season}:${episode.episode}`);
  }

  if (mappedImdb && mappedImdb.startsWith("tt") && !imdbEpAligned && courOffset) {
    push(`${mappedImdb}:${episode!.imdbSeason}:${episode!.imdbEpisode}`);
  }

  // Seasonal anime with real seasons (e.g. SAO S3E5): Kitsu reports a wrong/misleading season
  // (S1E5), so add the IMDb season-aware id so addons scope to the correct season instead of
  // returning every "episode 5" across all seasons. Skipped for continuous anime (One Piece).
  if (animeMeta && !continuousAnime && mappedImdb && mappedImdb.startsWith("tt")) {
    push(`${mappedImdb}:${episode!.imdbSeason}:${episode!.imdbEpisode}`);
  }

  const isSpecialWithImdb = animeMeta && episode?.imdbSeason === 0 && episode?.imdbEpisode != null;
  if (isSpecialWithImdb && mappedImdb && mappedImdb.startsWith("tt")) {
    push(`${mappedImdb}:0:${episode!.imdbEpisode}`);
  }

  const synthSeason =
    animeMeta &&
    episode?.kitsuStreamId == null &&
    episode?.imdbSeason != null &&
    episode.imdbSeason >= 2 &&
    episode.season === episode.imdbSeason;
  if (synthSeason && mappedImdb && mappedImdb.startsWith("tt")) {
    push(`${mappedImdb}:${episode!.imdbSeason}:${episode!.imdbEpisode}`);
  }

  return out;
}
