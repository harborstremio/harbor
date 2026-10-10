import { Popcorn } from "lucide-react";
import type { ReactNode } from "react";
import { ImdbIcon } from "@/components/icons/imdb-icon";
import { MalLogo } from "@/components/icons/mal-logo";
import { RtBadge } from "@/components/rt-badge";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import type { OmdbScores } from "@/lib/providers/omdb";
import type { MdblistScores } from "@/lib/providers/mdblist";
import { useSimklCommunityRating } from "@/lib/simkl/ratings";
import mdblistLogo from "@/assets/addon-logos/mdblist.png";
import letterboxdLogo from "@/assets/addon-logos/letterboxd.png";
import traktLogo from "@/assets/trakt.svg";
import simklLogo from "@/assets/simkl.png";

function ScoreItem({
  label,
  sublabel,
  onClick,
  compact = false,
  children,
}: {
  label: string;
  sublabel?: string;
  onClick?: () => void;
  compact?: boolean;
  children: ReactNode;
}) {
  const inner = (
    <span
      className={`flex items-center font-semibold text-ink ${
        compact ? "gap-1 px-1.5 py-0.5 text-[11.5px]" : "gap-1.5 px-2.5 py-1 text-[13px]"
      }`}
    >
      {children}
    </span>
  );
  return (
    <HoverTooltip label={label} sublabel={sublabel} side="top" align="center">
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="flex items-center rounded-full transition-colors hover:bg-canvas/90"
        >
          {inner}
        </button>
      ) : (
        inner
      )}
    </HoverTooltip>
  );
}

function Divider() {
  return <span className="h-3.5 w-px bg-edge-soft/60" aria-hidden />;
}

function metacriticBand(value: number): string {
  if (value >= 61) return "bg-emerald-500";
  if (value >= 40) return "bg-amber-500";
  return "bg-red-500";
}

