import {
  Ghost,
  Heart,
  Info,
  MessageSquareWarning,
  ShieldAlert,
  Swords,
  Wine,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { usePlaybackPosition } from "@/lib/player/playback-clock";
import { useSettings } from "@/lib/settings";

export type Advisory = { category: string; severity: string };

const SEV_RANK: Record<string, number> = { None: 0, Mild: 1, Moderate: 2, Severe: 3 };

type SeverityStyle = {
  text: string;
  meter: string;
  label: string;
};

const SEV_STYLE_COLORED: Record<string, SeverityStyle> = {
  Severe: {
    text: "text-rose-300",
    meter: "bg-rose-400",
    label: "Severe",
  },
  Moderate: {
    text: "text-amber-300",
    meter: "bg-amber-300",
    label: "Moderate",
  },
  Mild: {
    text: "text-emerald-300",
    meter: "bg-emerald-300",
    label: "Mild",
  },
  None: {
    text: "text-white/45",
    meter: "bg-white/30",
    label: "None",
  },
};

const SEV_STYLE_MONO: Record<string, SeverityStyle> = {
  Severe: {
    text: "text-white",
    meter: "bg-white",
    label: "Severe",
  },
  Moderate: {
    text: "text-white/80",
    meter: "bg-white/80",
    label: "Moderate",
  },
  Mild: {
    text: "text-white/65",
    meter: "bg-white/60",
    label: "Mild",
  },
  None: {
    text: "text-white/45",
    meter: "bg-white/30",
    label: "None",
  },
};

function metaFor(
  category: string,
  isMono: boolean,
): { Icon: typeof Info; label: string; iconColor: string } {
  const c = category.toLowerCase();
  if (c.includes("violence") || c.includes("gore")) {
    return {
      Icon: Swords,
      label: "Violence & Gore",
      iconColor: isMono ? "text-white/70" : "text-rose-300",
    };
  }
  if (c.includes("sex") || c.includes("nudity")) {
    return {
      Icon: Heart,
      label: "Sex & Nudity",
      iconColor: isMono ? "text-white/70" : "text-pink-300",
    };
  }
  if (c.includes("profanity") || c.includes("language")) {
    return {
      Icon: MessageSquareWarning,
      label: "Profanity",
      iconColor: isMono ? "text-white/70" : "text-amber-300",
    };
  }
  if (c.includes("alcohol") || c.includes("drug") || c.includes("smoking")) {
    return {
      Icon: Wine,
      label: "Alcohol, Drugs & Smoking",
      iconColor: isMono ? "text-white/70" : "text-violet-300",
    };
  }
  if (c.includes("frighten") || c.includes("intense")) {
    return {
      Icon: Ghost,
      label: "Frightening & Intense Scenes",
      iconColor: isMono ? "text-white/70" : "text-indigo-300",
    };
  }
  return {
    Icon: Info,
    label: category,
    iconColor: "text-white/60",
  };
}

const HOLD_MS = 14_000;
const HOVER_TAIL_MS = 3_000;

type Phase = "idle" | "holding" | "collapsing" | "done";

export function ContentAdvisoryToast({
  categories,
  playKey,
  mpaRating,
  preview = false,
}: {
  categories: Advisory[];
  playKey: string;
  mpaRating?: string | null;
  preview?: boolean;
}) {
  const t = useT();
  const { settings } = useSettings();
  const isMono = settings.contentAdvisoryTheme === "monochrome";
  const severityStyles = isMono ? SEV_STYLE_MONO : SEV_STYLE_COLORED;
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
  const [hovered, setHovered] = useState(false);
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
    setProgress(1);
    setHasTriggered(false);
    startTimeRef.current = 0;
    window.cancelAnimationFrame(rafRef.current);
  }, [playKey, preview]);

  useEffect(() => {
    if (preview || !hasPlaybackStarted || !hasContent || hasTriggered) return;
    setHasTriggered(true);
    setActive(true);
    setPhase("holding");
    setProgress(1);
    startTimeRef.current = performance.now();
    durationRef.current = HOLD_MS;
  }, [hasPlaybackStarted, hasContent, hasTriggered, preview]);

  useEffect(() => {
    if (preview || phase !== "holding") return;
    if (hovered) {
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
  }, [hovered, phase, preview]);

  useEffect(() => {
    if (preview || phase !== "collapsing") return;
    const timer = window.setTimeout(() => {
      setPhase("done");
      setActive(false);
    }, 160);
    return () => window.clearTimeout(timer);
  }, [phase, preview]);

  if (!hasContent || !active || !hasPlaybackStarted || phase === "done") return null;

  const isCardExiting = phase === "collapsing";
  const countdownWidth = Math.max(0, Math.min(1, 1 - progress)) * 100;
  const handleMouseLeave = () => {
    setHovered(false);
    if (phase === "holding") {
      durationRef.current = HOVER_TAIL_MS;
      startTimeRef.current = performance.now();
    }
  };

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
            to { opacity: 0; transform: translateY(-4px); }
          }
          @media (prefers-reduced-motion: reduce) {
            .harbor-content-advisory { animation-duration: 1ms !important; }
          }
        `}</style>
      )}
      <div
        role="status"
        aria-label={t("Content Advisory")}
        onMouseEnter={preview ? undefined : () => setHovered(true)}
        onMouseLeave={preview ? undefined : handleMouseLeave}
        className={`${
          preview ? "relative" : "pointer-events-auto absolute start-4 top-44 z-50"
        } harbor-content-advisory w-[286px] overflow-hidden rounded-xl bg-black/80 text-white ring-1 ring-inset ring-white/[0.12] backdrop-blur-sm`}
        style={
          preview
            ? undefined
            : {
                animation: isCardExiting
                  ? "harborAdvisoryOut 140ms ease-in forwards"
                  : "harborAdvisoryIn 180ms cubic-bezier(0.16, 1, 0.3, 1) both",
              }
        }
      >
        <div
          className={`flex min-h-10 items-center justify-between gap-3 px-3 ${
            rated.length > 0 ? "border-b border-white/10" : ""
          }`}
        >
          <div className="flex min-w-0 items-center gap-2">
            <ShieldAlert
              size={14}
              strokeWidth={2}
              className={isMono ? "shrink-0 text-white/65" : "shrink-0 text-amber-300"}
            />
            <span className="truncate text-xs font-semibold text-white/90">
              {t("Content Advisory")}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {mpaRating && (
              <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white/90">
                {mpaRating}
              </span>
            )}
            {!preview && (
              <button
                type="button"
                onClick={() => setPhase("collapsing")}
                aria-label={t("Dismiss")}
                className="flex h-6 w-6 items-center justify-center rounded-md text-white/45 transition-colors duration-150 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white/70"
              >
                <X size={13} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>

        {rated.length > 0 && (
          <ul className="divide-y divide-white/[0.08] px-3">
            {rated.map((category) => {
              const { Icon, label, iconColor } = metaFor(category.category, isMono);
              const style = severityStyles[category.severity] ?? severityStyles.Mild;
              const rank = SEV_RANK[category.severity] ?? 1;
              return (
                <li
                  key={category.category}
                  className="flex min-h-9 items-center justify-between gap-3 py-1.5"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon size={13} strokeWidth={1.9} className={`shrink-0 ${iconColor}`} />
                    <span className="truncate text-[11px] font-medium text-white/85">
                      {t(label)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="flex items-center gap-[3px]" aria-hidden="true">
                      {[1, 2, 3].map((level) => (
                        <span
                          key={level}
                          className={`h-1 w-2 rounded-full ${
                            level <= rank ? style.meter : "bg-white/15"
                          }`}
                        />
                      ))}
                    </span>
                    <span className={`w-[50px] text-end text-[10px] font-medium ${style.text}`}>
                      {t(style.label)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {!preview && phase === "holding" && (
          <div
            dir="ltr"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-white/10"
          >
            <div
              className="h-full bg-white/60"
              style={{
                width: `${countdownWidth}%`,
                transition: hovered ? "none" : "width 60ms linear",
              }}
            />
          </div>
        )}
      </div>
    </>
  );
}
