import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { CONTENT_ADVISORY_NUDGE, useOnboarding } from "@/lib/onboarding";
import { useSettings } from "@/lib/settings";
import type { ContentAdvisoryPosition } from "./content-advisory-toast";

export function ContentAdvisoryPrompt({
  ready,
  position = "top-start",
}: {
  ready: boolean;
  position?: ContentAdvisoryPosition;
}) {
  const t = useT();
  const { settings, update } = useSettings();
  const { isDismissed, dismiss } = useOnboarding();
  const [phase, setPhase] = useState<"idle" | "visible" | "exiting">("idle");
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (isDismissed(CONTENT_ADVISORY_NUDGE)) return;
    if (settings.contentAdvisoryToast) {
      dismiss(CONTENT_ADVISORY_NUDGE);
      return;
    }
    if (!ready) return;
    // Mark the invitation seen, not accepted: leaving playback must not ask again.
    dismiss(CONTENT_ADVISORY_NUDGE);
    setPhase("visible");
  }, [ready, settings.contentAdvisoryToast, isDismissed, dismiss]);

  useEffect(() => {
    if (phase !== "visible" || hovered || focused) return;
    const timer = window.setTimeout(() => setPhase("exiting"), 12_000);
    return () => window.clearTimeout(timer);
  }, [phase, hovered, focused]);

  useEffect(() => {
    if (phase !== "exiting") return;
    const timer = window.setTimeout(() => setPhase("idle"), 160);
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (phase === "idle") return null;
  const positionClass =
    position === "top-end"
      ? "end-6 top-20"
      : position === "top-center"
        ? "start-1/2 top-20 -translate-x-1/2 rtl:translate-x-1/2"
        : "start-6 top-20";
  const exiting = phase === "exiting";

  return (
    <>
      <style>{`
        @keyframes harborAdvisoryPromptIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes harborAdvisoryPromptOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-2px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .harbor-advisory-prompt { animation-duration: 1ms !important; }
        }
      `}</style>
      <div
        role="region"
        aria-label={t("Show content ratings?")}
        className={`harbor-advisory-prompt absolute ${positionClass} z-30 w-[280px] max-w-[calc(100vw-3rem)] rounded-[4px] bg-black/80 p-3 text-white ${exiting ? "pointer-events-none" : "pointer-events-auto"}`}
        style={{
          animation: exiting
            ? "harborAdvisoryPromptOut 160ms var(--ease-out) forwards"
            : "harborAdvisoryPromptIn 200ms var(--ease-out) both",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.stopPropagation();
          (document.activeElement as HTMLElement | null)?.blur();
          setPhase("exiting");
        }}
      >
        <p className="text-[13px] font-medium leading-5">{t("Show content ratings?")}</p>
        <p className="mt-1 text-[12px] leading-[18px] text-white/65">
          {t("Age ratings and content notes when playback starts.")}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={exiting}
            onClick={(event) => {
              event.currentTarget.blur();
              update({ contentAdvisoryToast: true });
              setPhase("exiting");
            }}
            className="min-h-8 rounded-[4px] bg-white/15 px-3 text-[12px] font-medium transition-colors duration-150 hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
          >
            {t("Turn on")}
          </button>
          <button
            type="button"
            disabled={exiting}
            onClick={(event) => {
              event.currentTarget.blur();
              setPhase("exiting");
            }}
            className="min-h-8 rounded-[4px] px-2 text-[12px] text-white/65 transition-colors duration-150 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
          >
            {t("Not now")}
          </button>
        </div>
      </div>
    </>
  );
}
