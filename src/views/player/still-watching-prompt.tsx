import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useT } from "@/lib/i18n";

const DEFAULT_TIMEOUT_SEC = 45;

export function StillWatchingPrompt({
  show,
  nextLabel,
  onContinue,
  onStop,
  timeoutSec = DEFAULT_TIMEOUT_SEC,
}: {
  show: string;
  nextLabel?: string;
  onContinue: () => void;
  onStop: () => void;
  timeoutSec?: number;
}) {
  const t = useT();
  const titleId = useId();
  const descriptionId = useId();
  const continueRef = useRef<HTMLButtonElement>(null);
  const [secondsLeft, setSecondsLeft] = useState(timeoutSec);

  const stop = useCallback(() => {
    onStop();
  }, [onStop]);

  useEffect(() => {
    continueRef.current?.focus();
    const interval = window.setInterval(() => {
      setSecondsLeft((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (secondsLeft === 0) stop();
  }, [secondsLeft, stop]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        onContinue();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        stop();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onContinue, stop]);

  return (
    <div
      className="absolute inset-0 z-[130] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <div className="mx-6 flex w-full max-w-md flex-col items-center rounded-[20px] border border-white/10 bg-neutral-950/90 px-8 py-9 text-center shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]">
        <h2 id={titleId} className="font-display text-[27px] font-medium tracking-tight text-white">
          {t("Still watching?")}
        </h2>
        <p id={descriptionId} className="mt-2 text-[14px] leading-relaxed text-white/60">
          {nextLabel ? `${show} · ${nextLabel}` : show}
        </p>
        <div className="mt-7 flex w-full flex-col gap-2.5">
          <button
            ref={continueRef}
            type="button"
            onClick={onContinue}
            className="h-12 rounded-xl bg-white text-[15px] font-semibold text-black outline-none transition-transform duration-150 hover:opacity-95 focus-visible:ring-2 focus-visible:ring-white/70 active:scale-[0.98]"
          >
            {t("Continue")}
          </button>
          <button
            type="button"
            onClick={stop}
            className="h-12 rounded-xl border border-white/15 bg-white/5 text-[15px] font-medium text-white/85 outline-none backdrop-blur transition-colors duration-150 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/40 active:scale-[0.98]"
          >
            {t("Stop ({n})", { n: secondsLeft })}
          </button>
        </div>
      </div>
    </div>
  );
}
