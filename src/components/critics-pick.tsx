import { narrowMediaType, type Meta } from "@/lib/cinemeta";
import { pickRandom } from "@/lib/feed/tags";
import { useT } from "@/lib/i18n";
import { peekCachedLogo, resolveLogo } from "@/lib/logo";
import { useOmdbScores } from "@/lib/providers/omdb";
import { rpdbPoster } from "@/lib/providers/rpdb";
import {
  tmdbCriticData,
  tmdbMovieImages,
  useTmdbImdbId,
  type CriticData,
  type CriticReview,
} from "@/lib/providers/tmdb";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { openUrl } from "@/lib/window";
import { ChevronLeft, ChevronRight, ExternalLink, Play, Quote, Star } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CastChip } from "./critics-pick/cast-chip";
import { Lightbox } from "./critics-pick/lightbox";
import { LinkedReview } from "./critics-pick/linked-review";
import { OverviewModal } from "./critics-pick/overview-modal";
import { Still } from "./critics-pick/still";
import type { LightboxState, PersonRef } from "./critics-pick/types";
import { excerptReview, upsizeTmdb } from "./critics-pick/utils";
import { ImdbIcon } from "./icons/imdb-icon";
import { MetaAwardsCorner } from "./meta-awards-corner";
import { Poster } from "./poster";
import { RtBadge } from "./rt-badge";

