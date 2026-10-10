import { Maximize, Pause, Play, Square } from "lucide-react";
import { useT } from "@/lib/i18n";
import { NATIVE_HERO_BAR_PX } from "@/lib/player/native-tv/bridge";

/**
 * The TV app draws its native video over the page, so in the hero the web controls can't sit on
 * the picture. This bar sits just below it instead.
 */
export function NativeHeroBar({
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
    "flex h-11 items-center gap-2 rounded-full px-4 text-[14px] font-medium text-ink transition-colors hover:bg-raised focus-visible:bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";
  return (
    <div
      className="absolute inset-x-0 bottom-0 z-[70] flex items-center gap-2 border-t border-edge-soft bg-canvas px-4"
      style={{ height: NATIVE_HERO_BAR_PX }}
    >
      {live && (
        <span className="rounded bg-danger px-2 py-0.5 text-[11px] font-bold tracking-wider text-white">
          {t("LIVE")}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">{title}</span>
      <button onClick={onPlayPause} className={button} aria-label={playing ? t("Pause") : t("Play")}>
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <button onClick={onExpand} className={button}>
        <Maximize size={16} />
        {t("Full screen")}
      </button>
      <button onClick={onStop} className={button}>
        <Square size={15} />
        {t("Stop")}
      </button>
    </div>
  );
}
