import { useT } from "@/lib/i18n";
import { SEEK_STEP_OPTIONS, sanitizeSeekStep } from "@/lib/seek-step";
import { useSettings } from "@/lib/settings";
import { RotateCcw, RotateCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Tooltip } from "./tooltip";

export function SeekStepBtn({
  direction,
  seconds: defaultSeconds,
  onSeekStep,
}: {
  direction: "back" | "forward";
  seconds: number;
  onSeekStep: (delta: number) => void;
}) {
  const t = useT();
  const { settings, update } = useSettings();
  const Icon = direction === "back" ? RotateCcw : RotateCw;
  const word = direction === "back" ? t("Back") : t("Forward");
  const seconds = sanitizeSeekStep(
    direction === "back" ? settings.seekBackStepSec : settings.seekForwardStepSec,
    defaultSeconds,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const holdTimerRef = useRef<number | null>(null);
  const claimedRef = useRef(false);

  useEffect(() => {
    if (!pickerOpen) return;
    const onDoc = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setPickerOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPickerOpen(false);
    };
    window.addEventListener("pointerdown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [pickerOpen]);

  const cancelTimer = () => {
    if (holdTimerRef.current != null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if (pickerOpen) return;
    claimedRef.current = false;
    cancelTimer();
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      claimedRef.current = true;
      setPickerOpen(true);
    }, 380);
  };

  const onPointerUp = () => {
    if (claimedRef.current) {
      claimedRef.current = false;
      return;
    }
    if (holdTimerRef.current != null) {
      cancelTimer();
      onSeekStep(direction === "back" ? -seconds : seconds);
    }
  };

  const onPointerLeave = () => {
    cancelTimer();
  };

  const commitChoice = (s: number) => {
    if (direction === "back") update({ seekBackStepSec: s });
    else update({ seekForwardStepSec: s });
    setPickerOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <Tooltip label={t("{word} {n}s · hold for options", { word, n: seconds })}>
        <button
          type="button"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerLeave}
          onPointerCancel={onPointerLeave}
          onContextMenu={(e) => {
            e.preventDefault();
            setPickerOpen(true);
          }}
          aria-label={t("{word} {n} seconds. Hold for options", { word, n: seconds })}
          className={`relative flex h-14 w-14 items-center justify-center rounded-full transition-colors ${
            pickerOpen ? "bg-white/15 text-white" : "text-white/85 hover:bg-white/10 hover:text-white"
          }`}
        >
          <Icon size={32} strokeWidth={1.8} />
          <span className="absolute font-mono text-[10.5px] font-bold tabular-nums leading-none">{seconds}</span>
        </button>
      </Tooltip>
      {pickerOpen && (
        <div className="absolute bottom-[calc(100%+12px)] left-1/2 z-30 -translate-x-1/2 overflow-hidden rounded-2xl border border-edge bg-elevated p-1.5 shadow-[0_24px_60px_-18px_rgba(0,0,0,0.8)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
          <div className="border-b border-edge-soft px-2.5 pb-2 pt-1.5 text-center text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
            {word}
          </div>
          <div className="flex flex-col-reverse gap-1 pt-1.5">
            {SEEK_STEP_OPTIONS.map((s) => {
              const isSel = s === seconds;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => commitChoice(s)}
                  className={`flex h-10 w-12 items-center justify-center rounded-full font-mono text-[12px] font-bold tabular-nums transition-colors ${
                    isSel ? "bg-elevated text-ink ring-1 ring-edge" : "text-ink-muted hover:bg-canvas/55 hover:text-ink"
                  }`}
                  aria-label={t("{word} {n} seconds", { word, n: s })}
                >
                  {s}s
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
