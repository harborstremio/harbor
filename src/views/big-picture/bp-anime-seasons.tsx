import { useEffect, useMemo, useRef } from "react";
import { Check } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import { formatAirDate } from "@/lib/dates";
import type { KitsuEpisode } from "@/lib/providers/kitsu";
import { useSettings } from "@/lib/settings";
import { SFX } from "@/lib/sfx";
import type { SpoilerMask } from "@/lib/spoilers";
import type { PlayEpisode } from "@/lib/view";
import { BpAnimeSeasonChip } from "./bp-anime-season-chip";
import { BpChip, BpChipDivider } from "./bp-library-chips";
import {
  BpEpisodeRating,
  BpEpisodeStill,
  BpEpisodeStripSkeleton,
  BP_EPISODE_CARD_W,
  BP_EPISODE_STRIP,
  BP_SPOILER_TEXT,
  BP_SPOILER_THUMB,
} from "./bp-episode-still";
import {
  bpTrackHoldsRing,
  BpEpisodeSpacer,
  useBpEpisodeWindow,
  BP_EPISODE_GROW_EDGE,
  BP_EPISODE_GROW_STEP,
} from "./bp-episode-window";
import { useBpT } from "./bp-i18n";
import { bpAnimePlayEpisode, type BpAnimeDetail } from "./use-bp-anime-detail";

const MAX_REACH = 180;

const CHIPS =
  "flex items-center gap-[clamp(6px,0.6vw,12px)] overflow-x-auto px-[var(--bp-gutter)] py-[26px] -my-[26px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

function shortOrderLabel(label: string): string {
  return label.replace(/\s*Order$/i, "");
}

function BpAnimeEpisodeCard({
  ep,
  showSeason,
  nextUp,
  watched,
  ratio,
  spoiler,
  backdrop,
  showRating,
  showSynopsis,
  onPlay,
  onFocus,
}: {
  ep: KitsuEpisode;
  showSeason: boolean;
  nextUp: boolean;
  watched: boolean;
  ratio: number;
  spoiler: SpoilerMask;
  backdrop?: string;
  showRating: boolean;
  showSynopsis: boolean;
  onPlay: (e: PlayEpisode) => void;
  onFocus: () => void;
}) {
  const t = useBpT();
  const epLabel = t("Episode {n}", { n: ep.number });
  const chain = useMemo(
    () => [ep.thumbnail, ep.thumbnailFallback].filter((u): u is string => !!u),
    [ep.thumbnail, ep.thumbnailFallback],
  );
  const tag =
    showSeason && ep.imdbSeason != null && ep.imdbEpisode != null
      ? t("S{s} E{e}", { s: ep.imdbSeason, e: ep.imdbEpisode })
      : epLabel;
  // Absolute order renumbers the whole run, and in that order the absolute
  // number is the one figure a viewer scanning an 1100 episode strip is
  // navigating by. It stays a label and never becomes the season/episode pair
  // the player is handed.
  const facts = [
    ep.absoluteNumber != null && ep.absoluteNumber !== ep.number
      ? t("Abs E{n}", { n: ep.absoluteNumber })
      : "",
    formatAirDate(ep.airdate),
    ep.length ? t("{n} min", { n: ep.length }) : "",
  ].filter(Boolean);
  const rating = showRating && ep.rating != null && ep.rating > 0 ? ep.rating : null;

  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-tile
      data-bp-anime-ep={ep.id}
      data-bp-restore-key={`bp-anime-ep:${ep.id}`}
      onFocus={onFocus}
      onClick={() => {
        SFX.click();
        onPlay(bpAnimePlayEpisode(ep));
      }}
      aria-label={ep.title ? `${epLabel}, ${ep.title}` : epLabel}
      className="group relative flex shrink-0 flex-col overflow-hidden rounded-[var(--bp-r-md)] bg-[var(--bp-panel)] text-start transition-[transform,box-shadow] duration-[var(--bp-dur)] ease-[var(--bp-ease)]"
      style={{ width: BP_EPISODE_CARD_W }}
    >
      <span className="relative block w-full overflow-hidden" style={{ aspectRatio: "16 / 9" }}>
        <span className={`absolute inset-0 block ${spoiler.thumb ? BP_SPOILER_THUMB : ""}`}>
          <BpEpisodeStill chain={chain} label={ep.number} backdrop={backdrop} />
        </span>
        <span className="absolute inset-0 flex items-center justify-center bg-[var(--bp-void)]/55 opacity-0 transition-opacity duration-[var(--bp-dur)] group-data-[bp-focus=true]:opacity-100 motion-reduce:transition-none">
          <Play size={26} className="fill-ink text-ink" strokeWidth={0} />
        </span>
        {nextUp && !watched && (
          <span className="absolute start-2 top-2 rounded-full bg-[color-mix(in_oklab,var(--bp-void)_82%,transparent)] px-[clamp(7px,0.6vw,11px)] py-[3px] text-[clamp(14px,1.9vh,18px)] font-bold uppercase tracking-[0.12em] text-ink">
            {t("Up next")}
          </span>
        )}
        {watched && (
          <span className="absolute end-2 top-2 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--bp-void)_82%,transparent)] text-ink">
            <Check size={17} strokeWidth={3.2} />
          </span>
        )}
        {rating != null && <BpEpisodeRating value={rating} isImdb={!!ep.ratingIsImdb} />}
        {ratio > 0.01 && ratio < 0.97 && (
          <span className="absolute inset-x-0 bottom-0 h-[5px] bg-[var(--bp-void)]/60">
            <span
              className="block h-full bg-[color-mix(in_oklab,var(--color-ink)_72%,transparent)]"
              style={{ width: `${ratio * 100}%` }}
            />
          </span>
        )}
      </span>
      <span className="flex flex-col gap-1 p-[clamp(9px,0.9vw,15px)]">
        <span className="flex items-center gap-[clamp(6px,0.5vw,10px)] text-[clamp(14px,1.9vh,18px)] font-bold uppercase tracking-[0.14em] tabular-nums text-ink-subtle">
          <span className="truncate">{tag}</span>
          {ep.filler && (
            <span className="shrink-0 rounded-full bg-[color-mix(in_oklab,var(--bp-void)_82%,transparent)] px-[6px] py-[1px] tracking-[0.1em] text-ink">
              {t("Filler")}
            </span>
          )}
        </span>
        <span
          className={`line-clamp-1 text-[clamp(18px,2.5vh,24px)] font-semibold text-ink ${
            spoiler.title ? BP_SPOILER_TEXT : ""
          }`}
        >
          {ep.title || epLabel}
        </span>
        {facts.length > 0 && (
          <span className="line-clamp-1 text-[clamp(15px,2.1vh,20px)] font-medium tabular-nums text-ink-subtle">
            {facts.join(" · ")}
          </span>
        )}
        {showSynopsis && ep.synopsis && (
          <span
            className={`line-clamp-2 text-[clamp(15px,2.1vh,20px)] leading-[1.45] text-ink-subtle ${
              spoiler.desc ? BP_SPOILER_TEXT : ""
            }`}
          >
            {ep.synopsis}
          </span>
        )}
      </span>
    </button>
  );
}

