import { Maximize, Pause, Play, Square } from "lucide-react";
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
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-raised focus-visible:bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";
  return createPortal(
    <div
      role="group"
      aria-label={t("Pinned video")}
      className="fixed bottom-5 end-5 z-[60] flex max-w-[min(420px,calc(100vw-40px))] items-center gap-1 rounded-full border border-edge-soft bg-canvas/80 py-1.5 ps-4 pe-1.5 shadow-2xl backdrop-blur-xl"
    >
      {live && (
        <span className="me-1 rounded bg-danger px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white">
          {t("LIVE")}
        </span>
      )}
      <span className="me-2 min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{title}</span>
      <button
        type="button"
        onClick={onPlayPause}
        className={button}
        aria-label={playing ? t("Pause") : t("Play")}
      >
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <button type="button" onClick={onExpand} className={button} aria-label={t("Full screen")}>
        <Maximize size={16} />
      </button>
      <button type="button" onClick={onStop} className={button} aria-label={t("Stop")}>
        <Square size={14} />
      </button>
    </div>,
    document.body,
  );
}
