import { useEffect, useRef } from "react";
import { useT } from "@/lib/i18n";

const PITCH = 32;

function useStripePan(stepped: boolean) {
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const anim = el.animate(
      [{ transform: "translateX(0px)" }, { transform: `translateX(-${PITCH}px)` }],
      {
        duration: 1400,
        iterations: Infinity,
        easing: stepped ? "steps(4, end)" : "linear",
      },
    );
    return () => anim.cancel();
  }, [stepped]);
  return ref;
}

function Lane({ stepped, label, live }: { stepped: boolean; label: string; live: boolean }) {
  const ref = useStripePan(stepped);
  return (
    <span className="flex min-w-[190px] flex-1 flex-col gap-2">
      <span className="flex items-center gap-2 text-[15.5px] font-medium leading-[22px]">
        <span className={`h-2 w-2 shrink-0 rounded-full ${live ? "bg-accent" : "bg-edge"}`} />
        <span className={live ? "text-ink" : "text-ink-muted"}>{label}</span>
      </span>
      <span className="relative block h-12 overflow-hidden rounded-[10px] bg-canvas">
        <span
          ref={ref}
          aria-hidden
          className={`absolute inset-y-0 -start-16 -end-16 ${
            live ? "text-ink" : "text-ink-subtle"
          }`}
          style={{
            backgroundImage: `repeating-linear-gradient(90deg, currentColor 0 7px, transparent 7px ${PITCH}px)`,
          }}
        />
      </span>
    </span>
  );
}

export function MotionCompare({ smoothed }: { smoothed: boolean }) {
  const t = useT();
  return (
    <span className="flex w-full flex-wrap items-end gap-x-4 gap-y-3">
      <Lane stepped label={t("Smoothing off")} live={!smoothed} />
      <Lane stepped={false} label={t("Smoothing on")} live={smoothed} />
    </span>
  );
}
