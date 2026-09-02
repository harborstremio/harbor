import type { CastDeviceInfo } from "@/lib/cast";
import { useT } from "@/lib/i18n";

export function CastSessionBar({
  device,
  playing,
  positionSec,
  durationSec,
  onTogglePlay,
  onStop,
  onSeek,
  transcoding,
}: {
  device: CastDeviceInfo;
  playing: boolean;
  positionSec: number;
  durationSec: number;
  onTogglePlay: () => void | Promise<void>;
  onStop: () => void | Promise<void>;
  onSeek: (sec: number) => void | Promise<void>;
  transcoding?: boolean;
}) {
  const t = useT();
  return (
    <div className="pointer-events-auto absolute left-1/2 top-6 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full border border-edge bg-elevated/95 px-4 py-2.5 shadow-[0_18px_40px_-14px_rgba(0,0,0,0.7)] backdrop-blur-md">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/20 text-accent">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
          <path d="M2 12a8 8 0 0 1 8 8" />
          <path d="M2 16a4 4 0 0 1 4 4" />
          <line x1="2" y1="20" x2="2" y2="20" />
        </svg>
      </span>
      <div className="flex flex-col">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
          {t("Casting to")}
        </span>
        <span className="text-[12.5px] font-semibold text-ink">{device.name}</span>
      </div>
      {transcoding && (
        <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-amber-200">
          {t("Transcoding")}
        </span>
      )}
      <div className="ms-2 flex items-center gap-1.5">
        <button
          onClick={() => void onTogglePlay()}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-canvas/60 text-ink transition-colors hover:bg-canvas/85"
          aria-label={playing ? t("Pause") : t("Play")}
        >
          {playing ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 5v14l12-7z" />
            </svg>
          )}
        </button>
        <button
          onClick={() => void onSeek(Math.max(0, positionSec - 15))}
          className="rounded-full bg-canvas/60 px-2.5 py-1 text-[11px] font-semibold text-ink transition-colors hover:bg-canvas/85"
        >
          {t("−15s")}
        </button>
        <button
          onClick={() =>
            void onSeek(Math.min(durationSec || Number.POSITIVE_INFINITY, positionSec + 15))
          }
          className="rounded-full bg-canvas/60 px-2.5 py-1 text-[11px] font-semibold text-ink transition-colors hover:bg-canvas/85"
        >
          {t("+15s")}
        </button>
        <button
          onClick={() => void onStop()}
          className="rounded-full bg-rose-400/20 px-3 py-1 text-[11px] font-semibold text-rose-100 transition-colors hover:bg-rose-400/30"
        >
          {t("Stop")}
        </button>
      </div>
    </div>
  );
}
