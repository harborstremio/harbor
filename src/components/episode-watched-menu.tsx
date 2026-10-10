import { Ban, Check, Eye, EyeOff } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";
import {
  recordManualWatchedMeta,
  setManualWatched,
  setManualWatchedMany,
  setManualWatchedUpTo,
  type ManualWatchedMeta,
} from "@/lib/manual-watched";
import { isEpisodeHidden, setEpisodeHidden } from "@/lib/hidden-episodes";
import { useSettings } from "@/lib/settings";
import { clearResume, readResumeEntry } from "@/lib/resume";
import { markEpisodesWatched, unmarkEpisodeWatched } from "@/lib/simkl/history";
import { stremioIdToSimklTarget } from "@/lib/simkl/ids";
import { useSimkl } from "@/lib/simkl/provider";

export type WatchedMenuTarget = {
  x: number;
  y: number;
  season: number;
  episode: number;
  watched: boolean;
  metaId?: string;
};

function airedByNow(released?: string | null): boolean {
  if (!released) return true;
  const t = Date.parse(released);
  return !Number.isFinite(t) || t <= Date.now();
}

export function EpisodeWatchedMenu({
  metaId,
  meta,
  target,
  allEpisodes,
  onClose,
}: {
  metaId: string;
  meta: ManualWatchedMeta;
  target: WatchedMenuTarget;
  allEpisodes?: Array<{ season: number; episode: number; released?: string | null }>;
  onClose: () => void;
}) {
  const t = useT();
  const { isConnected: simklConnected } = useSimkl();
  const { settings } = useSettings();
  const hidden = isEpisodeHidden(metaId, target.season, target.episode);

  useEffect(() => {
    const onDown = () => onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  const showIds = (() => {
    if (!simklConnected) return null;
    const r = stremioIdToSimklTarget(metaId, { season: target.season, episode: target.episode });
    if (!r.ok) return null;
    if (r.target.kind === "episode") return r.target.show.ids;
    if (r.target.kind === "anime-episode") return r.target.anime.ids;
    return null;
  })();

  const started = !target.watched && readResumeEntry(metaId, target.season, target.episode) != null;

  const unmark = () => {
    setManualWatched(metaId, target.season, target.episode, false);
    clearResume(metaId, target.season, target.episode);
    if (showIds) void unmarkEpisodeWatched(showIds, target.season, target.episode);
    onClose();
  };

  const left = Math.min(target.x, window.innerWidth - 232);
  const top = Math.min(target.y, window.innerHeight - 128);

  return createPortal(
    <div
      role="menu"
      style={{ left, top }}
      onMouseDown={(e) => e.stopPropagation()}
      className="fixed z-[320] flex w-[224px] flex-col rounded-xl border border-edge bg-elevated p-1 shadow-[0_18px_50px_-15px_rgba(0,0,0,0.7)] animate-popover-in"
    >
      {target.watched ? (
        <Item
          icon={<EyeOff size={14} strokeWidth={2} />}
          label={t("Mark as unwatched")}
          onClick={unmark}
        />
      ) : (
        <>
          <Item
            icon={<Check size={14} strokeWidth={2} />}
            label={t("Mark as watched")}
            onClick={() => {
              recordManualWatchedMeta(metaId, meta);
              setManualWatched(metaId, target.season, target.episode, true);
              if (showIds) void markEpisodesWatched(showIds, target.season, [target.episode]);
              onClose();
            }}
          />
          <Item
            icon={<Eye size={14} strokeWidth={2} />}
            label={t("Mark watched up to here")}
            onClick={() => {
              recordManualWatchedMeta(metaId, meta);
              if (allEpisodes && allEpisodes.length > 0) {
                const upTo = allEpisodes.filter(
                  (e) =>
                    airedByNow(e.released) &&
                    (e.season < target.season ||
                      (e.season === target.season && e.episode <= target.episode)),
                );
                setManualWatchedMany(metaId, upTo, true);
                if (showIds) {
                  const eps = upTo.filter((e) => e.season === target.season).map((e) => e.episode);
                  if (eps.length > 0) void markEpisodesWatched(showIds, target.season, eps);
                }
              } else {
                setManualWatchedUpTo(metaId, target.season, target.episode, true);
                if (showIds) {
                  const eps = Array.from({ length: target.episode }, (_, i) => i + 1);
                  void markEpisodesWatched(showIds, target.season, eps);
                }
              }
              onClose();
            }}
          />
          {started && (
            <Item
              icon={<EyeOff size={14} strokeWidth={2} />}
              label={t("Mark as unwatched")}
              onClick={unmark}
            />
          )}
        </>
      )}
      {settings.episodeHiding && (
        <>
          <div className="mx-1 my-1 h-px bg-edge-soft/70" />
          {hidden ? (
            <Item
              icon={<Eye size={14} strokeWidth={2} />}
              label={t("Show episode")}
              onClick={() => {
                setEpisodeHidden(metaId, target.season, target.episode, false);
                onClose();
              }}
            />
          ) : (
            <Item
              icon={<Ban size={14} strokeWidth={2} />}
              label={t("Hide episode")}
              onClick={() => {
                setEpisodeHidden(metaId, target.season, target.episode, true);
                onClose();
              }}
            />
          )}
        </>
      )}
    </div>,
    document.body,
  );
}

function Item({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="flex h-9 items-center gap-2.5 rounded-lg px-3 text-start text-[13px] text-ink transition-colors hover:bg-raised"
    >
      <span className="text-ink-muted">{icon}</span>
      {label}
    </button>
  );
}
