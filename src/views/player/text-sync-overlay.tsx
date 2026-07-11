import { useT } from "@/lib/i18n";
import { usePlaybackPosition } from "@/lib/player/playback-clock";
import { findActiveCue } from "@/lib/subtitles/parser";
import { deltaFn } from "@/lib/subtitles/text-sync";
import { Check, Loader2, RotateCcw, Scissors, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { useTextSync } from "./hooks/use-text-sync";
import { TextSyncList } from "./text-sync-list";

export type TextSyncApi = ReturnType<typeof useTextSync>;

export function TextSyncOverlay({
  api,
  playing,
  onPlayPause,
}: {
  api: TextSyncApi;
  playing: boolean;
  onPlayPause: () => void;
}) {
  const t = useT();
  const position = usePlaybackPosition();
  const [sectionMode, setSectionMode] = useState(false);
  const [query, setQuery] = useState("");
  const cues = api.cues;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        api.discard();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [api]);

  const activeIndex = useMemo(() => {
    if (!cues) return null;
    const cue = findActiveCue(cues, position);
    return cue ? cues.indexOf(cue) : null;
  }, [cues, position]);

  if (api.syncMode === "idle") return null;

  const currentDelta = deltaFn(api.points, api.nudge)(position);

  const hint = sectionMode
    ? t("Tap the first and last line of the section, then tap the line playing now and Sync from here.")
    : api.pointCount === 0
      ? t("Find the line you hear right now, then Sync from here. Everything shifts to match.")
      : api.pointCount === 1
        ? t(
            "Set. If the subtitles drift later on, play ahead and Sync from here again at a later line to fix the drift.",
          )
        : t("Drift correction is on (2 points). Fine-tune with the buttons, or fix a stray section.");

  return (
    <div className="pointer-events-none absolute inset-0 z-[70]">
      <aside
        role="dialog"
        aria-label={t("Sync subtitles")}
        className="pointer-events-auto absolute end-0 top-0 flex h-full w-full max-w-[480px] flex-col overflow-hidden border-s border-edge-soft/70 bg-surface/85 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.85)] backdrop-blur-2xl duration-300 animate-in slide-in-from-right"
      >
        <header className="flex items-center justify-between gap-3 px-6 pb-4 pt-7">
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.32em] text-ink-subtle">
              {t("Subtitle timing")}
            </p>
            <h2 className="mt-1 font-display text-[23px] font-semibold leading-tight text-ink">
              {sectionMode ? t("Fix one section") : t("Sync to the audio")}
            </h2>
          </div>
          <button
            aria-label={t("Close")}
            onClick={api.discard}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-elevated text-ink-muted transition-colors hover:bg-raised hover:text-ink"
          >
            <X size={18} strokeWidth={2.2} />
          </button>
        </header>

        {api.syncMode === "loading" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-ink-muted">
            <Loader2 size={26} className="animate-spin" />
            <span className="text-[13.5px]">{t("Reading subtitles...")}</span>
          </div>
        ) : !cues ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 py-20 text-center">
            <span className="text-[14px] leading-relaxed text-ink-muted">
              {t("Could not read this subtitle track. Pick a different subtitle, then try again.")}
            </span>
            <button
              onClick={api.discard}
              className="rounded-full bg-elevated px-5 py-2.5 text-[13px] font-semibold text-ink ring-1 ring-edge-soft transition-colors hover:bg-raised"
            >
              {t("Close")}
            </button>
          </div>
        ) : (
          <>
            <p className="px-6 pb-3 text-[13.5px] leading-relaxed text-ink-muted">{hint}</p>

            <div className="px-6 pb-4">
              <div className="flex items-center gap-2.5 rounded-2xl bg-elevated px-3.5 ring-1 ring-edge-soft">
                <Search size={16} className="shrink-0 text-ink-subtle" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("Search a line by its words")}
                  className="h-11 flex-1 bg-transparent text-[14.5px] text-ink outline-none placeholder:text-ink-subtle"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    aria-label={t("Clear search")}
                    className="shrink-0 text-ink-subtle transition-colors hover:text-ink"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1 border-t border-edge-soft/50">
              <TextSyncList
                cues={cues}
                activeIndex={activeIndex}
                points={api.points}
                segments={api.segments}
                rangeStart={api.rangeStart}
                rangeEnd={api.rangeEnd}
                sectionMode={sectionMode}
                query={query}
                onSyncHere={api.syncFromHere}
                onSeek={api.seekTo}
                onRangeStart={api.setRangeStart}
                onRangeEnd={api.setRangeEnd}
              />
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-edge-soft/60 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <StepBtn label="−0.1" onClick={() => api.nudgeBy(-0.1)} />
                <div className="flex h-11 min-w-[98px] items-center justify-center rounded-xl bg-elevated ring-1 ring-edge-soft">
                  <span className="text-[17px] font-bold tabular-nums text-ink">
                    {currentDelta >= 0 ? "+" : "−"}
                    {Math.abs(currentDelta).toFixed(2)}
                    <span className="ms-0.5 text-[13px] font-medium text-ink-subtle">s</span>
                  </span>
                </div>
                <StepBtn label="+0.1" onClick={() => api.nudgeBy(0.1)} />
              </div>
              <button
                onClick={() => {
                  setSectionMode((v) => !v);
                  api.clearRange();
                }}
                className={`flex h-11 items-center gap-2 rounded-xl px-3.5 text-[13.5px] font-semibold transition-colors ${
                  sectionMode
                    ? "bg-accent/20 text-ink ring-1 ring-accent/50"
                    : "bg-elevated text-ink-muted ring-1 ring-edge-soft hover:bg-raised hover:text-ink"
                }`}
              >
                <Scissors size={15} />
                {t("Fix a section")}
              </button>
            </div>

            {api.dirty && (
              <button
                onClick={api.reset}
                className="flex items-center gap-1.5 border-t border-edge-soft/50 px-6 py-2.5 text-[12.5px] font-medium text-ink-subtle transition-colors hover:text-ink"
              >
                <RotateCcw size={13} />
                {api.segments.length > 0 ? t("{n} section fixes. Reset all", { n: api.segments.length }) : t("Reset")}
              </button>
            )}

            <footer className="flex items-center gap-2.5 border-t border-edge-soft/60 px-5 py-4">
              <button
                onClick={onPlayPause}
                className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-elevated text-[14px] font-semibold text-ink ring-1 ring-edge-soft transition-colors hover:bg-raised"
              >
                {playing ? t("Pause") : t("Play")}
              </button>
              <button
                onClick={() => void api.save()}
                disabled={!api.dirty}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-accent px-4 text-[14px] font-semibold text-canvas transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
              >
                <Check size={16} strokeWidth={2.6} />
                {t("Save")}
              </button>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}

function StepBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-11 w-12 items-center justify-center rounded-xl bg-elevated text-[14px] font-semibold tabular-nums text-ink-muted ring-1 ring-edge-soft transition-colors hover:bg-raised hover:text-ink active:scale-95"
    >
      {label}
    </button>
  );
}
