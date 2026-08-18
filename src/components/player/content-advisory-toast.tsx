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
import { usePlaybackPosition } from "@/lib/player/playback-clock";
import { useT } from "@/lib/i18n";

import { useSettings } from "@/lib/settings";

export type Advisory = { category: string; severity: string };

const SEV_RANK: Record<string, number> = { None: 0, Mild: 1, Moderate: 2, Severe: 3 };

const SEV_STYLE_COLORED: Record<
  string,
  {
    text: string;
    badgeBg: string;
    badgeBorder: string;
    bar: string;
    label: string;
  }
> = {
  Severe: {
    text: "text-rose-400",
    badgeBg: "bg-rose-500/20",
    badgeBorder: "border-rose-500/40",
    bar: "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.7)]",
    label: "Severe",
  },
  Moderate: {
    text: "text-amber-400",
    badgeBg: "bg-amber-500/20",
    badgeBorder: "border-amber-500/40",
    bar: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]",
    label: "Moderate",
  },
  Mild: {
    text: "text-emerald-400",
    badgeBg: "bg-emerald-500/20",
    badgeBorder: "border-emerald-500/40",
    bar: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]",
    label: "Mild",
  },
  None: {
    text: "text-zinc-400",
    badgeBg: "bg-zinc-500/15",
    badgeBorder: "border-zinc-500/30",
    bar: "bg-zinc-600",
    label: "None",
  },
};

const SEV_STYLE_MONO: Record<
  string,
  {
    text: string;
    badgeBg: string;
    badgeBorder: string;
    bar: string;
    label: string;
  }
> = {
  Severe: {
    text: "text-white",
    badgeBg: "bg-white/20",
    badgeBorder: "border-white/40",
    bar: "bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]",
    label: "Severe",
  },
  Moderate: {
    text: "text-white/90",
    badgeBg: "bg-white/15",
    badgeBorder: "border-white/25",
    bar: "bg-white/80 shadow-[0_0_5px_rgba(255,255,255,0.4)]",
    label: "Moderate",
  },
  Mild: {
    text: "text-zinc-300",
    badgeBg: "bg-white/10",
    badgeBorder: "border-white/20",
    bar: "bg-white/60",
    label: "Mild",
  },
  None: {
    text: "text-zinc-400",
    badgeBg: "bg-zinc-500/10",
    badgeBorder: "border-zinc-500/20",
    bar: "bg-zinc-600",
    label: "None",
  },
};

function metaFor(
  category: string,
  isMono = false,
): {
  Icon: typeof Info;
  label: string;
  iconColor: string;
  iconBg: string;
} {
  const c = category.toLowerCase();
  if (c.includes("violence") || c.includes("gore")) {
    return {
      Icon: Swords,
      label: "Violence & Gore",
      iconColor: isMono ? "text-white/90" : "text-rose-400",
      iconBg: isMono ? "bg-white/10" : "bg-rose-500/15",
    };
  }
  if (c.includes("sex") || c.includes("nudity")) {
    return {
      Icon: Heart,
      label: "Sex & Nudity",
      iconColor: isMono ? "text-white/90" : "text-pink-400",
      iconBg: isMono ? "bg-white/10" : "bg-pink-500/15",
    };
  }
  if (c.includes("profanity") || c.includes("language")) {
    return {
      Icon: MessageSquareWarning,
      label: "Profanity",
      iconColor: isMono ? "text-white/90" : "text-amber-400",
      iconBg: isMono ? "bg-white/10" : "bg-amber-500/15",
    };
  }
  if (c.includes("alcohol") || c.includes("drug") || c.includes("smoking")) {
    return {
      Icon: Wine,
      label: "Alcohol, Drugs & Smoking",
      iconColor: isMono ? "text-white/90" : "text-purple-400",
      iconBg: isMono ? "bg-white/10" : "bg-purple-500/15",
    };
  }
  if (c.includes("frighten") || c.includes("intense")) {
    return {
      Icon: Ghost,
      label: "Frightening & Intense Scenes",
      iconColor: isMono ? "text-white/90" : "text-indigo-400",
      iconBg: isMono ? "bg-white/10" : "bg-indigo-500/15",
    };
  }
  return {
    Icon: Info,
    label: category,
    iconColor: isMono ? "text-white/80" : "text-zinc-400",
    iconBg: isMono ? "bg-white/10" : "bg-zinc-500/15",
  };
}

