import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { useMemo } from "react";

export function DoneStep() {
  const { settings } = useSettings();
  const t = useT();
  const enabled = useMemo(() => Object.values(settings.streaming).filter(Boolean).length, [settings.streaming]);
  return (
    <div className="flex flex-col items-center gap-6 pt-4 text-center">
      <DoneCheck />

      <div className="flex flex-col gap-3">
        <h1 className="font-display text-[40px] font-medium leading-[1.05] tracking-tight text-ink">
          {t("You're set.")}
        </h1>
        <p className="max-w-md text-[15px] leading-relaxed text-ink-muted">
          {settings.tmdbKey
            ? t("TMDB connected. {n} streaming {services} on. Welcome aboard.", {
                n: enabled,
                services: t(enabled === 1 ? "service" : "services"),
              })
            : t("Running on Cinemeta for now. Add a TMDB key from Settings whenever you're ready.")}
        </p>
      </div>
    </div>
  );
}

function DoneCheck() {
  return (
    <div className="animate-done-pop">
      <svg width="84" height="84" viewBox="0 0 84 84" fill="none">
        <circle
          cx="42"
          cy="42"
          r="36"
          stroke="oklch(0.78 0.17 145)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          className="animate-done-ring"
          transform="rotate(-90 42 42)"
        />
        <path
          d="M27 43 L37.5 53.5 L57 33"
          stroke="oklch(0.82 0.18 145)"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          className="animate-done-check"
        />
      </svg>
    </div>
  );
}
