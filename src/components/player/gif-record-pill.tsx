import { useT } from "@/lib/i18n";
import type { GifState } from "@/views/player/hooks/use-gif-recorder";
import { Loader2, Square, X } from "lucide-react";

function fmt(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function GifRecordPill({
  state,
  elapsedSec,
  onStop,
  onAbort,
}: {
  state: GifState;
  elapsedSec: number;
  onStop: () => void;
  onAbort: () => void;
}) {
  const t = useT();
  if (state === "idle") return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-24 z-40 -translate-x-1/2 animate-[harbor-fade-in_200ms_ease-out]">
      <div className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-white/15 bg-black/80 py-1.5 ps-3.5 pe-1.5 text-[12.5px] font-medium text-white backdrop-blur-md">
        {state === "recording" ? (
          <>
            <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-500" />
            <span className="tabular-nums">
              {t("REC")} <span className="text-white/70">{fmt(elapsedSec)}</span>
            </span>
            <button
              type="button"
              onClick={onStop}
              className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 text-[12px] font-semibold text-white transition-colors hover:bg-white/25"
            >
              <Square size={11} strokeWidth={2.4} fill="currentColor" />
              {t("Stop")}
            </button>
            <button
              type="button"
              onClick={onAbort}
              aria-label={t("Discard recording")}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X size={13} strokeWidth={2.4} />
            </button>
          </>
        ) : (
          <span className="inline-flex items-center gap-2 pe-2">
            <Loader2 size={13} strokeWidth={2.4} className="animate-spin text-white/80" />
            {t("Saving GIF…")}
          </span>
        )}
      </div>
    </div>
  );
}
