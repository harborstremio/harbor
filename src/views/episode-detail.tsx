import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import type { Meta } from "@/lib/cinemeta";
import type { EpisodeDetail } from "@/lib/providers/tmdb/tmdb-episode-types";
import type { CastEntry } from "@/lib/providers/tmdb";
import { fetchEpisodeData } from "@/lib/episode-data-fetcher";
import { meta as fetchCinemetaMeta } from "@/lib/cinemeta";
import { useSettings, type Settings } from "@/lib/settings";
import { useScrollMemory, useView, type PlayEpisode } from "@/lib/view";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { useOmdbScores, omdbScores as fetchOmdbScores } from "@/lib/providers/omdb";
import { harborImdbEpisodes } from "@/lib/providers/harbor-imdb";
import { useTmdbImdbId } from "@/lib/providers/tmdb";
import { HeroRatings } from "@/views/detail/hero-ratings";
import { CastCard } from "@/views/detail/cast-card";
import { Row } from "@/components/row";
import { BackToTop } from "@/components/back-to-top";
import { Synopsis } from "@/views/detail/synopsis";
import { TitlePlate } from "@/views/detail/title-plate";
import { Pill } from "@/views/detail/pill";
import { PlayModeHint } from "@/views/detail/play-mode-hint";
import { TraktComments } from "@/views/detail/trakt-comments";
import { stremioIdToTraktTarget } from "@/lib/trakt/ids";

export interface EpisodeDetailViewProps {
  seriesId: string;
  season: number;
  episode: number;
  seriesMeta?: Meta;
}

