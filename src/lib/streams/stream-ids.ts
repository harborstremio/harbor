import type { PlayEpisode } from "@/lib/view";

export function buildStreamIds(
  metaId: string,
  episode: PlayEpisode | undefined,
  imdbId: string | null,
  defaultVideoId?: string | null,
  videos?: ReadonlyArray<{
    season?: number | null;
    episode?: number | null;
    number?: number | null;
  }>,
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
  if (episode?.imdbSeason != null && episode.imdbEpisode != null) {
    const mappedImdb = episode.imdbId ?? imdbId;
    const imdbEpAligned = !animeMeta || episode.episode === episode.imdbEpisode;
    if (mappedImdb?.startsWith("tt") && imdbEpAligned) {
      push(`${mappedImdb}:${episode.imdbSeason}:${episode.imdbEpisode}`);
    }
  }

  if (episode?.kitsuStreamId) {
    push(episode.kitsuStreamId);
  } else if (metaId.startsWith("kitsu:") && episode) {
    push(`kitsu:${metaId.split(":")[1]}:${episode.episode}`);
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

  // When doing a season-level request (no episode) and we have video metadata,
  // also emit individual episode-level IDs so addons that don't provide season
  // packs can still return streams for individual episodes. The pipeline
  // deduplicates by infoHash/URL so adding both levels is harmless.
  // Capped at 50 to avoid excessive requests for very long series.
  if (!episode && videos) {
    let added = 0;
    for (const v of videos) {
      if (added >= 50) break;
      const season = v.season;
      const ep = v.episode ?? v.number;
      if (season == null || ep == null) continue;
      // For kitsu meta, episode IDs are kitsu:{id}:{ep} (no season)
      const epId = metaId.startsWith("kitsu:")
        ? `kitsu:${metaId.split(":")[1]}:${ep}`
        : `${metaId}:${season}:${ep}`;
      push(epId);
      added++;
    }
  }

  return out;
}
