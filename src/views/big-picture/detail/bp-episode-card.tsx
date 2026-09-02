import { Check } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import { useSettings } from "@/lib/settings";
import { SFX } from "@/lib/sfx";
import { useBpT } from "../bp-i18n";
import {
  BP_EPISODE_CARD_W,
  BpEpisodeRating,
  BpEpisodeStill,
} from "../bp-episode-still";
import { bpShortDate } from "./bp-detail-chrome";
import type { BpEpisodeFact } from "./use-bp-episode-facts";
import type { BpEp } from "./use-bp-episode-strip";

export function BpEpisodeCard({
  ep,
  stills,
  backdrop,
  fact,
  onPlay,
  watched,
  progress,
  onFocus,
}: {
  ep: BpEp;
  stills: string[];
  backdrop?: string;
  fact?: BpEpisodeFact;
  onPlay: (e: BpEp) => void;
  watched: boolean;
  progress: number;
  onFocus?: () => void;
}) {
  const t = useBpT();
  const { settings } = useSettings();
  const epLabel = t("Episode {n}", { n: ep.label });
  // Only worth the extra glyphs where the mapping actually renumbered the
  // episode, which is the anime case the flat kitsu number reads wrong for.
  const renumbered = ep.group !== ep.season || ep.label !== ep.episode;
  const tag = renumbered ? t("S{s} E{e}", { s: ep.group, e: ep.label }) : epLabel;

  const rating = fact?.rating;
  const runtime = fact?.runtime;
  const aired = bpShortDate(ep.airDate ?? fact?.airDate);
  const overview = ep.overview || fact?.overview || "";
  const facts = [aired, runtime ? t("{n} min", { n: runtime }) : ""].filter(Boolean);

  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-tile
      data-bp-restore-key={`bp-ep:${ep.key}`}
      onFocus={onFocus}
      onClick={() => {
        SFX.click();
        onPlay(stills[0] ? { ...ep, still: stills[0] } : ep);
      }}
      aria-label={ep.name ? `${epLabel}, ${ep.name}` : epLabel}
      className="group relative flex shrink-0 flex-col overflow-hidden rounded-[var(--bp-r-md)] bg-[var(--bp-panel)] text-start transition-[transform,box-shadow] duration-[var(--bp-dur)] ease-[var(--bp-ease)]"
      style={{ width: BP_EPISODE_CARD_W }}
    >
      <span className="relative block w-full overflow-hidden" style={{ aspectRatio: "16 / 9" }}>
        <BpEpisodeStill chain={stills} label={ep.label} backdrop={backdrop} />
        <span className="absolute inset-0 flex items-center justify-center bg-[var(--bp-void)]/55 opacity-0 transition-opacity duration-[var(--bp-dur)] group-data-[bp-focus=true]:opacity-100 motion-reduce:transition-none">
          <Play size={26} className="fill-ink text-ink" strokeWidth={0} />
        </span>
        {watched && (
          <span className="absolute end-2 top-2 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[var(--bp-live)] text-[var(--bp-void)]">
            <Check size={13} strokeWidth={3.2} />
          </span>
        )}
        {rating != null && settings.showEpisodeRating !== false && (
          <BpEpisodeRating value={rating} isImdb={!!fact?.ratingIsImdb} />
        )}
        {progress > 0.01 && progress < 0.97 && (
          <span className="absolute inset-x-0 bottom-0 h-[3px] bg-[var(--bp-void)]/60">
            <span
              className="block h-full bg-[var(--bp-touch)]"
              style={{ width: `${progress * 100}%` }}
            />
          </span>
        )}
      </span>
      <span className="flex flex-col gap-1 p-[clamp(9px,0.9vw,15px)]">
        <span className="text-[clamp(10px,1.25vh,14px)] font-bold uppercase tracking-[0.14em] text-ink-subtle">
          {tag}
        </span>
        <span className="line-clamp-1 text-[clamp(13px,1.8vh,20.5px)] font-semibold text-ink">
          {ep.name || epLabel}
        </span>
        {facts.length > 0 && (
          <span className="line-clamp-1 text-[clamp(10.5px,1.35vh,15px)] font-medium tabular-nums text-ink-subtle">
            {facts.join(" · ")}
          </span>
        )}
        {overview && settings.showEpisodeDescription !== false && (
          <span className="line-clamp-2 text-[clamp(10.5px,1.4vh,15.5px)] leading-[1.45] text-ink-subtle">
            {overview}
          </span>
        )}
      </span>
    </button>
  );
}
