import { ImdbIcon } from "@/components/icons/imdb-icon";
import { MetaAwardsCorner } from "@/components/meta-awards-corner";
import { meta as fetchMeta, narrowMediaType, type Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { useImdbRating } from "@/lib/imdb-rating";
import { tmdbLogo, tmdbTrailerList, useTmdbImdbId } from "@/lib/providers/tmdb";
import { useSettings } from "@/lib/settings";
import { smartPlayEpisode } from "@/lib/smart-play";
import { fetchTrailer, prefetchTrailer, trailerSrc, type TrailerInfo } from "@/lib/trailer";
import { useLocalizedOverview } from "@/lib/use-localized-overview";
import { useView } from "@/lib/view";
import { observe, usePageVisible } from "@/lib/visibility";
import { ChevronRight, Info, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const ROTATE_MS = 11000;
const EASE_OUT = "cubic-bezier(0.32, 0.72, 0.24, 1)";
const DRAG_BUDGE = 6;
const SNAP_RATIO = 0.18;
const FLICK_VELOCITY = 0.45;

function rubberBand(distance: number, dim: number, c = 0.55): number {
  return (1 - 1 / (distance / dim / c + 1)) * dim * c;
}

export function CinemaHero({ slides, eyebrow = "Featured film" }: { slides: Meta[]; eyebrow?: string }) {
  const t = useT();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState(0);
  const [inViewport, setInViewport] = useState(true);
  const pageVisible = usePageVisible();
  const ref = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const lastX = useRef(0);
  const lastT = useRef(0);
  const velocity = useRef(0);
  const moved = useRef(false);
  const widthRef = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return observe(el, setInViewport);
  }, []);

  useEffect(() => {
    if (paused || dragging || !inViewport || !pageVisible || slides.length < 2) return;
    const id = setInterval(() => setActive((a) => (a + 1) % slides.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [paused, dragging, inViewport, pageVisible, slides.length]);

  useEffect(() => {
    if (active >= slides.length) setActive(0);
  }, [slides.length, active]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (slides.length < 2) return;
    widthRef.current = viewportRef.current?.clientWidth ?? 1000;
    setDragging(true);
    moved.current = false;
    startX.current = e.clientX;
    lastX.current = e.clientX;
    lastT.current = performance.now();
    velocity.current = 0;
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > DRAG_BUDGE) {
      if (!moved.current) {
        try {
          viewportRef.current?.setPointerCapture(e.pointerId);
        } catch {}
      }
      moved.current = true;
    }
    const now = performance.now();
    const dt = now - lastT.current;
    if (dt > 0) {
      const inst = (e.clientX - lastX.current) / dt;
      velocity.current = velocity.current * 0.6 + inst * 0.4;
    }
    lastX.current = e.clientX;
    lastT.current = now;

    const W = widthRef.current || 1000;
    let next = dx;
    if (active === 0 && dx > 0) next = rubberBand(dx, W);
    else if (active === slides.length - 1 && dx < 0) next = -rubberBand(-dx, W);
    setOffset(next);
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    try {
      if (viewportRef.current?.hasPointerCapture?.(e.pointerId)) {
        viewportRef.current.releasePointerCapture(e.pointerId);
      }
    } catch {}
    setDragging(false);
    const W = widthRef.current || 1000;
    const distance = offset;
    const threshold = W * SNAP_RATIO;
    const v = velocity.current;
    const wantNext = (distance < -threshold || v < -FLICK_VELOCITY) && active < slides.length - 1;
    const wantPrev = (distance > threshold || v > FLICK_VELOCITY) && active > 0;
    if (wantNext) setActive(active + 1);
    else if (wantPrev) setActive(active - 1);
    setOffset(0);
  };
  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (moved.current) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  if (slides.length === 0) {
    return <section className="harbor-bleed-stremio relative h-[78vh] min-h-[640px] animate-pulse bg-elevated/30" />;
  }

  const trackTransform = `translate3d(calc(${-active * 100}% + ${offset}px), 0, 0)`;

  return (
    <section
      ref={ref}
      className="harbor-bleed-stremio relative h-[78vh] min-h-[640px] overflow-hidden bg-canvas"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        ref={viewportRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
        className={`relative h-full w-full overflow-hidden select-none ${
          slides.length > 1 ? (dragging ? "cursor-grabbing" : "cursor-grab") : ""
        }`}
        style={{ touchAction: "pan-y" }}
      >
        <div
          className="flex h-full w-full"
          style={{
            transform: trackTransform,
            transition: dragging ? "none" : `transform 700ms ${EASE_OUT}`,
            willChange: "transform",
          }}
        >
          {slides.map((m, i) => {
            const distance = Math.abs(i - active);
            const shouldMount = distance <= 1 || dragging;
            return (
              <div key={m.id} className="relative h-full w-full shrink-0">
                {shouldMount ? <CinemaSlide meta={m} active={i === active && !dragging} eyebrow={eyebrow} /> : null}
              </div>
            );
          })}
        </div>
      </div>
      {slides.length > 1 && (
        <div className="absolute bottom-7 left-1/2 z-10 flex -translate-x-1/2 gap-2.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              aria-label={t("Slide {n}", { n: i + 1 })}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i === active ? "w-10 bg-ink" : "w-1.5 bg-ink-muted/55 hover:bg-ink-muted"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function CinemaSlide({ meta, active, eyebrow }: { meta: Meta; active: boolean; eyebrow: string }) {
  const t = useT();
  const { settings } = useSettings();
  const { openMeta, openPicker } = useView();
  const description = useLocalizedOverview(meta);
  const resolvedImdb = useTmdbImdbId(meta.id);
  const imdbRating = useImdbRating(meta, resolvedImdb);
  const [logo, setLogo] = useState<string | undefined>(meta.logo);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [logoResolved, setLogoResolved] = useState<boolean>(!!meta.logo);
  const [trailerCandidates, setTrailerCandidates] = useState<string[]>([]);
  const [trailerInfo, setTrailerInfo] = useState<TrailerInfo | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pageVisible = usePageVisible();
  const wantsPlayback = active && !!trailerInfo && pageVisible;
  const bg = upsizeTmdb(meta.background || meta.poster);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    if (!logoResolved) {
      const isTmdb = meta.id.startsWith("tmdb:");
      const lookup = isTmdb
        ? tmdbLogo(settings.tmdbKey, meta.id, meta.originalLanguage)
        : fetchMeta(narrowMediaType(meta.type), meta.id).then((full) => full?.logo);
      lookup
        .then((url) => {
          if (cancelled) return;
          setLogo(url);
          setLogoResolved(true);
        })
        .catch(() => {
          if (cancelled) return;
          setLogoResolved(true);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [active, logoResolved, meta.id, meta.type, settings.tmdbKey]);

  useEffect(() => {
    if (!active) return;
    setTrailerCandidates([]);
    setTrailerInfo(null);
    setVideoReady(false);
    let cancelled = false;
    const isTmdb = meta.id.startsWith("tmdb:");
    const lookup: Promise<string[]> = isTmdb
      ? tmdbTrailerList(settings.tmdbKey, meta.id)
      : fetchMeta(narrowMediaType(meta.type), meta.id).then((full) => {
          const ids = [
            full?.trailers?.[0]?.source,
            full?.trailerStreams?.[0]?.ytId,
            ...(full?.trailerStreams?.slice(1).map((s) => s.ytId) ?? []),
          ].filter((s): s is string => !!s);
          return Array.from(new Set(ids));
        });
    lookup
      .then((ids) => {
        if (cancelled) return;
        setTrailerCandidates(ids);
        if (ids[0]) prefetchTrailer(ids[0], "360p");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [active, meta.id, meta.type, settings.tmdbKey]);

  useEffect(() => {
    if (!active || trailerCandidates.length === 0 || trailerInfo) return;
    let cancelled = false;
    fetchTrailer(trailerCandidates[0], "360p").then((info) => {
      if (!cancelled && info) setTrailerInfo(info);
    });
    return () => {
      cancelled = true;
    };
  }, [active, trailerCandidates, trailerInfo]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (wantsPlayback) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [wantsPlayback]);

  useEffect(() => {
    if (!trailerInfo) return;
    const v = videoRef.current;
    return () => {
      if (!v) return;
      try {
        v.pause();
        v.removeAttribute("src");
        v.load();
      } catch {
        void 0;
      }
    };
  }, [trailerInfo]);

  return (
    <div aria-hidden={!active} className="relative h-full w-full">
      {bg && (
        <img
          src={bg}
          alt=""
          decoding="async"
          fetchPriority={active ? "high" : "low"}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
          style={{ opacity: wantsPlayback && videoReady ? 0 : 1 }}
        />
      )}
      {trailerInfo && (
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-700"
          style={{ opacity: wantsPlayback && videoReady ? 1 : 0 }}
        >
          <video
            ref={videoRef}
            src={trailerSrc(trailerInfo)}
            muted
            loop
            playsInline
            preload="none"
            onCanPlay={() => setVideoReady(true)}
            className="absolute left-1/2 top-1/2 h-[135%] w-[135%] -translate-x-1/2 -translate-y-1/2 object-cover"
          />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/70 via-30% to-transparent" />
      <MetaAwardsCorner meta={meta} imdbId={resolvedImdb} />
      <div className="absolute inset-y-0 start-0 w-3/5 bg-gradient-to-r from-canvas/95 via-canvas/55 to-transparent rtl:bg-gradient-to-l" />

      <div className="relative flex h-full items-end pb-28 ps-20 pe-20">
        <div className="flex max-w-[640px] flex-col gap-5">
          <span className="text-[11px] font-bold uppercase tracking-[0.42em] text-ink-subtle">{t(eyebrow)}</span>
          <CinemaTitlePlate
            name={meta.name}
            logo={logo}
            loaded={logoLoaded}
            resolved={logoResolved}
            onLoad={() => setLogoLoaded(true)}
            onError={() => {
              setLogo(undefined);
              setLogoResolved(true);
            }}
          />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] tracking-wide text-ink-muted">
            {meta.releaseInfo && <span>{meta.releaseInfo}</span>}
            {meta.runtime && <Dot />}
            {meta.runtime && <span>{meta.runtime}</span>}
            {settings.showImdbBadge && imdbRating && <Dot />}
            {settings.showImdbBadge && imdbRating && (
              <span className="flex items-center gap-1.5">
                <ImdbIcon className="h-[14px] w-auto rounded-[2px]" />
                <span className="font-semibold text-ink">{imdbRating}</span>
              </span>
            )}
            {meta.genres && meta.genres.length > 0 && <Dot />}
            {meta.genres && meta.genres.length > 0 && <span>{meta.genres.slice(0, 3).join(" · ")}</span>}
          </div>
          {description && (
            <p className="line-clamp-2 max-w-[560px] text-[15.5px] leading-relaxed text-ink-muted">{description}</p>
          )}
          <div className="mt-2 flex items-center gap-3">
            <button
              onClick={() => openPicker(meta, smartPlayEpisode(meta), { autoPlay: settings.instantPlay })}
              className="flex h-12 items-center gap-2.5 rounded-md bg-ink px-7 text-[14.5px] font-semibold text-canvas shadow-[0_8px_24px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.5)] transition-transform duration-200 hover:scale-[1.03] active:scale-[0.97]"
            >
              <Play size={17} fill="currentColor" />
              {t("Play")}
            </button>
            <button
              onClick={() => openMeta(meta)}
              className="flex h-12 items-center gap-2.5 rounded-md border border-edge bg-canvas/50 px-6 text-[14.5px] font-medium text-ink backdrop-blur-sm transition-colors duration-200 hover:bg-canvas/70"
            >
              <Info size={16} strokeWidth={2} />
              {t("More info")}
              <ChevronRight size={15} strokeWidth={2} className="dir-icon opacity-65" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CinemaTitlePlate({
  name,
  logo,
  loaded,
  resolved,
  onLoad,
  onError,
}: {
  name: string;
  logo?: string;
  loaded: boolean;
  resolved: boolean;
  onLoad: () => void;
  onError: () => void;
}) {
  return (
    <div className="relative flex min-h-[120px] items-end">
      {logo ? (
        <img
          src={logo}
          alt={name}
          decoding="async"
          onLoad={onLoad}
          onError={onError}
          className="max-h-[140px] w-auto max-w-[520px] object-contain object-left rtl:object-right drop-shadow-[0_8px_28px_rgba(0,0,0,0.55)]"
          style={{
            opacity: loaded ? 1 : 0,
            transition: "opacity 360ms cubic-bezier(0.32, 0.72, 0.24, 1)",
          }}
        />
      ) : resolved ? (
        <h2
          className="font-display text-[72px] font-medium leading-[0.95] tracking-tight text-ink"
          style={{ animation: "harbor-fade-in 420ms cubic-bezier(0.32, 0.72, 0.24, 1) both" }}
        >
          {name}
        </h2>
      ) : null}
    </div>
  );
}

function Dot() {
  return <span className="h-1 w-1 rounded-full bg-ink-subtle/60" />;
}

function upsizeTmdb(url?: string): string | undefined {
  if (!url) return url;
  return url.replace("/t/p/w780/", "/t/p/w1280/");
}
