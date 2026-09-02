import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";

const TIMEOUT_SEC = 45;

export function StillWatchingPrompt({
  show,
  nextLabel,
  onContinue,
  onExit,
}: {
  show: string;
  nextLabel?: string;
  onContinue: () => void;
  onExit: () => void;
}) {
  const t = useT();
  const [secs, setSecs] = useState(TIMEOUT_SEC);
  const [entered, setEntered] = useState(false);
  const continueRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    continueRef.current?.focus();
    const raf = window.setTimeout(() => setEntered(true), 20);
    const id = window.setInterval(() => setSecs((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => {
      window.clearTimeout(raf);
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (secs === 0) onExit();
  }, [secs, onExit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        onContinue();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onExit();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onContinue, onExit]);

  return (
    <div
      className="absolute inset-0 z-[130] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal
      style={{ opacity: entered ? 1 : 0, transition: "opacity 240ms ease-out" }}
    >
      <div className="mx-6 flex w-full max-w-md flex-col items-center rounded-xl border border-white/10 bg-neutral-950/80 px-8 py-9 text-center shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]">
        <h2 className="font-display text-[27px] font-medium tracking-tight text-white">
          {t("Still watching?")}
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-white/60">
          {nextLabel ? `${show} · ${nextLabel}` : show}
        </p>
        <div className="mt-7 flex w-full flex-col gap-2.5">
          <button
            ref={continueRef}
            type="button"
            onClick={onContinue}
            className="h-12 rounded-xl bg-white text-[15px] font-semibold text-black outline-none transition-transform duration-150 hover:opacity-95 focus-visible:ring-2 focus-visible:ring-white/70 active:scale-[0.98]"
          >
            {t("Keep watching")}
          </button>
          <button
            type="button"
            onClick={onExit}
            className="h-12 rounded-xl border border-white/15 bg-white/5 text-[15px] font-medium text-white/85 outline-none backdrop-blur transition-colors duration-150 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/40 active:scale-[0.98]"
          >
            {t("Stop ({n})", { n: secs })}
          </button>
        </div>
      </div>
    </div>
  );
}
