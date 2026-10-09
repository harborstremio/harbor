import type { PlayEpisode } from "@/lib/view";

const ANIME_SCHEME_RX = /^(kitsu|mal|anilist|anidb):/;

export function unverifiedAnimeSeasonId(
  metaId: string,
  episode: PlayEpisode | null | undefined,
): string | null {
  if (!episode || episode.kitsuStreamId != null) return null;
  if (!ANIME_SCHEME_RX.test(metaId)) return null;
  if (typeof episode.imdbSeason !== "number" || episode.imdbSeason < 2) return null;
  const [scheme, entry] = metaId.split(":");
  return `${scheme}:${entry}:${episode.episode}`;
}

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
  const courOffset =
    animeMeta &&
    episode?.imdbEpisode != null &&
    episode?.episode != null &&
    episode.episode < episode.imdbEpisode;
  if (!animeMeta && mappedImdb && mappedImdb.startsWith("tt") && imdbEpAligned) {
    push(`${mappedImdb}:${episode!.imdbSeason}:${episode!.imdbEpisode}`);
  }

  const unverifiedAnimeId = unverifiedAnimeSeasonId(metaId, episode);

  if (episode?.kitsuStreamId) {
    push(episode.kitsuStreamId);
  } else if (/^(kitsu|mal|anilist|anidb):/.test(metaId) && episode) {
    if (episode.imdbSeason !== 0 && unverifiedAnimeId == null) {
      push(`${metaId.split(":")[0]}:${metaId.split(":")[1]}:${episode.episode}`);
    }
  } else if ((metaId.startsWith("kitsu:") || metaId.startsWith("mal:")) && !episode) {
    push(metaId);
  } else if (metaId.startsWith("tt") && episode) {
    if (!animeMeta) push(`${metaId}:${episode.season}:${episode.episode}`);
  } else if (metaId.startsWith("tt") && !episode) {
    push(metaId);
  } else if (metaId.startsWith("tmdb:")) {
    // Some stream addons (and AIOMetadata) use the bare `tmdb:{id}` scheme
    // without the movie/tv segment. Emit it first so addons that match the bare
    // prefix (they also match the scoped form) are queried with it; they index
    // by the bare id and return nothing for the scoped form.
    const bareBase = metaId.replace(/^tmdb:(movie|tv):/, "tmdb:");
    if (episode) {
      if (!animeMeta) {
        if (bareBase !== metaId) push(`${bareBase}:${episode.season}:${episode.episode}`);
        push(`${metaId}:${episode.season}:${episode.episode}`);
      }
    } else {
      if (bareBase !== metaId) push(bareBase);
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

  // Split-franchise children (e.g. Bleach TYBW) have entry-relative numbering
  // that runs ahead of the provider's within-cour numbering and a kitsu season
  // (1) that differs from the provider season — neither courOffset nor
  // synthSeason catches them, so emit the provider pair explicitly.
  if (
    animeMeta &&
    episode != null &&
    episode.kitsuStreamId == null &&
    mappedImdb != null &&
    mappedImdb.startsWith("tt") &&
    episode.imdbSeason != null &&
    episode.imdbSeason >= 1 &&
    episode.imdbEpisode != null &&
    episode.imdbEpisode >= 1 &&
    (episode.season !== episode.imdbSeason || episode.episode !== episode.imdbEpisode)
  ) {
    push(`${mappedImdb}:${episode.imdbSeason}:${episode.imdbEpisode}`);
  }

  if (
    animeMeta &&
    episode != null &&
    mappedImdb != null &&
    mappedImdb.startsWith("tt") &&
    episode.imdbSeason != null &&
    episode.imdbSeason >= 1 &&
    episode.imdbEpisode != null &&
    episode.imdbEpisode >= 1
  ) {
    push(`${mappedImdb}:${episode.imdbSeason}:${episode.imdbEpisode}`);
  }

  if (unverifiedAnimeId) push(unverifiedAnimeId);

  return out;
}
