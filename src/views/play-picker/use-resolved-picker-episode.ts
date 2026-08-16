import { useEffect, useMemo, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { fetchSeasonEpisodes } from "@/lib/series-episodes";
import type { PlayEpisode } from "@/lib/view";
import {
  createPickerEpisodeTitleResolution,
  mergePickerEpisodeTitle,
} from "./picker-episode-title";

const PICKER_EPISODE_ACTION_WAIT_MS = 900;

type ResolvedState = { key: string; episode: PlayEpisode };

export type ResolvedPickerEpisode = {
  episode: PlayEpisode | undefined;
  settleEpisode: () => Promise<PlayEpisode | undefined>;
};

export function useResolvedPickerEpisode(
  meta: Meta,
  episode: PlayEpisode | undefined,
  imdbId: string | null,
  tmdbKey: string,
): ResolvedPickerEpisode {
  const key = episode
    ? `${meta.id}:${episode.season}:${episode.episode}:${episode.sourceMetaId ?? ""}`
    : `${meta.id}:none`;
  const resolution = useMemo(() => {
    const synchronous = episode ? mergePickerEpisodeTitle(episode, meta.videos) : undefined;
    const lookupId = synchronous?.sourceMetaId || imdbId || meta.id;
    const lookupMeta: Meta =
      lookupId === meta.id ? meta : { ...meta, id: lookupId, type: "series" };
    return createPickerEpisodeTitleResolution(
      synchronous,
      undefined,
      synchronous
        ? () => fetchSeasonEpisodes(lookupMeta, synchronous.season, { tmdbKey })
        : undefined,
      { actionWaitMs: PICKER_EPISODE_ACTION_WAIT_MS },
    );
  }, [key, episode, imdbId, meta, tmdbKey]);
  const [resolved, setResolved] = useState<ResolvedState | null>(null);

  useEffect(() => {
    let cancelled = false;
    void resolution.resolveEpisode().then((next) => {
      if (cancelled || !next || next === resolution.episode) return;
      setResolved({ key, episode: next });
    });
    return () => {
      cancelled = true;
    };
  }, [key, resolution]);

  const displayedEpisode =
    resolved?.key === key
      ? mergePickerEpisodeTitle(resolution.episode ?? resolved.episode, [resolved.episode])
      : resolution.episode;

  return { episode: displayedEpisode, settleEpisode: resolution.settleEpisode };
}
