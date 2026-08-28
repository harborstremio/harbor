import { Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ImdbIcon } from "@/components/icons/imdb-icon";
import { MetaAwardsCorner } from "@/components/meta-awards-corner";
import { meta as fetchMeta, narrowMediaType, type Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { tmdbLogo, useTmdbImdbId } from "@/lib/providers/tmdb";
import { useImdbRating } from "@/lib/imdb-rating";
import { useSettings } from "@/lib/settings";
import { useTitleLogo } from "@/lib/title-logo";
import { smartPlayEpisode } from "@/lib/smart-play";
import { useView } from "@/lib/view";
import { observe, usePageVisible } from "@/lib/visibility";
import { mergePreferredMeta } from "@/lib/preferred-meta";
import { usePreferredMeta } from "@/lib/use-preferred-meta";

const ROTATE_MS = 9500;
const EASE = "cubic-bezier(0.32, 0.72, 0.24, 1)";
const CENTER_FRACTION = 0.7;
const DRAG_THRESHOLD = 8;
const SNAP_FRACTION = 0.15;
const FLICK_VELOCITY = 0.45;

export function PeekHero({ slides }: { slides: Meta[] }) {
  const t = useT();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [inViewport, setInViewport] = useState(true);
  const pageVisible = usePageVisible();
  const ref = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
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

  if (slides.length === 0) {
    return (
      <div className="flex h-[440px] animate-pulse items-center justify-center rounded-[24px] border border-edge-soft bg-elevated/20" />
    );
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || slides.length < 2) return;
    widthRef.current = trackRef.current?.clientWidth ?? 1000;
    setDragging(true);
    moved.current = false;
    startX.current = e.clientX;
    lastX.current = e.clientX;
    lastT.current = performance.now();
    velocity.current = 0;
    setDragOffset(0);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > DRAG_THRESHOLD) {
      if (!moved.current) {
        try {
          trackRef.current?.setPointerCapture(e.pointerId);
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
    setDragOffset(dx);
  };

  const endDrag = () => {
    if (!dragging) return;
    setDragging(false);
    const total = widthRef.current || 1000;
    const dx = dragOffset;
    const flick = Math.abs(velocity.current) > FLICK_VELOCITY;
    const passed = Math.abs(dx) > total * SNAP_FRACTION;
    if (flick || passed) {
      const dir = dx < 0 ? 1 : -1;
      setActive((a) => (a + dir + slides.length) % slides.length);
    }
    setDragOffset(0);
    velocity.current = 0;
  };

  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (moved.current) {
      e.stopPropagation();
      e.preventDefault();
      moved.current = false;
    }
  };

  return (
    <div
      ref={ref}
      className="flex flex-col gap-5"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
        className={`relative h-[440px] overflow-hidden ${
          dragging ? "cursor-grabbing" : slides.length > 1 ? "cursor-grab" : ""
        } select-none`}
        style={{ touchAction: "pan-y" }}
      >
        {slides.map((m, i) => {
          const offset = computeOffset(i, active, slides.length);
          return (
            <PeekSlide
              key={m.id}
              meta={m}
              offset={offset}
              active={i === active}
              dragging={dragging}
              dragOffsetPx={dragOffset}
              trackWidth={widthRef.current}
              onSelect={() => setActive(i)}
            />
          );
        })}
      </div>
      {slides.length > 1 && (
        <div className="flex justify-center gap-2 pt-1">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              aria-label={t("Slide {n}", { n: i + 1 })}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i === active ? "w-8 bg-ink" : "w-1.5 bg-ink-muted/55 hover:bg-ink-muted"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function computeOffset(index: number, active: number, total: number): number {
  let raw = index - active;
  if (raw > total / 2) raw -= total;
  if (raw < -total / 2) raw += total;
  return raw;
}

function PeekSlide({
  meta,
  offset,
  active,
  dragging,
  dragOffsetPx,
  trackWidth,
  onSelect,
}: {
  meta: Meta;
  offset: number;
  active: boolean;
  dragging: boolean;
  dragOffsetPx: number;
  trackWidth: number;
  onSelect: () => void;
}) {
  const t = useT();
  const { settings } = useSettings();
  const { openMeta, openPicker } = useView();
  const preferredMeta = usePreferredMeta(meta, active);
  const displayMeta = mergePreferredMeta(meta, preferredMeta);
  const resolvedImdb = useTmdbImdbId(meta.id);
  const imdbRating = useImdbRating(meta, resolvedImdb);
  const [logoState, setLogo] = useState<string | undefined>(meta.logo);
  const pinnedLogo = useTitleLogo(meta.id);
  const logo = pinnedLogo ?? logoState;
  const [logoLoaded, setLogoLoaded] = useState(false);
  const bg = upsizeTmdb(meta.background || meta.poster);

  useEffect(() => {
    if (logo) return;
    let cancelled = false;
    const isTmdb = meta.id.startsWith("tmdb:");
    const lookup = isTmdb
      ? tmdbLogo(settings.tmdbKey, meta.id, meta.originalLanguage)
      : fetchMeta(narrowMediaType(meta.type), meta.id).then((full) => full?.logo);
    lookup
      .then((url) => {
        if (cancelled || !url) return;
        setLogo(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [meta.id, meta.type, logo, settings.tmdbKey]);

  const visible = Math.abs(offset) <= 1;
  if (!visible) return null;

  const dragShiftPct = dragging && trackWidth > 0 ? (dragOffsetPx / trackWidth) * 100 : 0;
  const translatePct = offset * 75 + dragShiftPct;
  const scale = active ? 1 : 0.86;
  const opacity = active ? 1 : 0.45;
  const z = active ? 10 : 5;

  return (
    <div
      onClick={() => (active ? openMeta(displayMeta) : onSelect())}
      className="absolute left-1/2 top-1/2 h-[420px] w-[920px] overflow-hidden rounded-[20px] shadow-[0_28px_60px_-26px_rgba(0,0,0,0.7)]"
      style={{
        transform: `translate(-50%, -50%) translateX(${translatePct}%) scale(${scale})`,
        transition: dragging
          ? "none"
          : `transform 720ms ${EASE}, opacity 720ms ${EASE}`,
        opacity,
        zIndex: z,
        maxWidth: `${CENTER_FRACTION * 100}%`,
      }}
    >
      {bg && (
        <img
          src={bg}
          alt=""
          decoding="async"
          fetchPriority={active ? "high" : "low"}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
      {active && <MetaAwardsCorner meta={meta} imdbId={resolvedImdb} />}
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3.5 px-9 pb-9">
        <div className="flex min-h-[68px] items-end">
          {logo ? (
            <img
              src={logo}
              alt={displayMeta.name}
              decoding="async"
              onLoad={() => setLogoLoaded(true)}
              className="max-h-[80px] w-auto max-w-[360px] object-contain object-left rtl:object-right drop-shadow-[0_4px_18px_rgba(0,0,0,0.55)]"
              style={{
                opacity: logoLoaded ? 1 : 0,
                transition: "opacity 320ms ease-out",
              }}
            />
          ) : (
            <h3 className="font-display text-[40px] font-medium leading-[0.95] tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
              {displayMeta.name}
            </h3>
          )}
        </div>
        {active && (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] uppercase tracking-[0.18em] text-white/70">
              {meta.releaseInfo && <span>{meta.releaseInfo}</span>}
              {imdbRating && (
                <span className="flex items-center gap-1.5 normal-case tracking-normal">
                  <ImdbIcon className="h-[14px] w-auto rounded-[2px] shadow-[0_1px_3px_rgba(0,0,0,0.4)]" />
                  <span className="text-[13px] font-semibold text-white">
                    {imdbRating}
                  </span>
                </span>
              )}
              {meta.genres && meta.genres.length > 0 && (
                <span>{meta.genres.slice(0, 2).join(" · ")}</span>
              )}
            </div>
            <div className="flex items-center gap-2.5 pt-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openPicker(displayMeta, smartPlayEpisode(displayMeta), { autoPlay: settings.instantPlay });
                }}
                className="flex h-10 items-center gap-2 rounded-full bg-white px-5 text-[13px] font-semibold text-black transition-transform hover:scale-[1.04] active:scale-[0.97]"
              >
                <Play size={14} fill="currentColor" />
                {t("Play")}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openMeta(displayMeta);
                }}
                className="flex h-10 items-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 text-[13px] font-medium text-white backdrop-blur-md transition-colors hover:bg-white/20"
              >
                {t("Episodes")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function upsizeTmdb(url?: string): string | undefined {
  if (!url) return url;
  return url.replace(/\/t\/p\/(w780|original)\//, "/t/p/w1280/");
}
