import { Ban, Check, Eye, EyeOff } from "lucide-react";
import { useEffect, useRef } from "react";
import { useT } from "@/lib/i18n";
import {
  manualWatchedState,
  subscribeManualWatched,
  type ManualWatchedMeta,
} from "@/lib/manual-watched";
import { isEpisodeHidden, setEpisodeHidden } from "@/lib/hidden-episodes";
import { useSettings } from "@/lib/settings";
import { useProfiles } from "@/lib/profiles";
import { clearResume, readResumeEntry } from "@/lib/resume";
import { useTmdbImdbId } from "@/lib/providers/tmdb";
import {
  setContextWatched,
  requireMediaActionSuccess,
  type WatchedEpisode,
} from "@/lib/media-context-actions";
import type { ContextAction } from "@/lib/context-actions";
import { MenuSurface } from "./context-menu/menu-surface";
import { ActionItems } from "./context-menu/action-items";

export type WatchedMenuTarget = {
  x: number;
  y: number;
  season: number;
  episode: number;
  watched: boolean;
  metaId?: string;
  origin?: HTMLElement | null;
};

function airedByNow(released?: string | null): boolean {
  if (!released) return true;
  const date = Date.parse(released);
  return !Number.isFinite(date) || date <= Date.now();
}

export function EpisodeWatchedMenu({
  metaId,
  syncMetaId,
  meta,
  target,
  allEpisodes,
  onClose,
}: {
  metaId: string;
  syncMetaId?: string;
  meta: ManualWatchedMeta;
  target: WatchedMenuTarget;
  allEpisodes?: Array<WatchedEpisode & { released?: string | null }>;
  onClose: () => void;
}) {
  const t = useT();
  const { settings } = useSettings();
  const { activeId } = useProfiles();
  const initialProfile = useRef(activeId);
  const origin = useRef(
    target.origin ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null),
  );
  const imdbId = useTmdbImdbId(metaId);
  const close = (restoreFocus = true) => {
    onClose();
    if (restoreFocus && origin.current?.isConnected) origin.current.focus({ preventScroll: true });
  };
  useEffect(() => {
    if (activeId !== initialProfile.current) onClose();
  }, [activeId, onClose]);
  const runWatched = async (watched: boolean, episodes?: WatchedEpisode[]) => {
    const result = await setContextWatched({ id: metaId, ...meta, type: "series" }, watched, {
      imdbId,
      syncMetaId,
      ...(episodes
        ? { episodes }
        : { episode: { season: target.season, episode: target.episode } }),
    });
    if (
      !watched &&
      result.outcomes.some(
        (outcome) => outcome.provider === "Harbor" && outcome.status === "updated",
      )
    )
      clearResume(metaId, target.season, target.episode);
    requireMediaActionSuccess(result);
  };
  const actions = (): ContextAction[] => {
    const watched = manualWatchedState(metaId, target.season, target.episode) ?? target.watched;
    const started = !watched && readResumeEntry(metaId, target.season, target.episode) != null;
    const upTo = [
      ...new Map(
        (allEpisodes ?? [])
          .filter(
            (episode) =>
              airedByNow(episode.released) &&
              (episode.season < target.season ||
                (episode.season === target.season && episode.episode <= target.episode)),
          )
          .map((episode) => [
            episode.season + ":" + episode.episode,
            { season: episode.season, episode: episode.episode },
          ]),
      ).values(),
    ];
    const result: ContextAction[] = [];
    if (!watched) {
      result.push({
        id: "episode:watched",
        icon: <Check size={14} />,
        label: t("Mark episode as watched"),
        run: () => runWatched(true),
        group: "watched",
      });
      result.push({
        id: "episode:up-to",
        icon: <Eye size={14} />,
        label: t("Mark {count} episodes up to here", { count: upTo.length }),
        disabled: upTo.length === 0,
        reason: upTo.length ? undefined : t("Episode information is unavailable."),
        run: () => runWatched(true, upTo),
        group: "watched",
      });
    }
    if (watched || started)
      result.push({
        id: "episode:unwatched",
        icon: <EyeOff size={14} />,
        label: t("Mark episode as unwatched"),
        run: () => runWatched(false),
        group: "watched",
      });
    if (settings.episodeHiding) {
      const hidden = isEpisodeHidden(metaId, target.season, target.episode);
      result.push({
        id: "episode:hidden",
        icon: hidden ? <Eye size={14} /> : <Ban size={14} />,
        label: hidden ? t("Show episode") : t("Hide episode"),
        run: () =>
          setEpisodeHidden(
            metaId,
            target.season,
            target.episode,
            !isEpisodeHidden(metaId, target.season, target.episode),
          ),
        group: "visibility",
      });
    }
    return result;
  };
  const latest = useRef(actions);
  latest.current = actions;
  return (
    <MenuSurface point={{ x: target.x, y: target.y }} onClose={close} label={t("Episode actions")}>
      <ActionItems
        source={{
          actions: () => latest.current(),
          isValid: () => activeId === initialProfile.current,
          subscribe: subscribeManualWatched,
        }}
        onClose={close}
      />
    </MenuSurface>
  );
}