export function HeroRatings({
  rating,
  isAnime,
  scores,
  mdblist,
  imdbId,
  mediaType,
  onOpenUrl,
  ratingSource = "imdb",
  animeImdbRating,
  bare = false,
  compact = false,
  tmdbRating,
}: {
  rating?: string;
  isAnime: boolean;
  scores: OmdbScores | null;
  mdblist: MdblistScores | null;
  imdbId: string | null;
  mediaType: "movie" | "show";
  onOpenUrl: (url: string) => void;
  ratingSource?: "imdb" | "tmdb";
  animeImdbRating?: string | null;
  bare?: boolean;
  compact?: boolean;
  tmdbRating?: string | null;
}) {
  const t = useT();
  const { settings } = useSettings();
  const metacritic = mdblist?.metacritic ?? scores?.metascore ?? null;
  const showPrimary = settings.showDetailRatings;
  const primaryProviderOn = isAnime
    ? settings.showMalDetail
    : ratingSource === "tmdb"
      ? settings.showTmdbDetail
      : settings.showImdbDetail;

  const { rating: simklCommunityRating } = useSimklCommunityRating(imdbId);

  const items: ReactNode[] = [];

  if (rating && showPrimary && primaryProviderOn) {
    items.push(
      <ScoreItem compact={compact}
        key="imdb"
        label={isAnime ? t("MyAnimeList") : ratingSource === "tmdb" ? t("TMDB") : t("IMDb")}
        sublabel={isAnime ? t("Score /10") : t("Rating /10")}
        onClick={
          !isAnime && ratingSource !== "tmdb" && imdbId
            ? () => onOpenUrl(`https://www.imdb.com/title/${imdbId}/`)
            : undefined
        }
      >
        {isAnime ? (
          <MalLogo className="h-[14px] w-auto text-ink-muted" />
        ) : ratingSource === "tmdb" ? (
          <span className="text-[10px] font-bold tracking-tight text-ink-muted">TMDB</span>
        ) : (
          <ImdbIcon className="h-[15px] w-auto rounded-[3px]" />
        )}
        <span>{rating}</span>
      </ScoreItem>,
    );
  }

  if (isAnime && animeImdbRating && showPrimary && settings.showImdbDetail) {
    items.push(
      <ScoreItem compact={compact}
        key="anime-imdb"
        label={t("IMDb")}
        sublabel={t("Rating /10")}
        onClick={imdbId ? () => onOpenUrl(`https://www.imdb.com/title/${imdbId}/`) : undefined}
      >
        <ImdbIcon className="h-[15px] w-auto rounded-[3px]" />
        <span>{animeImdbRating}</span>
      </ScoreItem>,
    );
  }

  if (tmdbRating && showPrimary && settings.showTmdbDetail && ratingSource !== "tmdb" && !isAnime) {
    items.push(
      <ScoreItem compact={compact} key="tmdb" label={t("TMDB")} sublabel={t("Rating /10")}>
        <span className="text-[10px] font-bold tracking-tight text-ink-muted">TMDB</span>
        <span>{tmdbRating}</span>
      </ScoreItem>,
    );
  }

  if (settings.showDetailRatings && settings.showRtDetail && scores?.rtCritics != null) {
    items.push(
      <ScoreItem compact={compact} key="rt-critics" label={t("Rotten Tomatoes Critics")} sublabel={t("Tomatometer")}>
        <RtBadge score={scores.rtCritics} className="h-[16px] w-auto" />
        <span>{scores.rtCritics}%</span>
      </ScoreItem>,
    );
  }

  if (settings.showDetailRatings && settings.showRtAudienceDetail && mdblist?.rtAudience != null) {
    items.push(
      <ScoreItem compact={compact} key="rt-audience" label={t("Rotten Tomatoes Audience")} sublabel={t("Popcornmeter")}>
        <Popcorn
          size={15}
          strokeWidth={2}
          className={mdblist.rtAudience >= 60 ? "text-accent" : "text-ink-subtle"}
        />
        <span>{Math.round(mdblist.rtAudience)}%</span>
      </ScoreItem>,
    );
  }

  if (settings.showDetailRatings && settings.showLetterboxdDetail && mdblist?.letterboxd != null) {
    items.push(
      <ScoreItem compact={compact}
        key="letterboxd"
        label={t("Letterboxd")}
        sublabel={t("Average /5")}
        onClick={imdbId ? () => onOpenUrl(`https://letterboxd.com/imdb/${imdbId}/`) : undefined}
      >
        <img
          src={letterboxdLogo}
          alt=""
          className="h-[14px] w-[14px] rounded-[3px] object-cover"
        />
        <span>{mdblist.letterboxd.toFixed(1)}</span>
      </ScoreItem>,
    );
  }

  if (settings.showDetailRatings && settings.showMetacriticDetail && metacritic != null) {
    items.push(
      <ScoreItem compact={compact} key="metacritic" label={t("Metacritic")} sublabel={t("Metascore")}>
        <span
          className={`flex h-[18px] min-w-[22px] items-center justify-center rounded-sm px-1 text-[11px] font-bold text-canvas ${metacriticBand(metacritic)}`}
        >
          {metacritic}
        </span>
      </ScoreItem>,
    );
  }

  if (settings.showDetailRatings && settings.showTraktDetail && mdblist?.trakt != null) {
    items.push(
      <ScoreItem compact={compact}
        key="trakt"
        label={t("Trakt")}
        onClick={imdbId ? () => onOpenUrl(`https://trakt.tv/search/imdb/${imdbId}`) : undefined}
      >
        <img src={traktLogo} alt="" className="h-[14px] w-[14px] object-contain" />
        <span>{Math.round(mdblist.trakt)}%</span>
      </ScoreItem>,
    );
  }

  const effectiveSimklRating = simklCommunityRating ?? mdblist?.simkl ?? null;

  if (settings.showDetailRatings && settings.showSimklDetail && effectiveSimklRating != null) {
    items.push(
      <ScoreItem compact={compact}
        key="simkl"
        label={t("SIMKL")}
        sublabel={t("Average /10")}
        onClick={imdbId ? () => onOpenUrl(`https://api.simkl.com/redirect?to=simkl&imdb=${imdbId}`) : undefined}
      >
        <img
          src={simklLogo}
          alt=""
          className="h-[14px] w-[14px] rounded-[3px] object-contain"
        />
        <span>{effectiveSimklRating.toFixed(1)}</span>
      </ScoreItem>,
    );
  }

  if (settings.showDetailRatings && settings.showMdblistDetail && mdblist?.score != null) {
    items.push(
      <ScoreItem compact={compact}
        key="mdblist"
        label={t("MDBList")}
        onClick={imdbId ? () => onOpenUrl(`https://mdblist.com/${mediaType}/${imdbId}`) : undefined}
      >
        <img
          src={mdblistLogo}
          alt=""
          className="h-[14px] w-[14px] rounded-[3px] object-contain"
        />
        <span>{Math.round(mdblist.score)}</span>
      </ScoreItem>,
    );
  }

  if (items.length === 0) return null;

  if (bare) {
    return (
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5">
        {items.map((item, i) => (
          <span key={i} className="flex items-center">
            {i > 0 && <Divider />}
            {item}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center rounded-full bg-canvas/80 px-1 py-0.5">
      {items.map((item, i) => (
        <span key={i} className="flex items-center">
          {i > 0 && <Divider />}
          {item}
        </span>
      ))}
    </div>
  );
}
