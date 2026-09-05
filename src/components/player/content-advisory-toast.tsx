import {
  EyeOff,
  Ghost,
  Heart,
  Info,
  MessageSquareWarning,
  ShieldAlert,
  Swords,
  Wine,
  X,
} from "lucide-react";
import { type FocusEvent, useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { ignoreAdvisory } from "@/lib/player/content-advisory-ignore";
import { usePlaybackPosition } from "@/lib/player/playback-clock";
import { useSettings } from "@/lib/settings";

export type Advisory = { category: string; severity: string };
export type ContentAdvisoryPosition = "top-start" | "top-end" | "top-center";

const SEV_RANK: Record<string, number> = { None: 0, Mild: 1, Moderate: 2, Severe: 3 };

type SeverityStyle = { text: string; bar: string };

const SEV_STYLE_COLORED: Record<string, SeverityStyle> = {
  Severe: { text: "text-red-300", bar: "bg-red-400" },
  Moderate: { text: "text-amber-300", bar: "bg-amber-400" },
  Mild: { text: "text-ink-subtle", bar: "bg-ink-subtle/70" },
  None: { text: "text-ink-subtle/70", bar: "bg-ink-subtle/40" },
};

const SEV_STYLE_MONO: Record<string, SeverityStyle> = {
  Severe: { text: "text-ink", bar: "bg-ink" },
  Moderate: { text: "text-ink-muted", bar: "bg-ink-muted" },
  Mild: { text: "text-ink-subtle", bar: "bg-ink-subtle/70" },
  None: { text: "text-ink-subtle/70", bar: "bg-ink-subtle/40" },
};

function metaFor(category: string): { Icon: typeof Info; label: string } {
  const normalized = category.toLowerCase();
  if (normalized.includes("sex") || normalized.includes("nudity")) {
    return { Icon: Heart, label: "Sex & Nudity" };
  }
  if (normalized.includes("violence") || normalized.includes("gore")) {
    return { Icon: Swords, label: "Violence & Gore" };
  }
  if (normalized.includes("profanity") || normalized.includes("language")) {
    return { Icon: MessageSquareWarning, label: "Profanity" };
  }
  if (
    normalized.includes("alcohol") ||
    normalized.includes("drug") ||
    normalized.includes("smoking")
  ) {
    return { Icon: Wine, label: "Alcohol, Drugs & Smoking" };
  }
  if (normalized.includes("frighten") || normalized.includes("intense")) {
    return { Icon: Ghost, label: "Frightening & Intense Scenes" };
  }
  return { Icon: Info, label: category };
}

const HOLD_MS = 10_000;
const HOVER_TAIL_MS = 2_500;
const EXIT_MS = 500;
const CARD_CLASS =
  "w-[266px] overflow-hidden rounded-2xl border border-edge-soft/70 bg-canvas/85 px-4 py-3.5 shadow-[0_18px_50px_-16px_rgba(0,0,0,0.72)] backdrop-blur-xl";

type Phase = "idle" | "holding" | "collapsing" | "done";

export function ContentAdvisoryToast({
  categories,
  playKey,
  titleId,
  mpaRating,
  position = "top-start",
  preview = false,
}: {
  categories: Advisory[];
  playKey: string;
  titleId?: string | null;
  mpaRating?: string | null;
  position?: ContentAdvisoryPosition;
  preview?: boolean;
}) {
  const t = useT();
  const { settings } = useSettings();
  const severityStyles =
    settings.contentAdvisoryTheme === "monochrome" ? SEV_STYLE_MONO : SEV_STYLE_COLORED;
  const positionSec = usePlaybackPosition();
  const hasPlaybackStarted = preview || positionSec > 0.3;
  const rated = useMemo(
    () =>
      (categories ?? [])
        .filter((category) => SEV_RANK[category.severity] !== undefined)
        .sort((a, b) => (SEV_RANK[b.severity] ?? 0) - (SEV_RANK[a.severity] ?? 0)),
    [categories],
  );
  const hasContent = rated.length > 0 || !!mpaRating;
  const [active, setActive] = useState(preview);
  const [phase, setPhase] = useState<Phase>(preview ? "holding" : "idle");
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(1);
  const [hasTriggered, setHasTriggered] = useState(preview);
  const startTimeRef = useRef(0);
  const durationRef = useRef(HOLD_MS);
  const rafRef = useRef(0);

  useEffect(() => {
    if (preview) {
      setActive(true);
      setPhase("holding");
      setProgress(1);
      setHasTriggered(true);
      return;
    }

    setActive(false);
    setPhase("idle");
    setPaused(false);
    setProgress(1);
    setHasTriggered(false);
    startTimeRef.current = 0;
    durationRef.current = HOLD_MS;
    window.cancelAnimationFrame(rafRef.current);
  }, [playKey, preview]);

  useEffect(() => {
    if (preview || !playKey || !hasPlaybackStarted || !hasContent || hasTriggered) return;
    setHasTriggered(true);
    setActive(true);
    setPhase("holding");
    setProgress(1);
    startTimeRef.current = performance.now();
    durationRef.current = HOLD_MS;
  }, [hasPlaybackStarted, hasContent, hasTriggered, playKey, preview]);

  useEffect(() => {
    if (preview || phase !== "holding") return;
    if (paused) {
      window.cancelAnimationFrame(rafRef.current);
      return;
    }

    const tick = () => {
      const elapsed = performance.now() - startTimeRef.current;
      const remaining = Math.max(0, 1 - elapsed / durationRef.current);
      setProgress(remaining);
      if (remaining <= 0) setPhase("collapsing");
      else rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafRef.current);
  }, [paused, phase, preview]);

  useEffect(() => {
    if (preview || phase !== "collapsing") return;
    const timer = window.setTimeout(() => {
      setPhase("done");
      setActive(false);
    }, EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [phase, preview]);

  if (!hasContent || !active || !hasPlaybackStarted || phase === "done") return null;

  const isCardExiting = phase === "collapsing";
  const countdownWidth = Math.max(0, Math.min(1, 1 - progress)) * 100;
  const handleInteractionEnd = () => {
    setPaused(false);
    if (phase === "holding") {
      durationRef.current = HOVER_TAIL_MS;
      startTimeRef.current = performance.now();
    }
  };
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    handleInteractionEnd();
  };
  const canIgnore = !preview && !!titleId;
  const handleIgnore = () => {
    if (titleId) ignoreAdvisory(titleId);
    setPhase("collapsing");
  };
  const positionClass =
    position === "top-end"
      ? "end-6 top-20"
      : position === "top-center"
        ? "start-1/2 top-20 -translate-x-1/2 rtl:translate-x-1/2"
        : "start-6 top-20";

  return (
    <>
      {!preview && (
        <style>{`
          @keyframes harborAdvisoryIn {
            from { opacity: 0; transform: translateY(-6px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes harborAdvisoryOut {
            from { opacity: 1; transform: translateY(0); }
            to { opacity: 0; transform: translateY(-6px); }
          }
          @media (prefers-reduced-motion: reduce) {
            .harbor-content-advisory { animation-duration: 1ms !important; }
          }
        `}</style>
      )}
      <div
        role={preview ? undefined : "status"}
        aria-label={preview ? undefined : t("Content advisory")}
        onMouseEnter={preview ? undefined : () => setPaused(true)}
        onMouseLeave={preview ? undefined : handleInteractionEnd}
        onFocusCapture={preview ? undefined : () => setPaused(true)}
        onBlurCapture={preview ? undefined : handleBlur}
        className={`${
          preview
            ? "relative"
            : `${isCardExiting ? "pointer-events-none" : "pointer-events-auto"} absolute ${positionClass} z-30`
        } harbor-content-advisory ${CARD_CLASS}`}
        style={
          preview
            ? undefined
            : {
                animation: isCardExiting
                  ? `harborAdvisoryOut ${EXIT_MS}ms cubic-bezier(0.22, 1, 0.36, 1) forwards`
                  : "harborAdvisoryIn 500ms cubic-bezier(0.22, 1, 0.36, 1) both",
              }
        }
      >
        <div
          className={`flex min-h-6 items-center justify-between gap-2.5 ${
            rated.length > 0 ? "mb-2.5" : ""
          }`}
        >
          <span className="flex min-w-0 items-center gap-1.5 text-ink-subtle">
            <ShieldAlert size={12} strokeWidth={2.2} className="shrink-0" />
            <span className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] rtl:tracking-normal">
              {t("Content advisory")}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            {mpaRating && (
              <span className="rounded-md bg-raised px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-ink-muted">
                {mpaRating}
              </span>
            )}
            {!preview && (
              <button
                type="button"
                onClick={(event) => {
                  event.currentTarget.blur();
                  setPhase("collapsing");
                }}
                aria-label={t("Dismiss")}
                className="flex h-6 w-6 items-center justify-center rounded-md text-ink-subtle transition-[color,background-color,transform] duration-150 hover:bg-raised hover:text-ink active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink"
              >
                <X size={13} strokeWidth={2} />
              </button>
            )}
          </span>
        </div>

        {rated.length > 0 && (
          <ul className="flex flex-col gap-2">
            {rated.map((category) => {
              const { Icon, label } = metaFor(category.category);
              const style = severityStyles[category.severity] ?? severityStyles.Mild;
              const rank = SEV_RANK[category.severity] ?? 1;
              return (
                <li key={category.category} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon size={14} strokeWidth={2} className={`shrink-0 ${style.text}`} />
                    <span className="truncate text-[12.5px] text-ink">{t(label)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className="flex gap-[3px]" aria-hidden="true">
                      {[1, 2, 3].map((level) => (
                        <span
                          key={level}
                          className={`h-2.5 w-1 rounded-full ${
                            level <= rank ? style.bar : "bg-ink-subtle/25"
                          }`}
                        />
                      ))}
                    </span>
                    <span className={`w-[54px] text-end text-[11px] font-semibold ${style.text}`}>
                      {t(category.severity)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {canIgnore && (
          <div className={rated.length > 0 ? "mt-3 border-t border-edge-soft/70 pt-2.5" : "mt-2.5"}>
            <button
              type="button"
              onClick={(event) => {
                event.currentTarget.blur();
                handleIgnore();
              }}
              title={t("Never show the content advisory for this title again")}
              className="flex w-full items-center justify-center gap-1.5 rounded-md bg-white/[0.06] px-3 py-1.5 text-[11.5px] font-semibold text-ink-muted transition-[color,background-color,transform] duration-150 hover:bg-white/[0.10] hover:text-ink active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink"
            >
              <EyeOff size={12} strokeWidth={2.2} className="shrink-0" />
              {t("Ignore this title")}
            </button>
          </div>
        )}

        {!preview && phase === "holding" && (
          <div
            dir="ltr"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-edge-soft"
          >
            <div
              className="h-full bg-ink-muted"
              style={{
                width: `${countdownWidth}%`,
                transition: paused ? "none" : "width 60ms linear",
              }}
            />
          </div>
        )}
      </div>
    </>
  );
}
