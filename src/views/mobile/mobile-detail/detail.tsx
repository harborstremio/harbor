import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Meta } from "@/lib/cinemeta";
import { awardSummary, pickHeroAwards, useAwards } from "@/lib/providers/wikidata";
import { mergeBundledAwards } from "@/lib/awards-history";
import { useSettings } from "@/lib/settings";
import { useHideAnimeMetas } from "@/lib/anime-hide";
import { useMobileRemote } from "../mobile-remote";
import {
  DETAIL_CSS,
  firstEpisode,
  prefersReducedMotion,
  seasonList,
  useCinemetaFull,
  useTmdbDetail,
} from "./data";
import { Hero } from "./hero";
import { DetailActions } from "./actions";
import { Line, Overview } from "./ui";
import { EpisodeSection } from "./episodes";
import { CastRow, CastSkeleton, CrewSection } from "./cast";
import { RecRail } from "./recommendations";
import { AwardsSection } from "./awards";
import { dedupeCharacters, dedupeMeta, dedupeRelated, isAnimeId, useAnimeDetail } from "./anime-data";
import {
  AnimeInfo,
  AnimeRelatedRow,
  AnimeStats,
  AnimeTitles,
  CharactersRow,
  hasAnimeTitles,
  relatedToMeta,
} from "./anime";
import { useAnimeAnilistDetails } from "@/views/detail/use-anime-anilist-details";
import { useAnimeCharacters } from "@/views/detail/use-anime-characters";
import { useMalRating } from "@/lib/mal-rating";
import { usePreferredMeta } from "@/lib/use-preferred-meta";
import { mergePreferredMeta } from "@/lib/preferred-meta";

export function MobileDetail({ meta, onClose }: { meta: Meta; onClose: () => void }) {
  const [reduced] = useState(prefersReducedMotion);
  const [closing, setClosing] = useState(false);
  const [stack, setStack] = useState<Meta[]>([meta]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStack([meta]);
  }, [meta.id]);

  const current = stack[stack.length - 1] ?? meta;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [current.id]);

  const close = useCallback(() => {
    if (reduced) onClose();
    else setClosing(true);
  }, [reduced, onClose]);

  const back = useCallback(() => {
    if (stack.length > 1) setStack((s) => s.slice(0, -1));
    else close();
  }, [stack.length, close]);

  const openMeta = useCallback((m: Meta) => {
    setStack((s) => (s[s.length - 1]?.id === m.id ? s : [...s, m]));
  }, []);

  const node = (
    <div
      ref={scrollRef}
      role="dialog"
      aria-modal="true"
      aria-label={current.name}
      onAnimationEnd={(e) => {
        if (closing && e.target === e.currentTarget) onClose();
      }}
      className={`fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-canvas ${
        closing ? "md-detail-out" : "md-detail-in"
      }`}
    >
      <style>{DETAIL_CSS}</style>
      <DetailBody key={current.id} meta={current} onBack={back} onOpenMeta={openMeta} />
    </div>
  );

  return typeof document !== "undefined" ? createPortal(node, document.body) : node;
}

