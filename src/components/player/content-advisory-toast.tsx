import { EyeOff, Ghost, Heart, Info, MessageSquareWarning, Swords, Wine, X } from "lucide-react";
import { type FocusEvent, useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { ignoreAdvisory } from "@/lib/player/content-advisory-ignore";
import { usePlaybackPositionGated } from "@/lib/player/playback-clock";
import { useSettings } from "@/lib/settings";

export type Advisory = { category: string; severity: string };
export type ContentAdvisoryPosition = "top-start" | "top-end" | "top-center";

const SEV_RANK: Record<string, number> = { None: 0, Mild: 1, Moderate: 2, Severe: 3 };

type SeverityStyle = { text: string };

const SEV_STYLE_COLORED: Record<string, SeverityStyle> = {
  Severe: { text: "text-danger" },
  Moderate: { text: "text-accent" },
  Mild: { text: "text-white/60" },
  None: { text: "text-white/50" },
};

const SEV_STYLE_MONO: Record<string, SeverityStyle> = {
  Severe: { text: "text-white/85" },
  Moderate: { text: "text-white/70" },
  Mild: { text: "text-white/60" },
  None: { text: "text-white/50" },
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

const HOLD_MS = 8_000;
const HOVER_TAIL_MS = 2_500;
const EXIT_MS = 160;
const CARD_CLASS = "w-[280px] max-w-[calc(100vw-3rem)] rounded-[4px] bg-black/70 px-3 py-2.5";

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
  const enabled = preview || settings.contentAdvisoryToast === true;
  const severityStyles =
    settings.contentAdvisoryTheme === "monochrome" ? SEV_STYLE_MONO : SEV_STYLE_COLORED;
  const positionSec = usePlaybackPositionGated(enabled);
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
  const [hasTriggered, setHasTriggered] = useState(preview);
  const durationRef = useRef(HOLD_MS);

  useEffect(() => {
    if (preview) {
      setActive(true);
      setPhase("holding");
      setHasTriggered(true);
      return;
    }

    setActive(false);
    setPhase("idle");
    setPaused(false);
    setHasTriggered(false);
    durationRef.current = HOLD_MS;
  }, [playKey, preview, enabled]);

  useEffect(() => {
    if (!enabled || preview || !playKey || !hasPlaybackStarted || !hasContent || hasTriggered)
      return;
    setHasTriggered(true);
    setActive(true);
    setPhase("holding");
    durationRef.current = HOLD_MS;
  }, [enabled, hasPlaybackStarted, hasContent, hasTriggered, playKey, preview]);

  useEffect(() => {
    if (preview || phase !== "holding" || paused) return;
    const timer = window.setTimeout(() => setPhase("collapsing"), durationRef.current);
    return () => window.clearTimeout(timer);
  }, [paused, phase, preview]);

  useEffect(() => {
    if (preview || phase !== "collapsing") return;
    const timer = window.setTimeout(() => {
      setPhase("done");
      setActive(false);
    }, EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [phase, preview]);

  if (!enabled || !hasContent || !active || !hasPlaybackStarted || phase === "done") return null;

  const isCardExiting = phase === "collapsing";
  const handleInteractionEnd = (stillInteracting = false) => {
    setPaused(stillInteracting);
    if (phase === "holding") {
      durationRef.current = HOVER_TAIL_MS;
    }
  };
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    handleInteractionEnd(event.currentTarget.matches(":hover"));
  };
  const canIgnore = !preview && !!titleId && settings.contentAdvisoryShowIgnore !== false;
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
            from { opacity: 0; transform: translateY(-4px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes harborAdvisoryOut {
            from { opacity: 1; transform: translateY(0); }
            to { opacity: 0; transform: translateY(-2px); }
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
        onMouseLeave={
          preview
            ? undefined
            : (event) => handleInteractionEnd(event.currentTarget.contains(document.activeElement))
        }
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
                  : "harborAdvisoryIn 200ms var(--ease-out) both",
              }
        }
      >
        <div
          className={`flex min-h-5 items-center justify-between gap-2 ${
            rated.length > 0 ? "mb-2" : ""
          }`}
        >
          <span className="min-w-0 text-white/60">
            <span className="text-[11px] font-medium">{t("Content advisory")}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {mpaRating && (
              <span className="text-[11px] font-medium tabular-nums text-white/75">
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
            {rated.map((category) => {
              const { Icon, label } = metaFor(category.category);
              const style = severityStyles[category.severity] ?? severityStyles.Mild;
              return (
                <li
                  key={category.category}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3"
                >
                  <span className="flex min-w-0 items-start gap-2">
                    <Icon
                      size={13}
                      strokeWidth={1.8}
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-white/55"
                    />
                    <span className="text-[12px] leading-[18px] text-white/85">{t(label)}</span>
                  </span>
                  <span className={`text-end text-[11px] leading-[18px] ${style.text}`}>
                    {t(category.severity)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {canIgnore && (
          <div className="mt-2 text-start">
            <button
              type="button"
              onClick={(event) => {
                event.currentTarget.blur();
                handleIgnore();
              }}
              title={t("Never show the content advisory for this title again")}
              className="inline-flex min-h-6 items-center gap-1.5 rounded-sm bg-transparent text-[11px] text-white/60 transition-colors duration-150 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
            >
              <EyeOff size={11} strokeWidth={2.2} aria-hidden="true" className="shrink-0" />
              <span>{t("Ignore this title")}</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
