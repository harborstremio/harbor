import { useEffect, useMemo, useSyncExternalStore } from "react";
import { CR_CATEGORY_SHORT, shortCategory } from "@/lib/anime-award-labels";
import { findTopAward, parseAwardYear, type AwardWin } from "@/lib/anime-awards";
import { useAwardMasterVersion } from "@/lib/anime-awards-source";
import { mergeBundledAwards } from "@/lib/awards-history";
import { useBundledAwardsVersion } from "@/lib/use-bundled-awards";
import type { Meta } from "@/lib/cinemeta";
import {
  animeHasDub,
  dubSetReady,
  ensureDubSet,
  subscribeDubSet,
} from "@/lib/providers/anime-dub-sub";
import { useTmdbImdbId } from "@/lib/providers/tmdb";
import { awardSummary, type AwardType } from "@/lib/providers/wikidata";
import { useSettings } from "@/lib/settings";
import { useInWatchlist } from "@/lib/watchlist";
import { bpClassicAwardLabel } from "./bp-award-mark";
import { BpWatchlistMark } from "./bp-card-state-marks";
import { useBpT } from "./bp-i18n";
import { BP_ANIME_ID } from "./use-bp-card-badges";

export const BP_MARK_CHIP =
  "max-w-full shrink-0 truncate rounded-sm bg-[var(--color-ink)] px-[0.68em] py-[0.3em] text-[clamp(9.8px,1.22vh,14px)] font-bold uppercase leading-none tracking-[0.04em] text-[var(--color-canvas)]";

export function bpAwardShortLabel(win: AwardWin, t: (k: string) => string): string {
  const known = CR_CATEGORY_SHORT[win.categoryKey];
  return known ? t(known) : shortCategory(win);
}

export function bpAnimeAward(meta: Meta): AwardWin | null {
  if (!BP_ANIME_ID.test(meta.id)) return null;
  return findTopAward(meta.name ?? "", parseAwardYear(meta.releaseInfo), meta.id);
}

function isInCinema(meta: Meta): boolean {
  return meta.type === "movie" && meta.inTheaters === true;
}

function isRerun(meta: Meta): boolean {
  if (meta.type !== "movie" || !meta.releaseDate) return false;
  const released = Date.parse(meta.releaseDate);
  if (Number.isNaN(released)) return false;
  return (Date.now() - released) / (1000 * 60 * 60 * 24 * 30.44) > 9;
}

function useDub(metaId: string, isAnime: boolean): boolean {
  const { settings } = useSettings();
  const want = settings.showDubBadge && isAnime;
  const ready = useSyncExternalStore(subscribeDubSet, dubSetReady);
  useEffect(() => {
    if (want) ensureDubSet();
  }, [want]);
  return want && ready && animeHasDub(metaId);
}

// Bundled awards only. useClassicAwardWin runs two Wikidata SPARQL queries per
// imdb id, and a Big Picture page holds hundreds of tiles, so the live lookup
// stays on the detail page and the hero where it is one title at a time.
function useClassicMark(meta: Meta, enabled: boolean): { type: AwardType; wins: number } | null {
  const year = parseAwardYear(meta.releaseInfo);
  // Subscribed even when disabled would put every tile on the home screen into
  // the store's listener set, so one arrival re-rendered all of them at once.
  // useSyncExternalStore cannot be called conditionally, so the gate is in the
  // subscribe: a disabled tile registers nothing and is never woken.
  const awardsV = useBundledAwardsVersion(enabled);
  return useMemo(() => {
    if (!enabled) return null;
    const won = awardSummary(mergeBundledAwards(null, meta.name, year)).find((s) => s.wins > 0);
    return won ? { type: won.type, wins: won.wins } : null;
  }, [awardsV, enabled, meta.name, year]);
}

/**
 * The top-start column: what this title IS. Availability, recency and prizes,
 * every one of them art or type, never a bare dark rectangle.
 *
 * Self-anchored, because BpTile takes it as `corner ?? <BpCardMarks/>` and the
 * anime rows still pass their own corner. A corner override therefore replaces
 * this whole column, which is why the watchlistBadge topStart position is
 * resolved in here rather than handed down: passed in from BpTile it was lost on
 * every anime tile, since BpCardStateMarks only places the other three corners.
 */
export function BpCardMarks({ meta }: { meta: Meta }) {
  const { settings } = useSettings();
  const t = useBpT();
  useAwardMasterVersion();
  const isAnime = BP_ANIME_ID.test(meta.id);
  const hasDub = useDub(meta.id, isAnime);
  // Same alternate-id match the other four positions get from useBpCardState. A
  // watchlist entry is often stored under the imdb id while the tile carries a
  // tmdb one. useTmdbImdbId is a cache read and a subscription, never a fetch.
  const wantBookmark = settings.watchlistBadge === "topStart";
  const altImdb = useTmdbImdbId(wantBookmark ? meta.id : undefined);
  const altIds = useMemo(() => [altImdb], [altImdb]);
  const bookmark = useInWatchlist(wantBookmark ? meta.id : undefined, altIds);

  const marks = settings.showCardBadges;
  const cinema = isInCinema(meta);
  const rerun = marks && cinema && isRerun(meta);
  const showCinema = marks && cinema && !rerun;
  const isNew =
    marks &&
    !cinema &&
    !!meta.releaseInfo &&
    meta.releaseInfo === String(new Date().getFullYear());

  const animeWin = marks && isAnime ? bpAnimeAward(meta) : null;
  const classic = useClassicMark(meta, marks && !isAnime);

  const badge = animeWin
    ? `${animeWin.year} ${bpAwardShortLabel(animeWin, t)}`
    : classic
      ? bpClassicAwardLabel(classic.type, classic.wins, t)
      : hasDub
        ? t("DUB")
        : isNew
          ? t("New")
          : rerun
            ? `${t("Rerun")}${meta.releaseInfo ? ` · ${meta.releaseInfo}` : ""}`
            : showCinema
              ? t("In Cinema")
              : "";

  if (!badge && !bookmark) return null;

  return (
    <span className="pointer-events-none absolute start-[7px] top-[7px] flex max-w-[calc(100%-56px)] flex-col items-start gap-[5px]">
      {/* Same plate as every other mark in this column, and it carries the count.
          A bare gold statuette with no plate was the one element on the tile
          relying only on its own drop shadow, which is exactly what disappears
          over bright key art, and an unlabelled mark made a three-Oscar film and
          a one-win indie identical where desktop distinguishes them. */}
      {badge && <span className={BP_MARK_CHIP}>{badge}</span>}
      {bookmark && <BpWatchlistMark />}
    </span>
  );
}
