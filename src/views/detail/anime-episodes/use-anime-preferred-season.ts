import { useMemo } from "react";
import { getEpisodeProgress } from "@/lib/episode-progress";
import { manualWatchedState } from "@/lib/manual-watched";
import type { KitsuEpisode } from "@/lib/providers/kitsu";
import { parseKitsuId } from "@/lib/providers/kitsu";
import { splitFranchiseDisplaySeason } from "@/lib/streams/anime-identity-core";
import { lastPlayedEpisode } from "@/lib/resume";
import { animeSeasonKey } from "./anime-season-key";

export function useAnimePreferredSeason({
  episodes,
  metaId,
  trackId,
  traktWatched,
  anilistWatched,
  malWatched,
  mwVersion,
}: {
  episodes: KitsuEpisode[];
  metaId: string;
  trackId?: string;
  traktWatched: Set<string>;
  anilistWatched?: Set<string>;
  malWatched?: Set<string>;
  mwVersion: number;
}): string | null {
  return useMemo(() => {
    if (episodes.length === 0) return null;
    const partScoped =
      splitFranchiseDisplaySeason(parseKitsuId(metaId)) != null ||
      (trackId ? splitFranchiseDisplaySeason(parseKitsuId(trackId)) != null : false);
    const playedFromMeta = lastPlayedEpisode(metaId);
    const playedFromTrack =
      playedFromMeta == null && trackId ? lastPlayedEpisode(trackId) : null;
    const played = playedFromMeta ?? playedFromTrack;
    const playedId =
      playedFromMeta != null ? metaId : playedFromTrack != null ? (trackId ?? null) : null;
    // Merged franchise lists (e.g. Bleach 2004 + TYBW cours) collide on `number`,
    // so prefer the episode from the entry the resume was saved under before
    // falling back to the plain number match.
    const playedEp =
      played != null
        ? ((playedId != null
            ? episodes.find(
                (e) => e.number === played.episode && (e.sourceMetaId ?? metaId) === playedId,
              )
            : undefined) ??
          (partScoped && played.displaySeason != null
            ? (episodes.find(
                (e) =>
                  e.number === played.episode &&
                  splitFranchiseDisplaySeason(parseKitsuId(e.sourceMetaId ?? "")) ===
                    played.displaySeason,
              ) ?? episodes.find((e) => e.number === played.episode))
            : episodes.find((e) => e.number === played.episode)))
        : undefined;
    const playedSeason = partScoped
      ? (playedEp?.seasonNumber ?? playedEp?.imdbSeason ?? null)
      : (playedEp?.imdbSeason ?? playedEp?.seasonNumber ?? null);
    let maxSeason = 1;
    // Provider seasons the current entry occupies. Siblings that collapse
    // into those seasons (standalone entries with native numbering, e.g. TYBW
    // cours as 1:1 on the Bleach 2004 page) must not elect: they hijack the
    // slot while their episodes are displayed on their own pages.
    let maxCurrentSeason = 1;
    for (const ep of episodes) {
      if (ep.sourceMetaId != null) continue;
      const s = ep.imdbSeason ?? ep.seasonNumber ?? 1;
      if (s > maxCurrentSeason) maxCurrentSeason = s;
    }
    for (const ep of episodes) {
      const seasonNo = partScoped
        ? (ep.seasonNumber ?? ep.imdbSeason ?? 1)
        : (ep.imdbSeason ?? ep.seasonNumber ?? 1);
      // Specials (S0) must not elect the preferred season: S0 yields key "0"
      // which matches no picker item and falls back to Season 1.
      if (seasonNo < 1) continue;
      if (ep.sourceMetaId != null) {
        // Standalone split parts (TYBW cours on the Bleach 2004 page) have
        // their own pages and must never elect here.
        if (splitFranchiseDisplaySeason(parseKitsuId(ep.sourceMetaId)) != null) continue;
        // Other siblings elect only when they extend past the current entry;
        // colliding native numbering would hijack the current entry's slot.
        if (seasonNo <= maxCurrentSeason) continue;
      }
      const isCurrent = ep.sourceMetaId == null;
      let progress = getEpisodeProgress(
        ep.sourceMetaId ?? metaId,
        animeSeasonKey(ep),
        ep.number,
        ep.length ?? null,
        ep.imdbId ?? null,
        traktWatched,
        undefined,
        isCurrent ? anilistWatched : undefined,
        undefined,
        isCurrent ? malWatched : undefined,
        ep.imdbSeason,
        ep.imdbEpisode,
      );
      if (
        isCurrent &&
        !progress.watched &&
        trackId &&
        trackId !== metaId &&
        manualWatchedState(metaId, animeSeasonKey(ep), ep.number) !== false
      ) {
        const alt = getEpisodeProgress(
          trackId,
          animeSeasonKey(ep),
          ep.number,
          ep.length ?? null,
          ep.imdbId ?? null,
          traktWatched,
          undefined,
          anilistWatched,
          undefined,
          malWatched,
          ep.imdbSeason,
          ep.imdbEpisode,
        );
        if (alt.watched) progress = alt;
      }
      if (seasonNo > maxSeason) maxSeason = seasonNo;
      if (!progress.watched) {
        if (playedSeason != null && seasonNo < playedSeason) continue;
        return String(seasonNo);
      }
    }
    if (playedSeason != null) return String(playedSeason);
    return String(maxSeason);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodes, metaId, trackId, traktWatched, anilistWatched, malWatched, mwVersion]);
}