export function CriticsPick({ meta }: { meta: Meta }) {
  const { settings } = useSettings();
  const { openMeta, openPicker, openPerson } = useView();
  const t = useT();
  const backdrop = upsizeTmdb(meta.background ?? meta.poster);

  const [data, setData] = useState<CriticData | null>(null);
  const [stills, setStills] = useState<string[]>([]);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const castScrollRef = useRef<HTMLDivElement>(null);
  const resolvedImdb = useTmdbImdbId(meta.id);
  const omdb = useOmdbScores(resolvedImdb ?? undefined);
  const [logo, setLogo] = useState<string | null>(() => peekCachedLogo(settings.tmdbKey, meta) ?? null);
  const [logoLoaded, setLogoLoaded] = useState<boolean>(!!peekCachedLogo(settings.tmdbKey, meta));

  useEffect(() => {
    const cached = peekCachedLogo(settings.tmdbKey, meta);
    if (cached) {
      setLogo(cached);
      setLogoLoaded(true);
      return;
    }
    setLogo(null);
    setLogoLoaded(false);
    let cancelled = false;
    resolveLogo(settings.tmdbKey, meta)
      .then((url) => {
        if (cancelled) return;
        setLogo(url ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [meta, settings.tmdbKey]);

  useEffect(() => {
    setOverviewOpen(false);
    setData(null);
    if (!settings.tmdbKey) return;
    let cancelled = false;
    tmdbCriticData(settings.tmdbKey, meta.id, narrowMediaType(meta.type)).then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, [meta.id, meta.type, settings.tmdbKey]);

  useEffect(() => {
    if (!settings.tmdbKey) {
      setStills([]);
      return;
    }
    let cancelled = false;
    tmdbMovieImages(settings.tmdbKey, meta.id)
      .then((urls) => !cancelled && setStills(urls))
      .catch(() => !cancelled && setStills([]));
    return () => {
      cancelled = true;
    };
  }, [meta.id, settings.tmdbKey]);

  const tagline = data?.tagline?.trim();
  const overview = data?.overview ?? meta.description ?? "";
  const reviews = data?.reviews ?? [];
  const [reviewIdx, setReviewIdx] = useState(0);
  useEffect(() => {
    setReviewIdx(0);
  }, [meta.id]);
  const activeReview: CriticReview | null = reviews[reviewIdx] ?? null;
  const quote = activeReview
    ? excerptReview(activeReview.content)
    : tagline || (overview ? overview.split(/(?<=[.!?])\s+/)[0] : "A standout this week.");

  const linkablePeople = useMemo<PersonRef[]>(() => {
    if (!data) return [];
    const out: PersonRef[] = [];
    const seen = new Set<number>();
    const push = (id: number, name: string) => {
      if (seen.has(id) || !name) return;
      seen.add(id);
      out.push({ id, name });
    };
    for (const c of data.cast) push(c.id, c.name);
    for (const c of data.crew) push(c.id, c.name);
    if (data.director) push(data.director.id, data.director.name);
    return out;
  }, [data]);

  const fallbackBackdrop = meta.background ?? meta.poster;
  const stillTiles = useMemo(() => {
    const sample = stills.length > 4 ? pickRandom(stills, 4, meta.id.length) : stills;
    return Array.from({ length: 4 }, (_, i) => sample[i] ?? fallbackBackdrop);
  }, [stills, fallbackBackdrop, meta.id]);
  const lightboxImages = stills.length > 0 ? stills : fallbackBackdrop ? [fallbackBackdrop] : [];

  const openLightbox = (src: string | undefined) => {
    if (!src || lightboxImages.length === 0) return;
    const startIndex = Math.max(0, lightboxImages.indexOf(src));
    setLightbox({ images: lightboxImages, startIndex, title: meta.name });
  };

  const handlePersonClick = useCallback(
    (id: number) => {
      setOverviewOpen(false);
      openPerson(id);
    },
    [openPerson],
  );

  const draggedRef = useRef(false);

  const onCastPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = castScrollRef.current;
    if (!el || e.button !== 0) return;
    draggedRef.current = false;
    const startX = e.clientX;
    const startScroll = el.scrollLeft;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      if (!draggedRef.current && Math.abs(dx) > 4) draggedRef.current = true;
      if (draggedRef.current) el.scrollLeft = startScroll - dx;
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.setTimeout(() => {
        draggedRef.current = false;
      }, 0);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const onCastWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = castScrollRef.current;
    if (!el) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
    }
  };

  const handleChipClick = (id: number) => {
    if (draggedRef.current) return;
    openPerson(id);
  };

  const scrollCast = (dir: -1 | 1) => {
    const el = castScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.7), behavior: "smooth" });
  };

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-[28px] font-medium leading-tight tracking-tight text-ink">Critics' Pick</h2>
        <span className="text-[12px] uppercase tracking-[0.22em] text-ink-subtle">Loved by reviewers today</span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_360px] items-stretch gap-4">
        <button
          type="button"
          onClick={() => openMeta({ ...meta, logo: logo ?? meta.logo })}
          className="group relative min-h-[520px] overflow-hidden rounded-2xl border border-edge-soft bg-canvas text-start transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0.24,1)] hover:-translate-y-1"
          style={{ isolation: "isolate" }}
        >
          {(() => {
            const src = rpdbPoster(settings.rpdbKey, meta.id, backdrop);
            return src ? (
              <img
                src={src}
                alt=""
                decoding="async"
                className="absolute inset-[2px] h-[calc(100%-4px)] w-[calc(100%-4px)] rounded-[14px] object-cover"
              />
            ) : (
              <Poster
                src={undefined}
                seed={meta.id}
                ratio="landscape"
                className="absolute inset-[2px] h-[calc(100%-4px)] w-[calc(100%-4px)] rounded-[14px]"
              />
            );
          })()}
          <div
            aria-hidden
            className="absolute inset-[2px] rounded-[14px]"
            style={{
              background:
                "linear-gradient(to top, oklch(0.10 0.02 260 / 0.92) 0%, oklch(0.10 0.02 260 / 0.30) 40%, transparent 70%)",
            }}
          />
          <div className="absolute end-7 top-6 flex h-11 w-11 items-center justify-center rounded-full bg-ink/95 text-canvas opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <Play size={18} fill="currentColor" />
          </div>
          <MetaAwardsCorner meta={meta} imdbId={resolvedImdb} />
          <div className="absolute inset-x-7 bottom-7 flex flex-col gap-2.5">
            <div className="relative flex min-h-[56px] flex-col justify-end">
              {logo ? (
                <img
                  src={logo}
                  alt={meta.name}
                  decoding="async"
                  onLoad={() => setLogoLoaded(true)}
                  onError={() => setLogo(null)}
                  className="max-h-[84px] w-auto max-w-[60%] object-contain object-left rtl:object-right drop-shadow-[0_4px_20px_rgba(0,0,0,0.55)]"
                  style={{
                    opacity: logoLoaded ? 1 : 0,
                    transition: "opacity 420ms cubic-bezier(0.32, 0.72, 0.24, 1)",
                  }}
                />
              ) : (
                <h3 className="font-display text-[36px] font-medium leading-[1.0] tracking-tight text-ink drop-shadow-[0_2px_22px_rgba(0,0,0,0.55)]">
                  {meta.name}
                </h3>
              )}
            </div>
            <div className="flex items-center gap-2.5 text-[13px] text-ink/80">
              {meta.releaseInfo && <span>{meta.releaseInfo}</span>}
              {meta.imdbRating && (
                <>
                  <span aria-hidden className="text-ink/40">
                    ·
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    {meta.id.startsWith("tt") ? (
                      <ImdbIcon className="h-[12px] w-auto rounded-[2px]" />
                    ) : (
                      <Star className="h-[12px] w-[12px] text-amber-400" fill="currentColor" strokeWidth={0} />
                    )}
                    {meta.imdbRating}
                  </span>
                </>
              )}
            </div>
          </div>
        </button>
        <aside className="flex min-h-0 flex-col gap-4 overflow-hidden rounded-2xl border border-edge-soft bg-elevated/35 p-5">
          <div className="flex flex-col gap-2">
            <Quote size={22} className="shrink-0 text-accent" />
            <p className="font-display text-[15px] italic leading-[1.5] text-ink/90 line-clamp-[5]">
              <LinkedReview text={quote} people={linkablePeople} onPersonClick={handlePersonClick} />
            </p>
            {activeReview ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-ink-subtle">
                  <span className="text-ink-muted">{activeReview.author}</span>
                  {typeof activeReview.rating === "number" && activeReview.rating > 0 && (
                    <span>· {activeReview.rating}/10</span>
                  )}
                  {activeReview.url && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openUrl(activeReview.url!);
                      }}
                      aria-label={t("Open review source")}
                      className="ms-0.5 inline-flex h-4 w-4 items-center justify-center rounded text-ink-subtle transition-colors hover:text-ink"
                    >
                      <ExternalLink size={11} strokeWidth={2} />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {reviews.length > 1 && (
                    <div className="me-1 flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => setReviewIdx((i) => (i - 1 + reviews.length) % reviews.length)}
                        aria-label={t("Previous review")}
                        className="flex h-5 w-5 items-center justify-center rounded text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
                      >
                        <ChevronLeft size={12} className="dir-icon" />
                      </button>
                      <span className="font-mono text-[10px] text-ink-subtle">
                        {reviewIdx + 1}/{reviews.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => setReviewIdx((i) => (i + 1) % reviews.length)}
                        aria-label={t("Next review")}
                        className="flex h-5 w-5 items-center justify-center rounded text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
                      >
                        <ChevronRight size={12} className="dir-icon" />
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setOverviewOpen(true)}
                    className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-accent transition-opacity hover:opacity-80"
                  >
                    {t("Read full")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 text-[11.5px] text-ink-muted">
                <div className="flex items-center gap-3">
                  {meta.imdbRating && (
                    <span className="inline-flex items-center gap-1.5">
                      {meta.id.startsWith("tt") ? (
                        <ImdbIcon className="h-[12px] w-auto rounded-[2px]" />
                      ) : (
                        <Star className="h-[12px] w-[12px] text-amber-400" fill="currentColor" strokeWidth={0} />
                      )}
                      {meta.imdbRating}
                    </span>
                  )}
                  {settings.showRtBadge && omdb?.rtCritics != null && (
                    <span className="inline-flex items-center gap-1.5">
                      <RtBadge score={omdb.rtCritics} className="h-[14px] w-auto" />
                      {omdb.rtCritics}%
                    </span>
                  )}
                  {omdb?.metascore != null && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="rounded-[3px] bg-[#ffcc33] px-1 text-[9.5px] font-bold tracking-wider text-black">
                        M
                      </span>
                      {omdb.metascore}
                    </span>
                  )}
                </div>
                {overview && (
                  <button
                    type="button"
                    onClick={() => setOverviewOpen(true)}
                    className="shrink-0 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-accent transition-opacity hover:opacity-80"
                  >
                    {t("Read full")}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {stillTiles.map((src, i) => (
              <Still
                key={`${meta.id}-${i}`}
                src={src}
                alt={meta.name}
                onClick={lightboxImages.length > 0 ? () => openLightbox(src) : undefined}
              />
            ))}
          </div>

          {data && data.cast.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] uppercase tracking-[0.2em] text-ink-subtle">{t("Cast")}</span>
                {data.cast.length > 4 && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => scrollCast(-1)}
                      aria-label={t("Scroll cast left")}
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-edge-soft text-ink-muted transition-colors duration-150 hover:bg-elevated hover:text-ink"
                    >
                      <ChevronLeft size={14} className="dir-icon" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollCast(1)}
                      aria-label={t("Scroll cast right")}
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-edge-soft text-ink-muted transition-colors duration-150 hover:bg-elevated hover:text-ink"
                    >
                      <ChevronRight size={14} className="dir-icon" />
                    </button>
                  </div>
                )}
              </div>
              <div
                ref={castScrollRef}
                onPointerDown={onCastPointerDown}
                onWheel={onCastWheel}
                className="flex cursor-grab gap-2 overflow-x-auto scroll-smooth select-none touch-pan-x active:cursor-grabbing [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                style={{ scrollSnapType: "x mandatory" }}
              >
                {data.cast.map((c) => (
                  <CastChip key={c.id} member={c} onClick={() => handleChipClick(c.id)} />
                ))}
              </div>
            </div>
          )}

          {data && (data.director || data.genres.length > 0) && (
            <div className="flex flex-col gap-2 text-[12.5px]">
              {data.director && (
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[10.5px] uppercase tracking-[0.2em] text-ink-subtle">{t("Director")}</span>
                  <button
                    type="button"
                    onClick={() => openPerson(data.director!.id)}
                    className="truncate text-ink underline-offset-2 transition-colors hover:underline"
                  >
                    {data.director.name}
                  </button>
                </div>
              )}
              {data.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {data.genres.slice(0, 3).map((g) => (
                    <span
                      key={g}
                      className="rounded-full border border-edge-soft px-2.5 py-0.5 text-[11px] text-ink-muted"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-auto flex justify-end">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openPicker(meta);
              }}
              className="rounded-full bg-ink px-6 py-2 text-[13px] font-semibold text-canvas transition-colors duration-200 hover:bg-ink/90"
            >
              Play
            </button>
          </div>
        </aside>
      </div>

      {lightbox && (
        <Lightbox
          images={lightbox.images}
          startIndex={lightbox.startIndex}
          title={lightbox.title}
          onClose={() => setLightbox(null)}
        />
      )}

      {overviewOpen && (overview || activeReview) && (
        <OverviewModal
          title={meta.name}
          tagline={tagline}
          overview={overview}
          review={activeReview}
          people={linkablePeople}
          onClose={() => setOverviewOpen(false)}
          onPersonClick={handlePersonClick}
          reviewCount={reviews.length}
          reviewIndex={reviewIdx}
          onNavReview={(dir) => setReviewIdx((i) => (i + dir + reviews.length) % reviews.length)}
        />
      )}
    </section>
  );
}
