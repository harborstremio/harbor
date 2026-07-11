import { mergeBundledAwards } from "@/lib/awards-history";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { IMG } from "@/lib/providers/tmdb/tmdb-client";
import type { PersonRef } from "@/lib/providers/tmdb/tmdb-people";
import { awardSummary, useAwards } from "@/lib/providers/wikidata";
import { queueToggle, useIsQueued } from "@/lib/queue";
import { useMetaWatched } from "@/lib/watched-flag";
import { openInAppBrowser } from "@/lib/window";
import { isTitleUpcoming } from "@/views/detail/helpers";
import { HeroAwardsCorner } from "@/views/detail/hero-awards";
import { HeroRatings } from "@/views/detail/hero-ratings";
import { UpcomingCta } from "@/views/detail/upcoming-cta";
import { ArrowRight, Loader2, Play } from "lucide-react";
import { Check, Plus } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { PeopleRail, PosterRail, RailSection, RailSkeleton, type Person } from "./rails";
import { useModalRatings } from "./use-modal-ratings";
import { useTitleDetail } from "./use-title-detail";

function isAnimeId(id: string): boolean {
  return id.startsWith("kitsu:") || id.startsWith("mal:") || id.startsWith("anilist:");
}

function posterUrl(poster: string | undefined, fallback: string | undefined): string | undefined {
  if (!poster) return fallback;
  return poster.startsWith("http") ? poster : `${IMG}/w342${poster}`;
}