function DetailBody({
  meta,
  onBack,
  onOpenMeta,
}: {
  meta: Meta;
  onBack: () => void;
  onOpenMeta: (m: Meta) => void;
}) {
  const { settings } = useSettings();
  const preferredMeta = usePreferredMeta(meta);
  const { playOnHost, openOnHost } = useMobileRemote();
  const key = settings.tmdbKey;
  const isAnime = isAnimeId(meta.id);
  const full = useCinemetaFull(meta);
  const displayMeta = useMemo(() => mergePreferredMeta(meta, preferredMeta), [meta, preferredMeta]);
  const displayFull = useMemo(
    () => mergePreferredMeta(full ?? meta, preferredMeta),
    [full, meta, preferredMeta],
  );
  const tmdb = useTmdbDetail(meta, key);
  const anime = useAnimeDetail(meta, isAnime);
  const detail = isAnime ? anime.detail : tmdb.detail;
  const loading = isAnime ? anime.loading : tmdb.loading;

  const anilist = useAnimeAnilistDetails(anime.canonicalId, isAnime);
  const animeCharacters = useAnimeCharacters(anime.canonicalId, isAnime);
  const malRating = useMalRating(
    isAnime
      ? { ...meta, id: anime.canonicalId ?? meta.id, imdbRating: detail?.rating ?? meta.imdbRating }
      : undefined,
  );

  const handlePerson = useCallback(
    (id: number, name: string) => openOnHost({ id: `person:${id}`, type: "movie", name } as Meta),
    [openOnHost],
  );

  const isSeries = !isAnime && (detail?.kind === "tv" || meta.type === "series");
  const title = preferredMeta?.name || detail?.title || meta.name;
  const logo = detail?.logo || meta.logo;
  const backdrop = detail?.backdrop || full?.background || meta.background || meta.poster;
  const year = (detail?.year || meta.releaseInfo || "").slice(0, 4);
  const imdbRating = meta.imdbRating || full?.imdbRating;
  const rating = isAnime ? malRating : imdbRating || detail?.rating;
  const runtime = detail?.runtime;
  const genres = (detail?.genres?.length ? detail.genres : meta.genres) ?? [];
  const overview =
    preferredMeta?.description || detail?.overview || full?.description || meta.description || "";

  const imdbId = detail?.imdbId ?? (meta.id.startsWith("tt") ? meta.id : null);
  const releaseYear = Number(year) || undefined;
  const liveAwards = useAwards(imdbId ?? undefined, isSeries);
  const awards = useMemo(
    () => mergeBundledAwards(liveAwards, meta.name, releaseYear),
    [liveAwards, meta.name, releaseYear],
  );
  const awardGroups = useMemo(() => awardSummary(awards), [awards]);
  const heroAwardSummary = useMemo(() => pickHeroAwards(awardGroups), [awardGroups]);

  const seasons = useMemo(() => seasonList(displayFull, detail), [displayFull, detail]);
  const first = useMemo(() => firstEpisode(displayFull, seasons), [displayFull, seasons]);
  const trailerId = detail?.trailerCandidates?.[0] ?? meta.trailerStreams?.[0]?.ytId ?? null;

  const { recItems, simItems } = useMemo(() => {
    if (!detail) return { recItems: [] as Meta[], simItems: [] as Meta[] };
    if (!isAnime) return { recItems: detail.recommendations, simItems: detail.similar };
    const seenIds = new Set<string>([meta.id]);
    const seenNames = new Set<string>([meta.name.trim().toLowerCase()]);
    const recItems = dedupeMeta(detail.recommendations, seenIds, seenNames);
    const simItems = dedupeMeta(detail.similar, seenIds, seenNames);
    return { recItems, simItems };
  }, [detail, isAnime, meta.id, meta.name]);

  const shownRecItems = useHideAnimeMetas(recItems);
  const shownSimItems = useHideAnimeMetas(simItems);

  const onPlay = () => {
    if (isSeries && first) playOnHost(displayMeta, { season: first.season, episode: first.episode });
    else playOnHost(displayMeta);
  };

  return (
    <div className="md-body-in">
      <Hero
        meta={meta}
        detail={detail}
        title={title}
        logo={logo}
        backdrop={backdrop}
        year={year}
        rating={rating}
        isImdb={!isAnime && !!imdbRating}
        runtime={runtime}
        genres={genres}
        awardSummary={heroAwardSummary}
        onBack={onBack}
      />

      <div
        className="flex flex-col gap-8 px-5 pt-5"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 44px)" }}
      >
        <DetailActions meta={meta} detail={detail} title={title} trailerId={trailerId} onPlay={onPlay} />

        {overview ? (
          <Overview text={overview} />
        ) : (isAnime ? loading : key && loading) ? (
          <div className="flex flex-col gap-2.5">
            <Line className="w-full" />
            <Line className="w-full" />
            <Line className="w-2/3" />
          </div>
        ) : null}

        {isSeries && (
          <EpisodeSection
            meta={displayMeta}
            full={displayFull}
            detail={detail}
            tmdbKey={key}
            seasons={seasons}
            onPlay={(ep) => playOnHost(displayMeta, { season: ep.season, episode: ep.episode })}
          />
        )}

        {detail && <CrewSection detail={detail} onPerson={handlePerson} />}

        {detail && detail.cast.length > 0 ? (
          <CastRow cast={detail.cast} onPerson={isAnime ? undefined : handlePerson} />
        ) : (isAnime ? loading : key && loading) ? (
          <CastSkeleton />
        ) : null}

        {isAnime && animeCharacters.length > 0 && (
          <CharactersRow characters={dedupeCharacters(animeCharacters)} />
        )}

        {detail && shownRecItems.length > 0 && (
          <RecRail title="More Like This" items={shownRecItems} onOpen={onOpenMeta} />
        )}

        {detail && shownSimItems.length > 0 && (
          <RecRail title="You Might Also Like" items={shownSimItems} onOpen={onOpenMeta} />
        )}

        {isAnime && anilist && anilist.relatedAnime.length > 0 && (
          <AnimeRelatedRow
            title="Related Anime"
            nodes={dedupeRelated(anilist.relatedAnime)}
            onOpen={(n) => onOpenMeta(relatedToMeta(n))}
          />
        )}

        {isAnime && anilist && anilist.adaptations.length > 0 && (
          <AnimeRelatedRow title="Adaptations" nodes={dedupeRelated(anilist.adaptations)} />
        )}

        {isAnime && (detail || anilist) && (
          <AnimeInfo detail={detail} anilist={anilist} malRating={malRating} />
        )}

        {isAnime && anilist && hasAnimeTitles(anilist, title) && (
          <AnimeTitles details={anilist} primaryTitle={title} />
        )}

        {isAnime && anilist && anilist.statusDistribution.length > 0 && (
          <AnimeStats details={anilist} />
        )}

        {awardGroups.length > 0 && <AwardsSection groups={awardGroups} awards={awards} />}
      </div>
    </div>
  );
}
