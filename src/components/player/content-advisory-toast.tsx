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
  Severe: { text: "text-danger", bar: "bg-danger" },
  Moderate: { text: "text-accent", bar: "bg-accent" },
  Mild: { text: "text-white/45", bar: "bg-white/45" },
  None: { text: "text-white/35", bar: "bg-white/30" },
};

const SEV_STYLE_MONO: Record<string, SeverityStyle> = {
  Severe: { text: "text-white/90 font-bold", bar: "bg-white/90" },
  Moderate: { text: "text-white/65 font-medium", bar: "bg-white/65" },
  Mild: { text: "text-white/45 font-medium", bar: "bg-white/45" },
  None: { text: "text-white/35", bar: "bg-white/30" },
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

const HOLD_MS = 28_000;
const HOVER_TAIL_MS = 2_500;
const EXIT_MS = 500;
const CARD_CLASS =
  "w-[238px] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-xl border border-white/10 bg-black/70 px-3 py-2.5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.85)] backdrop-blur-xl";

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
        .filter(
          (category) => SEV_RANK[category.severity] !== undefined && category.severity !== "None",
        )
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
  const handleInteractionEnd = () => {
    setPaused(false);
    if (phase === "holding") {
      durationRef.current = HOVER_TAIL_MS;
      startTimeRef.current = performance.now();
      setProgress(1);
    }
  };
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    handleInteractionEnd();
  };
  const canIgnore = !preview && !!titleId && settings.contentAdvisoryShowIgnore !== false;
  const handleIgnore = () => {
    if (titleId) ignoreAdvisory(titleId);
    setPhase("collapsing");
  };
  const countdownWidth = Math.max(0, Math.min(100, progress * 100));
  void countdownWidth;
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
            0% { opacity: 0; transform: translateY(-10px) scale(0.965); }
            60% { opacity: 1; }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes harborAdvisoryOut {
            0% { opacity: 1; transform: translateY(0) scale(1); }
            100% { opacity: 0; transform: translateY(-8px) scale(0.98); }
          }
          @keyframes harborAdvisoryRow {
            0% { opacity: 0; transform: translateY(5px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          .harbor-content-advisory-row {
            animation: harborAdvisoryRow 260ms var(--ease-out) both;
          }
          @media (prefers-reduced-motion: reduce) {
            .harbor-content-advisory,
            .harbor-content-advisory-row { animation-duration: 1ms !important; }
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
                  ? `harborAdvisoryOut ${EXIT_MS}ms var(--ease-out) forwards`
                  : "harborAdvisoryIn 420ms var(--ease-out) both",
              }
        }
      >
        <div
          className={`flex min-h-5 items-center justify-between gap-2 ${
            rated.length > 0 ? "mb-2" : ""
          }`}
        >
          <span className="flex min-w-0 items-center gap-1.5 text-white/50">
            <ShieldAlert size={11.5} strokeWidth={2.2} className="shrink-0" />
            <span className="truncate text-[9.5px] font-semibold uppercase tracking-[0.16em] rtl:tracking-normal">
              {t("Content advisory")}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {mpaRating && (
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold tabular-nums text-white/80">
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
                className="flex h-5 w-5 items-center justify-center rounded text-white/45 transition-[color,background-color,transform] duration-150 hover:bg-white/10 hover:text-white active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white/60"
              >
                <X size={12} strokeWidth={2} />
              </button>
            )}
          </span>
        </div>

        {rated.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {rated.map((category, index) => {
              const { Icon, label } = metaFor(category.category);
              const style = severityStyles[category.severity] ?? severityStyles.Mild;
              const rank = SEV_RANK[category.severity] ?? 1;
              return (
                <li
                  key={category.category}
                  className={`flex items-center justify-between gap-2 ${
                    preview ? "" : "harbor-content-advisory-row"
                  }`}
                  style={preview ? undefined : { animationDelay: `${110 + index * 50}ms` }}
                >
                  <span className="flex min-w-0 items-center gap-1.5" title={t(label)}>
                    <Icon size={13} strokeWidth={2} className={`shrink-0 ${style.text}`} />
                    <span className="truncate text-[11.5px] text-white/90">{t(label)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className="flex gap-[2.5px]" aria-hidden="true">
                      {[1, 2, 3].map((level) => (
                        <span
                          key={level}
                          className={`h-2.5 w-1 rounded-full ${
                            level <= rank ? style.bar : "bg-white/10"
                          }`}
                        />
                      ))}
                    </span>
                    <span className={`w-[46px] text-end text-[10px] font-semibold ${style.text}`}>
                      {t(category.severity)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {canIgnore && (
          <div
            className={
              rated.length > 0
                ? "mt-2 border-t border-white/10 pt-1.5 text-center"
                : "mt-1.5 text-center"
            }
          >
            <button
              type="button"
              onClick={(event) => {
                event.currentTarget.blur();
                handleIgnore();
              }}
              title={t("Never show the content advisory for this title again")}
              className="group inline-flex items-center justify-center gap-1.5 border-0 bg-transparent p-0 text-[10.5px] font-medium text-white/50 transition-all duration-200 hover:text-white focus-visible:outline-none"
            >
              <EyeOff
                size={11}
                strokeWidth={2.2}
                className="shrink-0 transition-all duration-200 group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.9)]"
              />
              <span className="transition-all duration-200 group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.9)]">
                {t("Ignore this title")}
              </span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