// The heading rides on whichever section renders first, and both sections derive
// that from this one expression rather than from a prop, so a caller cannot
// order them wrongly and lose the heading or draw it twice.
function hasSeasonChips(anime: BpAnimeDetail): boolean {
  return anime.seasons.length > 1 || anime.orderTypes.length > 1;
}

function BpEpisodesHeading({ count }: { count: number }) {
  const t = useBpT();
  return (
    <div className="mb-[clamp(6px,0.8vh,12px)] flex flex-wrap items-baseline gap-x-[clamp(9px,1vw,18px)] gap-y-1 px-[var(--bp-gutter)]">
      <h2 className="text-[clamp(20px,2.8vh,28px)] font-bold tracking-[-0.01em] text-ink">
        {t("Episodes")}
      </h2>
      {count > 0 && (
        <span className="text-[clamp(16px,2.2vh,20px)] font-semibold tabular-nums text-ink-subtle">
          {t("{n} episodes", { n: count })}
        </span>
      )}
    </div>
  );
}

export function BpAnimeSeasonChips({ anime }: { anime: BpAnimeDetail }) {
  const t = useBpT();
  if (!hasSeasonChips(anime)) return null;
  const hasSeasons = anime.seasons.length > 1;
  const hasOrders = anime.orderTypes.length > 1;
  // Specials and franchise entries sort to the back behind a divider, the same
  // grouping the desktop picker draws under a "Movies & Specials" caption.
  const ordered = [...anime.seasons].sort((a, b) => Number(!!a.extra) - Number(!!b.extra));
  const seasonNodes = ordered.flatMap((s, i) => {
    const chip = (
      <BpAnimeSeasonChip
        key={s.key}
        item={s}
        selected={s.key === anime.seasonKey}
        onSelect={() => anime.onSeason(s.key)}
      />
    );
    if (i > 0 && s.extra && !ordered[i - 1].extra) {
      return [<BpChipDivider key={`div:${s.key}`} />, chip];
    }
    return [chip];
  });

  return (
    <section data-bp-row data-bp-row-key="episode-filters" className="relative">
      <BpEpisodesHeading count={anime.episodes.length} />
      {/* Seasons and orders share one track on purpose. Splitting them into two
          rows puts another D-pad step between the hero and the episodes. The
          episode strip is a separate row for the opposite reason: two
          data-bp-row sections under one data-bp-rail-row index leave the second
          unreachable, because bpRailStep measures the whole index and lands on
          cells[0]. */}
      <div data-bp-scroll-x className={CHIPS}>
        {hasSeasons && seasonNodes}
        {hasSeasons && hasOrders && <BpChipDivider />}
        {hasOrders && (
          <span className="flex shrink-0 items-center pe-[clamp(2px,0.3vw,6px)] text-[clamp(14px,1.9vh,18px)] font-bold uppercase tracking-[0.14em] text-ink-subtle">
            {t("Order")}
          </span>
        )}
        {hasOrders &&
          anime.orderTypes.map((o) => (
            <BpChip
              key={o.value}
              label={shortOrderLabel(o.label)}
              selected={o.value === anime.orderType}
              restoreKey={`bp-anime-order:${o.value}`}
              onSelect={() => anime.onOrderType(o.value)}
            />
          ))}
      </div>
    </section>
  );
}

