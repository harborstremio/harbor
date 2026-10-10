import { Minus, Moon, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import {
  clearSleepMode,
  setSleepMode,
  useSleepMode,
  useSleepRemainingMs,
} from "@/lib/sleep-timer-store";

const TIME_PRESETS = [
  { label: "30 min", minutes: 30 },
  { label: "1 hr", minutes: 60 },
  { label: "2 hr", minutes: 120 },
  { label: "3 hr", minutes: 180 },
];

function formatRemaining(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function SleepTimerButton() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(2);
  const wrapRef = useRef<HTMLDivElement>(null);
  const mode = useSleepMode();
  const remainingMs = useSleepRemainingMs();
  const active = mode.kind !== "off";

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const statusLine = (() => {
    if (mode.kind === "minutes" && remainingMs != null)
      return t("Pausing in {time}", { time: formatRemaining(remainingMs) });
    if (mode.kind === "end_episode") return t("Pausing when this one ends");
    if (mode.kind === "end_next_episode")
      return t("Pausing after {n} more", { n: mode.remaining });
    return null;
  })();

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t("Sleep timer")}
        title={t("Sleep timer")}
        className={`relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors duration-150 ${
          active
            ? "bg-accent/20 text-accent hover:bg-accent/30"
            : "bg-elevated/70 text-ink-muted hover:bg-elevated hover:text-ink"
        }`}
      >
        <Moon size={18} strokeWidth={2} />
      </button>
      {open && (
        <div className="absolute end-0 top-[calc(100%+8px)] z-50 w-[20rem] overflow-hidden rounded-2xl border border-edge bg-elevated shadow-[0_18px_50px_-15px_rgba(0,0,0,0.7)] animate-popover-in">
          <div className="flex items-center justify-between px-4 pb-2 pt-3">
            <span className="text-[13.5px] font-semibold text-ink">{t("Sleep timer")}</span>
            {active && (
              <button
                onClick={() => clearSleepMode()}
                className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-danger transition-colors hover:text-danger/80"
              >
                {t("Cancel")}
              </button>
            )}
          </div>
          {statusLine && (
            <div className="mx-3 mb-2 rounded-xl bg-accent/10 px-3 py-2 text-[12.5px] font-medium text-accent">
              {statusLine}
            </div>
          )}
          <div className="px-3 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
            {t("Time")}
          </div>
          <div className="grid grid-cols-4 gap-1.5 px-3">
            {TIME_PRESETS.map((p) => {
              const selected = mode.kind === "minutes" && mode.total === p.minutes;
              return (
                <button
                  key={p.minutes}
                  onClick={() => setSleepMode({ kind: "minutes", total: p.minutes, firesAt: 0 })}
                  className={`h-9 rounded-lg text-[12.5px] font-medium transition-colors ${
                    selected
                      ? "bg-raised text-ink ring-1 ring-edge"
                      : "bg-canvas/40 text-ink-muted hover:bg-raised hover:text-ink"
                  }`}
                >
                  {t(p.label)}
                </button>
              );
            })}
          </div>
          <div className="px-3 pb-1 pt-3 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
            {t("Episodes")}
          </div>
          <div className="flex flex-col gap-1.5 px-3 pb-3">
            <button
              onClick={() => setSleepMode({ kind: "end_episode" })}
              className={`h-9 rounded-lg px-3 text-start text-[12.5px] font-medium transition-colors ${
                mode.kind === "end_episode"
                  ? "bg-raised text-ink ring-1 ring-edge"
                  : "bg-canvas/40 text-ink-muted hover:bg-raised hover:text-ink"
              }`}
            >
              {t("After the one playing ends")}
            </button>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setSleepMode({ kind: "end_next_episode", remaining: count })}
                className={`h-9 flex-1 rounded-lg px-3 text-start text-[12.5px] font-medium transition-colors ${
                  mode.kind === "end_next_episode"
                    ? "bg-raised text-ink ring-1 ring-edge"
                    : "bg-canvas/40 text-ink-muted hover:bg-raised hover:text-ink"
                }`}
              >
                {t("After {n} episodes", { n: count })}
              </button>
              <div className="flex items-center gap-0.5 rounded-lg bg-canvas/40 p-0.5">
                <button
                  onClick={() => setCount((c) => Math.max(1, c - 1))}
                  aria-label={t("Fewer episodes")}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
                >
                  <Minus size={13} strokeWidth={2.4} />
                </button>
                <button
                  onClick={() => setCount((c) => Math.min(9, c + 1))}
                  aria-label={t("More episodes")}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
                >
                  <Plus size={13} strokeWidth={2.4} />
                </button>
              </div>
            </div>
            <p className="px-0.5 pt-1 text-[11.5px] leading-snug text-ink-subtle">
              {t("Playback pauses when the timer runs out. Works for movies too: one movie counts as one episode.")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
