import { useMemo } from "react";
import { getEpisodeProgress, type EpisodeProgress } from "@/lib/episode-progress";
import { manualWatchedState } from "@/lib/manual-watched";
import type { KitsuEpisode } from "@/lib/providers/kitsu";
import { spoilerMaskFor, type SpoilerMask } from "@/lib/spoilers";
import { airedOnly } from "../helpers";
import { animeSeasonKey } from "./anime-season-key";

const NO_PROGRESS: EpisodeProgress = { ratio: 0, watched: false, startedAt: 0 };

export function useAnimeProgressMap({
  episodes,
  displayEpisodes,
  metaId,
  trackId,
  traktWatched,
  anilistWatched,
  malWatched,
  entrySourceId,
  entryAnilistWatched,
  entryMalWatched,
  mwVersion,
  settings,
}: {
  episodes: KitsuEpisode[];
  displayEpisodes: KitsuEpisode[];
  metaId: string;
  trackId?: string;
  traktWatched: Set<string>;
  anilistWatched?: Set<string>;
  malWatched?: Set<string>;
  entrySourceId?: string | null;
  entryAnilistWatched?: Set<string>;
  entryMalWatched?: Set<string>;
  mwVersion: number;
  settings: Parameters<typeof spoilerMaskFor>[0];
}) {
  const progressById = useMemo(() => {
    const m = new Map<number, EpisodeProgress>();
    const add = (ep: KitsuEpisode) => {
      if (m.has(ep.id)) return;
      const isCurrent = ep.sourceMetaId == null;
      const isEntry = entrySourceId != null && ep.sourceMetaId === entrySourceId;
      const seasonKey = animeSeasonKey(ep);
      let prog = getEpisodeProgress(
        ep.sourceMetaId ?? metaId,
        seasonKey,
        ep.number,
        ep.length ?? null,
        ep.imdbId ?? null,
        traktWatched,
        undefined,
        isCurrent ? anilistWatched : isEntry ? entryAnilistWatched : undefined,
        undefined,
        isCurrent ? malWatched : isEntry ? entryMalWatched : undefined,
        ep.imdbSeason,
        ep.imdbEpisode,
      );
      if (
        isCurrent &&
        !prog.watched &&
        trackId &&
        trackId !== metaId &&
        manualWatchedState(metaId, seasonKey, ep.number) !== false
      ) {
        const alt = getEpisodeProgress(
          trackId,
          seasonKey,
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
        if (alt.watched || alt.ratio > prog.ratio) prog = alt;
      }
      m.set(ep.id, prog);
    };
    for (const ep of episodes) add(ep);
    for (const ep of displayEpisodes) add(ep);
    return m;
  }, [
    episodes,
    displayEpisodes,
    metaId,
    trackId,
    traktWatched,
    anilistWatched,
    malWatched,
    entrySourceId,
    entryAnilistWatched,
    entryMalWatched,
    mwVersion,
  ]);

  const progressFor = (ep: KitsuEpisode) => progressById.get(ep.id) ?? NO_PROGRESS;

  const nextUpEp = useMemo(() => {
    const scan = displayEpisodes.length > 0 ? displayEpisodes : episodes;
    for (const ep of scan) {
      if (!progressById.get(ep.id)?.watched) return ep;
    }
    return null;
  }, [displayEpisodes, episodes, progressById]);

  const nextUpId = nextUpEp ? nextUpEp.id : null;
  const nextUpNum = nextUpEp ? nextUpEp.number : null;

  const spoilerFor = (ep: KitsuEpisode): SpoilerMask =>
    spoilerMaskFor(settings, {
      watched: progressById.get(ep.id)?.watched ?? false,
      isNextUp: ep.id === nextUpId,
    });

  const airedDisplay = airedOnly(displayEpisodes, (ep) => ep.airdate);
  const allWatched =
    airedDisplay.length > 0 && airedDisplay.every((ep) => progressById.get(ep.id)?.watched);

  return { progressFor, nextUpNum, nextUpId, spoilerFor, allWatched };
}