export function BpAnimeEpisodeStrip({
  anime,
  onPlay,
}: {
  anime: BpAnimeDetail;
  onPlay: (e: PlayEpisode) => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const parkedRef = useRef("");
  // Read once here, not per card: the strip mounts up to MAX_REACH cards and a
  // settings write would otherwise re-render every one of them.
  const { settings } = useSettings();
  const { episodes, nextUpId, seasonKey } = anime;
  const count = episodes.length;
  const chips = hasSeasonChips(anime);

  useEffect(() => {
    parkedRef.current = "";
  }, [seasonKey]);
  const nextUpAt = nextUpId == null ? -1 : episodes.findIndex((e) => e.id === nextUpId);
  // The window has to reach the next episode or the card the track parks on is
  // not mounted. The desktop refuses the same jump once a grouping is active
  // (anime-episodes.tsx:355) and so does this: TVDB absolute order is one season
  // of 1100 episodes, and every mounted card is another getBoundingClientRect
  // that bp-focus-core runs on every single arrow press.
  const reach = chips || nextUpAt < 0 ? 0 : Math.min(nextUpAt + 12, MAX_REACH);
  const { base, end, grow, anchor } = useBpEpisodeWindow(count, reach, seasonKey);
  const list = base === 0 && end >= count ? episodes : episodes.slice(base, end);
  const backdrop = anime.detail?.backdrop ?? undefined;

  // A thousand episode strip that always opens on episode one is unusable from
  // a couch, so the track parks on the next episode. Focus is never moved: the
  // ring belongs to whoever the engine put it on.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || nextUpId == null) return;
    const stamp = `${seasonKey}:${nextUpId}`;
    if (parkedRef.current === stamp) return;
    if (track.contains(document.activeElement)) return;
    const cell = track.querySelector<HTMLElement>(`[data-bp-anime-ep="${nextUpId}"]`);
    if (!cell) return;
    const t0 = track.getBoundingClientRect();
    const c = cell.getBoundingClientRect();
    // A stale zero-width rect computes a hugely negative offset and throws the
    // strip back to card one.
    if (t0.width < 2 || c.width < 2) return;
    parkedRef.current = stamp;
    track.scrollTo({ left: Math.max(0, track.scrollLeft + (c.left - t0.left) - 24), behavior: "auto" });
  }, [nextUpId, seasonKey, list]);

  return (
    <section data-bp-row data-bp-row-key="episodes" className="relative">
      {!chips && <BpEpisodesHeading count={count} />}
      {count === 0 ? (
        <div className={BP_EPISODE_STRIP} aria-hidden>
          <BpEpisodeStripSkeleton />
        </div>
      ) : (
        <div
          ref={trackRef}
          data-bp-scroll-x
          className={BP_EPISODE_STRIP}
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.scrollWidth - el.scrollLeft - el.clientWidth >= 1200) return;
            if (!bpTrackHoldsRing(el)) anchor(end - 1);
            grow(end + BP_EPISODE_GROW_STEP);
          }}
        >
          <BpEpisodeSpacer count={base} />
          {list.map((ep, i) => {
            const p = anime.progressFor(ep);
            const at = base + i;
            return (
              <BpAnimeEpisodeCard
                key={ep.id}
                ep={ep}
                showSeason={anime.showSeason}
                nextUp={ep.id === nextUpId}
                watched={p.watched}
                ratio={p.ratio}
                spoiler={anime.spoilerFor(ep)}
                backdrop={backdrop}
                showRating={settings.showEpisodeRating}
                showSynopsis={settings.showEpisodeDescription}
                onPlay={onPlay}
                onFocus={() => {
                  anchor(at);
                  if (at >= end - BP_EPISODE_GROW_EDGE) grow(end + BP_EPISODE_GROW_STEP);
                }}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

// A single-slot BpAnimeSeasons wrapper used to live here. It is deleted, not
// deprecated: it put both sections in one div, and a wrapper between a rail row
// and its sections is exactly what bpRailStep cannot navigate, because it
// resolves the rail as row.parentElement and takes the first focusable in the
// index. Down landed on a season chip and the next Down left for index+1, so on
// every multi-season title the episode cards were unreachable by D-pad. Mount
// BpAnimeSeasonChips and BpAnimeEpisodeStrip as two adjacent rail rows.