const HOLD_MS = 14000;
const HOVER_TAIL_MS = 3000;
const STEP_ENTER_MS = 380;
const STEP_EXIT_MS = 240;

export function ContentAdvisoryToast({
  categories,
  playKey,
  mpaRating,
}: {
  categories: Advisory[];
  playKey: string;
  mpaRating?: string | null;
}) {
  const t = useT();
  const { settings } = useSettings();
  const isMono = settings.contentAdvisoryTheme === "monochrome";
  const sevStyle = isMono ? SEV_STYLE_MONO : SEV_STYLE_COLORED;

  const positionSec = usePlaybackPosition();
  const hasPlaybackStarted = positionSec > 0.3;

  const rated = useMemo(
    () =>
      (categories ?? [])
        .filter((c) => SEV_RANK[c.severity] !== undefined)
        .sort((a, b) => (SEV_RANK[b.severity] ?? 0) - (SEV_RANK[a.severity] ?? 0)),
    [categories],
  );
  const hasContent = rated.length > 0 || !!mpaRating;

  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState<"idle" | "expanding" | "holding" | "collapsing" | "done">(
    "idle",
  );
  const [visibleCount, setVisibleCount] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [progress, setProgress] = useState(1);
  const [hasTriggered, setHasTriggered] = useState(false);

  const startTimeRef = useRef(0);
  const durationRef = useRef(HOLD_MS);
  const rafRef = useRef(0);
  const stepTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setActive(false);
    setPhase("idle");
    setVisibleCount(0);
    setProgress(1);
    setHasTriggered(false);
    startTimeRef.current = 0;
    if (stepTimerRef.current) window.clearTimeout(stepTimerRef.current);
    window.cancelAnimationFrame(rafRef.current);
  }, [playKey]);

  useEffect(() => {
    if (!hasPlaybackStarted || !hasContent || hasTriggered) return;

    setHasTriggered(true);
    setActive(true);
    setPhase("expanding");
    setVisibleCount(0);
    setProgress(1);
  }, [hasPlaybackStarted, hasContent, hasTriggered]);

  useEffect(() => {
    if (phase !== "expanding") return;

    if (visibleCount < rated.length) {
      stepTimerRef.current = window.setTimeout(() => {
        setVisibleCount((c) => Math.min(rated.length, c + 1));
      }, STEP_ENTER_MS);
    } else {
      setPhase("holding");
      startTimeRef.current = performance.now();
      durationRef.current = HOLD_MS;
    }

    return () => {
      if (stepTimerRef.current) window.clearTimeout(stepTimerRef.current);
    };
  }, [phase, visibleCount, rated.length]);

  useEffect(() => {
    if (phase !== "holding") return;

    if (hovered) {
      window.cancelAnimationFrame(rafRef.current);
      return;
    }

    const tick = () => {
      const elapsed = performance.now() - startTimeRef.current;
      const remaining = Math.max(0, 1 - elapsed / durationRef.current);
      setProgress(remaining);

      if (remaining <= 0) {
        setPhase("collapsing");
      } else {
        rafRef.current = window.requestAnimationFrame(tick);
      }
    };

    rafRef.current = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafRef.current);
  }, [phase, hovered]);

  useEffect(() => {
    if (phase !== "collapsing") return;

    if (visibleCount > 0) {
      stepTimerRef.current = window.setTimeout(() => {
        setVisibleCount((c) => Math.max(0, c - 1));
      }, STEP_EXIT_MS);
    } else {
      stepTimerRef.current = window.setTimeout(() => {
        setPhase("done");
        setActive(false);
      }, 300);
    }

    return () => {
      if (stepTimerRef.current) window.clearTimeout(stepTimerRef.current);
    };
  }, [phase, visibleCount]);

  const handleMouseEnter = () => {
    setHovered(true);
    window.cancelAnimationFrame(rafRef.current);
  };

  const handleMouseLeave = () => {
    setHovered(false);
    if (phase === "holding") {
      durationRef.current = HOVER_TAIL_MS;
      startTimeRef.current = performance.now();
    }
  };

  const handleDismiss = () => {
    setPhase("collapsing");
  };

  if (!hasContent || !active || !hasPlaybackStarted || phase === "done") return null;

  const isCardExiting = phase === "collapsing" && visibleCount === 0;
  const countdownWidth = Math.max(0, Math.min(1, 1 - progress)) * 100;

  return (
    <>
      <style>{`
        @keyframes advBoxAppear {
          0% {
            opacity: 0;
            transform: translateY(-14px) scale(0.95);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes advBoxDisappear {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-12px) scale(0.95);
          }
        }
      `}</style>
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="pointer-events-auto absolute left-7 top-16 z-[999] w-[268px] overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.55)] backdrop-blur-md transition-all duration-400 ease-out"
        style={{
          animation: isCardExiting
            ? "advBoxDisappear 280ms cubic-bezier(0.4, 0, 1, 1) forwards"
            : "advBoxAppear 380ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-white/90">
            <div
              className={`flex h-4.5 w-4.5 items-center justify-center rounded-md ${
                isMono
                  ? "bg-white/15 text-white shadow-none"
                  : "bg-amber-400/20 text-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.25)]"
              }`}
            >
              <ShieldAlert size={11.5} strokeWidth={2.4} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/90">
              {t("Content Advisory")}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {mpaRating && (
              <span className="rounded border border-white/20 bg-white/10 px-1.5 py-0.2 text-[9.5px] font-extrabold tracking-wider text-white shadow-sm">
                {mpaRating}
              </span>
            )}
            <button
              type="button"
              onClick={handleDismiss}
              aria-label={t("Dismiss")}
              className="flex h-4.5 w-4.5 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X size={11} strokeWidth={2.4} />
            </button>
          </div>
        </div>

        {rated.length === 0 && mpaRating ? (
          <div className="flex items-center justify-between gap-2.5 rounded-xl border border-white/[0.05] bg-white/[0.035] px-2 py-1.5">
            <span className="text-[11px] font-medium text-white/80">
              {t("Official age rating")}
            </span>
            <span className="rounded border border-white/25 bg-white/10 px-2 py-0.5 text-[11px] font-extrabold tracking-wider text-white">
              {mpaRating}
            </span>
          </div>
        ) : (
          <ul className="flex flex-col gap-1 transition-all duration-400 ease-out">
            {rated.map((c, index) => {
              const { Icon, label, iconColor, iconBg } = metaFor(c.category, isMono);
              const style = sevStyle[c.severity] ?? sevStyle.Mild;
              const rank = SEV_RANK[c.severity] ?? 1;
              const isItemVisible = index < visibleCount;

              return (
                <li
                  key={c.category}
                  className={`flex items-center justify-between gap-2.5 overflow-hidden rounded-xl border transition-all duration-400 cubic-bezier(0.16,1,0.3,1) ${
                    isItemVisible
                      ? "max-h-10 border-white/[0.05] bg-white/[0.035] px-2 py-1 opacity-100 scale-100 translate-y-0"
                      : "max-h-0 border-transparent bg-transparent px-2 py-0 opacity-0 scale-95 -translate-y-2 pointer-events-none"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg ${iconBg} ${iconColor}`}
                    >
                      <Icon size={11.5} strokeWidth={2.2} />
                    </span>
                    <span className="truncate text-[11px] font-medium text-white/95">
                      {t(label)}
                    </span>
                  </span>

                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className="flex gap-[2px]">
                      {[1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className={`h-2 w-0.5 rounded-full transition-colors ${
                            i <= rank ? style.bar : "bg-white/10"
                          }`}
                        />
                      ))}
                    </span>
                    <span
                      className={`rounded border px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider ${style.text} ${style.badgeBg} ${style.badgeBorder}`}
                    >
                      {t(style.label)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {phase === "holding" && (
          <div
            dir="ltr"
            className="pointer-events-none absolute inset-x-2.5 bottom-[2px] h-[2px] overflow-hidden rounded-full bg-white/20"
            style={{ direction: "ltr" }}
          >
            <div
              className="h-full rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.95)]"
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