export function TitlePanel({
  meta,
  tmdbKey,
  onOpenPerson,
  onOpenTitle,
  onOpenDetail,
  onPlay,
  onOpenEpisodes,
  onOpenGenre,
}: {
  meta: Meta;
  tmdbKey: string | null;
  onOpenPerson: (id: number, name: string) => void;
  onOpenTitle: (m: Meta) => void;
  onOpenDetail: (m: Meta) => void;
  onPlay?: (m: Meta) => void;
  onOpenEpisodes?: (m: Meta, imdbId: string | null) => void;
  onOpenGenre?: (name: string, genreId: number, mediaType: "movie" | "tv") => void;
}) {
  const t = useT();
  const { detail, loading, needsKey } = useTitleDetail(meta, tmdbKey, true);
  const [expanded, setExpanded] = useState(false);
  const overviewRef = useRef<HTMLParagraphElement>(null);
  const [overviewClamped, setOverviewClamped] = useState(false);

  const title = detail?.title ?? meta.name ?? "";
  const poster = posterUrl(detail?.poster, meta.poster);
  const overview = detail?.overview?.trim() || meta.description?.trim() || "";
  const year = detail?.year ?? meta.releaseInfo ?? meta.releaseDate?.slice(0, 4) ?? "";
  const rating = detail?.rating ?? meta.imdbRating ?? "";
  const runtime = detail?.runtime ?? meta.runtime ?? "";
  const genres = (detail?.genres?.length ? detail.genres : meta.genres) ?? [];
  const genrePills: Array<{ id: number; name: string }> = detail?.genresRich?.length
    ? detail.genresRich
    : genres.map((name) => ({ id: 0, name }));
  const isSeries = meta.type === "series" || meta.id.startsWith("tmdb:tv:");
  const upcoming = !loading && !isSeries && isTitleUpcoming(detail, meta);
  const anime = isAnimeId(meta.id);
  const titleWatched = useMetaWatched(meta.id, meta.type);
  const queued = useIsQueued(meta);
  const imdbId = detail?.imdbId ?? (meta.id.startsWith("tt") ? meta.id : null);
  const mediaType: "movie" | "show" = isSeries ? "show" : "movie";
  const { scores, mdblist, harborImdb } = useModalRatings(imdbId, mediaType);
  const imdbRating = harborImdb ?? scores?.imdbRating ?? null;
  const primaryRating = anime ? rating : (imdbRating ?? rating);
  const ratingSource: "imdb" | "tmdb" = imdbRating ? "imdb" : "tmdb";
  const tmdbRating = !anime && detail?.rating ? detail.rating : null;

  const liveAwards = useAwards(imdbId ?? undefined);
  const awards = useMemo(
    () => mergeBundledAwards(liveAwards, title, year ? Number(year) : undefined),
    [liveAwards, title, year],
  );
  const awardSummaryItems = awardSummary(awards).slice(0, 3);

  const cast: Person[] = (detail?.cast ?? []).slice(0, 30).map((c) => ({
    id: c.id,
    name: c.name,
    role: c.character,
    profilePath: c.profilePath,
  }));
  const recs = detail?.recommendations?.length ? detail.recommendations : (detail?.similar ?? []);

  const crewGroups: Array<{ label: string; people: PersonRef[] }> = [
    { label: t("Director"), people: detail?.directors ?? [] },
    { label: t("Creator"), people: detail?.creators ?? [] },
    { label: t("Writer"), people: (detail?.writers ?? []).slice(0, 4) },
  ].filter((g) => g.people.length > 0);

  useLayoutEffect(() => {
    const el = overviewRef.current;
    if (!el || expanded) return;
    const measure = () => setOverviewClamped(el.scrollHeight > el.clientHeight + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [overview, expanded]);

  return (
    <div className="flex flex-col gap-7 px-6 pb-8 pt-1 sm:px-8">
      <div className="relative flex gap-5">
        {awardSummaryItems.length > 0 && (
          <div className="pointer-events-none absolute bottom-1 right-0 z-10 hidden max-w-[42%] justify-end md:flex">
            <HeroAwardsCorner summary={awardSummaryItems} inline interactive={false} />
          </div>
        )}
        {poster && (
          <div className="relative h-52 w-36 shrink-0">
            <img
              src={poster}
              alt=""
              className={`h-full w-full rounded-xl object-cover ring-1 ring-white/12 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.8)] ${titleWatched ? "brightness-[0.65]" : ""}`}
            />
            {titleWatched && (
              <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/90 text-black ring-1 ring-black/20">
                <Check size={13} strokeWidth={3.2} />
              </span>
            )}
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <h2 className="text-[30px] font-semibold leading-[1.08] text-white">{title}</h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] font-medium text-white/65">
            {year && <span>{year}</span>}
            {runtime && <span>{runtime}</span>}
          </div>
          <HeroRatings
            bare
            rating={primaryRating}
            tmdbRating={tmdbRating}
            isAnime={anime}
            scores={scores}
            mdblist={mdblist}
            imdbId={imdbId}
            mediaType={mediaType}
            ratingSource={ratingSource}
            onOpenUrl={(url) => openInAppBrowser(url, title)}
          />
          {genrePills.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {genrePills.slice(0, 5).map((g) => (
                <button
                  key={g.name}
                  type="button"
                  onClick={() => g.id > 0 && onOpenGenre?.(g.name, g.id, mediaType === "show" ? "tv" : "movie")}
                  disabled={!onOpenGenre || !tmdbKey || g.id <= 0}
                  className="rounded-full bg-white/[0.08] px-3 py-1.5 text-[13px] font-medium text-white/75 ring-1 ring-white/10 transition-colors enabled:hover:bg-white/[0.16] enabled:hover:text-white disabled:cursor-default"
                >
                  {g.name}
                </button>
              ))}
            </div>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
            {isSeries
              ? onOpenEpisodes && (
                  <button
                    type="button"
                    onClick={() => onOpenEpisodes(meta, imdbId)}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[15px] font-semibold text-black transition-transform hover:scale-[1.03]"
                  >
                    <Play size={17} strokeWidth={2.4} fill="currentColor" />
                    {t("Episodes")}
                  </button>
                )
              : onPlay &&
                (upcoming ? (
                  <UpcomingCta detail={detail} onTry={() => onPlay(meta)} />
                ) : (
                  <button
                    type="button"
                    onClick={() => onPlay(meta)}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[15px] font-semibold text-black transition-transform hover:scale-[1.03]"
                  >
                    <Play size={17} strokeWidth={2.4} fill="currentColor" />
                    {t("Play")}
                  </button>
                ))}
            <button
              type="button"
              onClick={() => onOpenDetail(meta)}
              className="inline-flex w-fit items-center gap-2 rounded-full bg-white/[0.12] px-5 py-2.5 text-[15px] font-semibold text-white ring-1 ring-white/15 transition-colors hover:bg-white/20"
            >
              {isSeries ? t("All episodes & details") : t("Full details")}
              <ArrowRight size={17} strokeWidth={2.4} />
            </button>
            <button
              type="button"
              onClick={() => queueToggle(meta)}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[15px] font-semibold ring-1 transition-colors ${
                queued
                  ? "bg-emerald-400/15 text-emerald-200 ring-emerald-400/30"
                  : "bg-white/[0.12] text-white ring-white/15 hover:bg-white/20"
              }`}
            >
              {queued ? <Check size={17} strokeWidth={2.6} /> : <Plus size={17} strokeWidth={2.4} />}
              {queued ? t("Queued") : t("Queue")}
            </button>
          </div>
        </div>
      </div>

      {overview && (
        <div className="max-w-3xl px-0.5">
          <p
            ref={overviewRef}
            className={`text-[15.5px] leading-relaxed text-white/78 ${expanded ? "" : "line-clamp-3"}`}
          >
            {overview}
          </p>
          {overviewClamped && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-[12.5px] font-semibold text-white/55 transition-colors hover:text-white/90"
            >
              {expanded ? t("Show less") : t("Read more")}
            </button>
          )}
        </div>
      )}

      {crewGroups.length > 0 && (
        <div className="flex flex-col gap-2 px-0.5">
          {crewGroups.map((g) => (
            <div key={g.label} className="flex items-baseline gap-3 text-[13.5px]">
              <span className="w-16 shrink-0 text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/40">
                {g.label}
              </span>
              <span className="flex flex-wrap gap-x-1.5 text-white/85">
                {g.people.map((p, i) => (
                  <span key={`${p.id}-${i}`}>
                    <button
                      type="button"
                      onClick={() => onOpenPerson(p.id, p.name)}
                      disabled={p.id <= 0 || !tmdbKey}
                      className="rounded transition-colors hover:text-white enabled:hover:underline disabled:cursor-default underline-offset-2"
                    >
                      {p.name}
                    </button>
                    {i < g.people.length - 1 && <span className="text-white/35">, </span>}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
      )}

      {loading && cast.length === 0 ? (
        <RailSection label={t("Cast")}>
          <RailSkeleton portrait />
        </RailSection>
      ) : cast.length > 0 ? (
        <RailSection label={t("Cast")} count={detail?.cast.length}>
          <PeopleRail people={cast} onOpen={tmdbKey ? (p) => onOpenPerson(p.id, p.name) : undefined} />
        </RailSection>
      ) : needsKey ? (
        <p className="px-1 text-[13.5px] leading-relaxed text-white/55">
          {t("Add a TMDB key in Settings to see the cast, crew and recommendations for every title.")}
        </p>
      ) : null}

      {loading && recs.length === 0 && !needsKey ? (
        <RailSection label={t("More Like This")}>
          <RailSkeleton />
        </RailSection>
      ) : recs.length > 0 ? (
        <RailSection label={t("More Like This")}>
          <PosterRail items={recs} onOpen={onOpenTitle} />
        </RailSection>
      ) : null}

      {loading && (
        <div className="flex items-center justify-center py-2">
          <Loader2 size={16} className="animate-spin text-white/40" />
        </div>
      )}
    </div>
  );
}
