import { useT } from "@/lib/i18n";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

export function Stepper({ onPrev, onNext }: { onPrev: () => void; onNext: () => void }) {
  const t = useT();
  return (
    <div className="flex items-center gap-2">
      <HoldStepButton onStep={onPrev} ariaLabel={t("Previous featured")}>
        <ChevronLeft size={20} className="dir-icon" />
      </HoldStepButton>
      <HoldStepButton onStep={onNext} ariaLabel={t("Next featured")}>
        <ChevronRight size={20} className="dir-icon" />
      </HoldStepButton>
    </div>
  );
}

function HoldStepButton({
  onStep,
  ariaLabel,
  children,
}: {
  onStep: () => void;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  const stepRef = useRef(onStep);
  stepRef.current = onStep;
  const timer = useRef<number | null>(null);
  const interval = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (interval.current != null) {
      window.clearInterval(interval.current);
      interval.current = null;
    }
  }, []);

  const start = useCallback(() => {
    stop();
    stepRef.current();
    timer.current = window.setTimeout(() => {
      interval.current = window.setInterval(() => stepRef.current(), 220);
    }, 380);
  }, [stop]);

  useEffect(() => stop, [stop]);

  return (
    <button
      type="button"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        start();
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      aria-label={ariaLabel}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-edge-soft text-ink-muted transition-colors duration-200 hover:bg-elevated hover:text-ink"
    >
      {children}
    </button>
  );
}

export function Dots({ count, active, onJump }: { count: number; active: number; onJump: (i: number) => void }) {
  const t = useT();
  return (
    <div className="flex justify-center gap-1.5">
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onJump(i)}
          aria-label={t("Featured {n}", { n: i + 1 })}
          className={`h-1.5 rounded-full transition-all duration-200 ${
            i === active ? "w-7 bg-ink" : "w-1.5 bg-ink-subtle/40 hover:bg-ink-muted"
          }`}
        />
      ))}
    </div>
  );
}