export function EpisodeDetailView({
  seriesId,
  season,
  episode,
  seriesMeta: initialSeriesMeta,
}: EpisodeDetailViewProps) {
  const t = useT();
  const { settings } = useSettings();
  const { openPicker, openMeta, goBack } = useView();

  const [seriesMeta, setSeriesMeta] = useState<Meta | null>(initialSeriesMeta || null);
  const [episodeData, setEpisodeData] = useState<EpisodeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLElement>(null);

  const resolvedImdb = useTmdbImdbId(seriesMeta?.id);
  const imdbId = resolvedImdb ?? (seriesMeta?.id.startsWith("tt") ? seriesMeta.id : null);
  const omdbScores = useOmdbScores(imdbId ?? undefined);
  const episodeImdbId = episodeData?.imdbId ?? undefined;
  const episodeOmdbScores = useOmdbScores(episodeImdbId);
  const [harborEpisodeRating, setHarborEpisodeRating] = useState<string | undefined>();
  useEffect(() => {
    setHarborEpisodeRating(undefined);
    if (!imdbId || !imdbId.startsWith("tt")) return;
    let cancelled = false;
    void harborImdbEpisodes(imdbId).then((map) => {
      if (cancelled) return;
      const r = map.get(`${season}:${episode}`);
      if (r != null) setHarborEpisodeRating(r.toFixed(1));
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [imdbId, season, episode]);
  useScrollMemory(`episode:${seriesId}:${season}:${episode}`, scrollRef);

  // Trigger OMDB fetch for episode IMDb ID (useOmdbScores only watches cache, doesn't fetch)
  useEffect(() => {
    if (!settings.omdbKey || !episodeImdbId) return;
    let cancelled = false;
    void fetchOmdbScores(settings.omdbKey, episodeImdbId).then(() => {
      if (cancelled) return;
    });
    return () => { cancelled = true; };
  }, [settings.omdbKey, episodeImdbId]);

  const episodeKey = `${seriesId}:${season}:${episode}`;
  const { tmdbKey } = settings;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setEpisodeData(null);

    (async () => {
      try {
        let meta: Meta | undefined = initialSeriesMeta;
        if (!meta) {
          const fetched = await fetchCinemetaMeta("series", seriesId);
          if (cancelled || !fetched) return;
          meta = fetched;
          setSeriesMeta(meta);
        }

        const data = await fetchEpisodeData(seriesId, meta, season, episode, { tmdbKey } as Settings);
        if (cancelled) return;

        if (data) {
          setEpisodeData(data);
        } else {
          setError(t("Episode information is not available"));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("An unexpected error occurred"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [episodeKey, initialSeriesMeta, tmdbKey]);

  const getImageUrl = (path: string | null | undefined, size = "original"): string | undefined => {
    if (!path) return undefined;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    return `https://image.tmdb.org/t/p/${size}${path}`;
  };

  const background = getImageUrl(episodeData?.stillPath, "original") ?? seriesMeta?.background ?? undefined;

  // Episode rating: hosted IMDb → OMDB (via episode IMDb ID) → TMDB vote_average → none
  const episodeRating = harborEpisodeRating ??
    episodeOmdbScores?.imdbRating ??
    (episodeData?.voteAverage && episodeData.voteAverage > 0
      ? episodeData.voteAverage.toFixed(1) : undefined);

  const seriesRating = omdbScores?.imdbRating ?? (imdbId ? seriesMeta?.imdbRating : undefined) ?? undefined;

  const traktResolution = stremioIdToTraktTarget(seriesId, { season, episode });

  // Inject IMDB ID into target if resolution succeeded but only has TMDB ID
  // (Trakt comments API only accepts IMDB/Trakt/slug IDs, not TMDB)
  if (traktResolution.ok && traktResolution.target.kind === "episode") {
    const target = traktResolution.target;
    if (imdbId && !target.show.ids.imdb) target.show.ids.imdb = imdbId;
    // Add episode-level ids for comment posting
    const epIds: { tmdb?: number; imdb?: string } = {};
    if (episodeData?.id) epIds.tmdb = episodeData.id;
    if (imdbId) epIds.imdb = imdbId;
    (target as { ids?: { tmdb?: number; imdb?: string } }).ids = epIds;
  }

  const handlePlay = useCallback(() => {
    if (!seriesMeta || !episodeData) return;
    const playEpisode: PlayEpisode = {
      season: episodeData.seasonNumber,
      episode: episodeData.episodeNumber,
      runtime: episodeData.runtime ?? undefined,
      name: episodeData.name,
      still: getImageUrl(episodeData.stillPath, "w300") || undefined,
      overview: episodeData.overview || undefined,
    };
    openPicker(seriesMeta, playEpisode, { autoPlay: settings.instantPlay });
  }, [seriesMeta, episodeData, openPicker, settings.instantPlay]);

  const handleSeriesClick = useCallback(() => {
    if (seriesMeta) openMeta(seriesMeta);
  }, [seriesMeta, openMeta]);

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-12">
        <div className="max-w-md text-center">
          <h2 className="mb-4 text-[24px] font-semibold text-ink">{t("Episode Not Found")}</h2>
          <p className="mb-6 text-[14px] text-ink-muted">{error}</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={goBack}
              className="flex items-center gap-2 rounded-lg bg-elevated px-5 py-2.5 text-[14px] font-semibold text-ink ring-1 ring-edge transition-colors hover:bg-raised"
            >
              <ArrowLeft size={16} />
              {t("Go Back")}
            </button>
            {seriesMeta && (
              <button
                onClick={handleSeriesClick}
                className="rounded-lg bg-ink px-5 py-2.5 text-[14px] font-semibold text-canvas transition-colors hover:bg-ink/90"
              >
                {t("View Series")}
              </button>
            )}
          </div>
        </div>
      </main>
    );
  }

  if (loading || !episodeData || !seriesMeta) {
    return (
      <main className="absolute inset-0 z-30 overflow-y-auto bg-canvas">
        <section className="relative">
          <div className="relative h-[78vh] min-h-[640px] animate-pulse overflow-hidden bg-elevated">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-muted border-t-transparent" />
                <p className="text-[14px] text-ink-muted">{t("Loading episode details...")}</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main
      ref={scrollRef}
      className="absolute inset-0 z-30 overflow-y-auto bg-canvas"
    >
      <section className="relative">
        <div
          data-tauri-drag-region
          className="harbor-bleed-stremio relative h-[78vh] min-h-[640px] overflow-hidden"
        >
          {background && (
            <img
              src={background}
              alt=""
              decoding="async"
              fetchPriority="high"
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/55 via-45% to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r rtl:bg-gradient-to-l from-canvas/85 via-canvas/35 to-transparent" />

          <div className="absolute inset-x-0 bottom-0 px-12 pb-14">
            <div className="max-w-3xl">
              <button
                onClick={handleSeriesClick}
                className="mb-4 inline-flex items-center gap-1 text-[14px] font-semibold text-ink-muted transition-colors hover:text-ink"
              >
                <ArrowLeft size={16} />
                {seriesMeta.name}
              </button>

              <TitlePlate
                title={`S${episodeData.seasonNumber}E${episodeData.episodeNumber} — ${episodeData.name}`}
                loading={false}
              />

              <div className="mt-6 flex flex-wrap items-center gap-3 text-[13px] font-medium text-ink-muted">
                {episodeData.airDate && (
                  <Pill>
                    {t("Aired {date}", { date: new Date(episodeData.airDate).toLocaleDateString() })}
                  </Pill>
                )}
                {episodeData.runtime && episodeData.runtime > 0 && (
                  <Pill>{t("{n} min", { n: episodeData.runtime })}</Pill>
                )}
                <HeroRatings
                  rating={episodeRating ?? seriesRating}
                  isAnime={false}
                  scores={episodeOmdbScores ?? omdbScores}
                  mdblist={null}
                  imdbId={episodeImdbId ?? imdbId}
                  mediaType="show"
                  onOpenUrl={openUrl}
                />
              </div>

              <div className="mt-9 flex gap-3">
                <PlayModeHint>
                  <button
                    onClick={handlePlay}
                    className="flex h-12 items-center gap-2.5 rounded-full bg-ink px-7 text-[15px] font-semibold text-canvas transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]"
                  >
                    <Play size={18} fill="currentColor" />
                    {t("Play Episode")}
                  </button>
                </PlayModeHint>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-16 px-12 pb-24 pt-14">
        {episodeData.overview && (
          <Synopsis text={episodeData.overview} />
        )}

        {episodeData.guestStars && episodeData.guestStars.length > 0 && (
          <section>
            <Row title={t("Guest Stars · {n}", { n: episodeData.guestStars.length })} min={128}>
              {episodeData.guestStars.map((star, i) => (
                <CastCard
                  key={`${star.id}-${i}`}
                  cast={{
                    id: star.id,
                    name: star.name,
                    character: star.character,
                    profilePath: star.profilePath,
                    order: i,
                  } as CastEntry}
                />
              ))}
            </Row>
          </section>
        )}

        {episodeData.stills && episodeData.stills.length > 0 && (
          <section>
            <h2 className="mb-6 text-[20px] font-bold text-ink">{t("Stills")}</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {episodeData.stills.slice(0, 12).map((still, idx) => (
                <div
                  key={still.filePath}
                  className="group relative aspect-video overflow-hidden rounded-xl bg-elevated"
                >
                  <img
                    src={getImageUrl(still.filePath, "w780")}
                    alt={`${episodeData.name} — ${t("Still {n}", { n: idx + 1 })}`}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {settings.showTraktComments === true && <TraktComments resolution={traktResolution} />}
      </div>

      <BackToTop scrollRef={scrollRef} />
    </main>
  );
}
