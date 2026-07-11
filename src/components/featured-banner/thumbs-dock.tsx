import type { Meta } from "@/lib/cinemeta";
import { trackEvent } from "@/lib/discover/store";
import { getVote, setVote, subscribePrefs, type FeedVote } from "@/lib/feed/preferences";
import { useT } from "@/lib/i18n";
import { useOnboarding } from "@/lib/onboarding";
import { Tooltip } from "@/views/detail/tooltip";
import { ThumbsDown, ThumbsUp, X } from "lucide-react";
import { useEffect, useState } from "react";

function profileFromMeta(meta: Meta) {
  const year = meta.releaseInfo ? parseInt(meta.releaseInfo.slice(0, 4), 10) : NaN;
  const decade = Number.isFinite(year) ? `${Math.floor(year / 10) * 10}s` : undefined;
  return {
    cast: [],
    directors: [],
    creators: [],
    genres: meta.genres ?? [],
    keywords: [],
    decade,
  };
}

export function ThumbsDock({ meta }: { meta: Meta }) {
  const t = useT();
  const metaId = meta.id;
  const [vote, setVoteState] = useState<FeedVote | null>(() => getVote(metaId));
  const { isDismissed, dismiss } = useOnboarding();
  const showHint = !isDismissed("featured-thumbs");
  useEffect(() => {
    setVoteState(getVote(metaId));
    return subscribePrefs(() => setVoteState(getVote(metaId)));
  }, [metaId]);
  const cast = (v: FeedVote) => {
    const next = vote === v ? null : v;
    setVote(metaId, next);
    if (next === "up") trackEvent(metaId, "vote_up", profileFromMeta(meta));
    else if (next === "down") trackEvent(metaId, "vote_down", profileFromMeta(meta));
    if (showHint) dismiss("featured-thumbs");
  };
  return (
    <div className="absolute bottom-6 end-6 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <Tooltip label={t("Show me less like this")}>
        <ThumbButton
          active={vote === "down"}
          accent="negative"
          ariaLabel={t("Show me less like this")}
          onClick={(e) => {
            e.stopPropagation();
            cast("down");
          }}
        >
          <ThumbsDown size={16} />
        </ThumbButton>
      </Tooltip>
      <div className="relative inline-flex">
        <Tooltip label={t("Show me more like this")}>
          <ThumbButton
            active={vote === "up"}
            accent="positive"
            ariaLabel={t("Show me more like this")}
            onClick={(e) => {
              e.stopPropagation();
              cast("up");
            }}
          >
            <ThumbsUp size={16} />
          </ThumbButton>
        </Tooltip>
        {showHint && <ThumbsHint onDismiss={() => dismiss("featured-thumbs")} />}
      </div>
    </div>
  );
}

function ThumbsHint({ onDismiss }: { onDismiss: () => void }) {
  const t = useT();
  return (
    <div className="pointer-events-none absolute bottom-full end-0 z-30 mb-3 flex w-[300px] justify-end">
      <div className="pointer-events-auto animate-nudge-in relative flex w-full items-start gap-3 rounded-2xl border border-edge-soft bg-elevated/95 px-4 py-3.5 backdrop-blur-md shadow-[0_18px_50px_-20px_rgba(0,0,0,0.65)]">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="text-[13px] font-semibold text-ink">{t("Tune your recommendations")}</p>
          <p className="text-[12px] leading-snug text-ink-subtle">
            {t("Thumbs down hides this title from Featured. Thumbs up helps surface similar picks.")}
          </p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          aria-label={t("Dismiss")}
          className="-me-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
        >
          <X size={13} />
        </button>
        <div className="absolute bottom-0 end-6 -mb-1.5 h-3 w-3 rotate-45 border-b border-e border-edge-soft bg-elevated/95" />
      </div>
    </div>
  );
}

function ThumbButton({
  active,
  accent,
  ariaLabel,
  onClick,
  children,
}: {
  active: boolean;
  accent: "positive" | "negative";
  ariaLabel: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  const activeClass =
    accent === "positive"
      ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-300"
      : "border-rose-400/60 bg-rose-400/15 text-rose-300";
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={`flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-md transition-all duration-200 ${
        active ? activeClass : "border-edge-soft/70 bg-canvas/55 text-ink/85 hover:bg-canvas/80 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
