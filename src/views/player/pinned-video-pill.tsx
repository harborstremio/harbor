import { Maximize, Pause, Play, Square, Wallpaper } from "lucide-react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";

/**
 * Controls for a video pinned as the page wallpaper. The video sits under the page, so its own
 * controls can't be clicked; this pill floats over the page instead (portaled out of the player's
 * stacking context).
 */
export function PinnedVideoPill({
  title,
  playing,
  live,
  onPlayPause,
  onExpand,
  onStop,
}: {
  title: string;
  playing: boolean;
  live: boolean;
  onPlayPause: () => void;
  onExpand: () => void;
  onStop: () => void;
}) {
  const t = useT();
  const button =
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink transition-colors hover:bg-raised focus-visible:bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";
  return createPortal(
    <div
      role="group"
      aria-label={t("Pinned video")}
      className="fixed bottom-5 end-5 z-[60] flex max-w-[min(520px,calc(100vw-40px))] items-center gap-1 rounded-2xl border border-edge-soft bg-canvas/80 p-1.5 shadow-2xl backdrop-blur-xl"
    >
      <button
        type="button"
        onClick={onPlayPause}
        className={button}
        aria-label={playing ? t("Pause") : t("Play")}
      >
        {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
      </button>
      <button type="button" onClick={onStop} className={button} aria-label={t("Stop")}>
        <Square size={15} fill="currentColor" />
      </button>
      <button type="button" onClick={onExpand} className={button} aria-label={t("Full screen")}>
        <Maximize size={17} />
      </button>
      <span className="ms-2 flex min-w-0 flex-1 flex-col pe-3">
        <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-ink">
          <Wallpaper size={14} className="shrink-0" />
          {live && (
            <span className="rounded bg-danger px-1 py-px text-[9.5px] font-bold tracking-wider text-white">
              {t("LIVE")}
            </span>
          )}
          <span className="truncate">{title}</span>
        </span>
        <span className="truncate text-[11px] text-ink-subtle">
          {t("Wallpaper mode — video continues while you browse")}
        </span>
      </span>
    </div>,
    document.body,
  );
}
