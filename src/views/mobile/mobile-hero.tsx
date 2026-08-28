import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Info, Play, Plus, TrendingUp } from "lucide-react";
import type { Meta } from "@/lib/cinemeta";
import { useSettings } from "@/lib/settings";
import { useHeroLogos } from "@/components/anime-hero/use-hero-logos";
import { toggleWatchlist, useInWatchlist } from "@/lib/watchlist";
import { ImdbIcon } from "@/components/icons/imdb-icon";
import { useMobileRemote } from "./mobile-remote";

const AUTO_MS = 8000;
const DISSOLVE_MS = 900;
const TEXT_MS = 340;
const PILL_PAUSE_MS = 12000;

function upsize(url?: string): string | undefined {
  if (!url) return url;
  return url.replace(/\/t\/p\/w\d+\//, "/t/p/w1280/");
}

function kindLabel(t: Meta["type"]): string {
  if (t === "series") return "Series";
  if (t === "anime") return "Anime";
  return "Movies";
}

function prefersReduced(): boolean {
  return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function MobileHero({
  slides,
  onOpenDetail,
}: {
  slides: Meta[];
  onOpenDetail?: (m: Meta) => void;
}) {
  const { settings } = useSettings();
  const { openOnHost, playOnHost } = useMobileRemote();
  const shown = useMemo(() => slides.slice(0, 6), [slides]);
  const logos = useHeroLogos(slides, settings);

  const [slots, setSlots] = useState<[number, number]>([0, 0]);
  const [front, setFront] = useState<0 | 1>(0);
  const [active, setActive] = useState(0);
  const [textOn, setTextOn] = useState(true);
  const [reduce, setReduce] = useState(prefersReduced);

  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const frontRef = useRef(front);
  frontRef.current = front;
  const activeRef = useRef(active);
  activeRef.current = active;
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;
  const busyRef = useRef(false);
  const pausedUntil = useRef(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const on = () => setReduce(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);

  useEffect(() => {
    for (const m of shown) {
      const u = upsize(m.background) ?? m.poster;
      if (u) {
        const img = new Image();
        img.src = u;
      }
    }
  }, [shown]);

  useEffect(() => {
    const n = shown.length;
    const s = slotsRef.current;
    if (activeRef.current >= n || s[0] >= n || s[1] >= n) {
      setSlots([0, 0]);
      setFront(0);
      setActive(0);
      setTextOn(true);
      busyRef.current = false;
    }
  }, [shown.length]);

  const goTo = useCallback((i: number) => {
    const cur = slotsRef.current[frontRef.current];
    if (i === cur || busyRef.current) return;
    const back = (frontRef.current ^ 1) as 0 | 1;
    setSlots((s): [number, number] => (back === 0 ? [i, s[1]] : [s[0], i]));
    setFront(back);
    if (reduceRef.current) {
      setActive(i);
      setTextOn(true);
      return;
    }
    busyRef.current = true;
    setTextOn(false);
    timers.current.push(
      window.setTimeout(() => {
        setActive(i);
        setTextOn(true);
      }, TEXT_MS),
      window.setTimeout(() => {
        busyRef.current = false;
      }, DISSOLVE_MS),
    );
  }, []);

  useEffect(() => {
    if (shown.length < 2) return;
    const id = window.setInterval(() => {
      if (reduceRef.current || busyRef.current || Date.now() < pausedUntil.current) return;
      const cur = slotsRef.current[frontRef.current];
      goTo((cur + 1) % shown.length);
    }, AUTO_MS);
    return () => window.clearInterval(id);
  }, [shown.length, goTo]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const bgOf = (i: number): string | undefined => {
    const m = shown[i];
    return m ? (upsize(m.background) ?? m.poster) : undefined;
  };

  const safeActive = active < shown.length ? active : 0;
  const current = shown[safeActive];
  const target = slots[front] < shown.length ? slots[front] : 0;
  const logo = current ? (logos[current.id] ?? current.logo) : undefined;
  const year = (current?.releaseInfo ?? "").slice(0, 4);
  const inWl = useInWatchlist(current?.id);

  if (!current) return null;

  const open = () => (onOpenDetail ? onOpenDetail(current) : openOnHost(current));
  const src0 = bgOf(slots[0]);
  const src1 = bgOf(slots[1]);
  const layerTransition = reduce ? "none" : `opacity ${DISSOLVE_MS}ms ease-in-out`;

  return (
    <section className="flex flex-col gap-3">
      <div className="px-4">
        <div className="relative aspect-[16/13] w-full overflow-hidden rounded-[24px] bg-surface ring-1 ring-edge-soft/50">
          <button
            type="button"
            aria-label={`Open ${current.name}`}
            onClick={open}
            className="absolute inset-0 z-0 block h-full w-full text-start"
          >
            {src0 && (
              <img
                key="l0"
                src={src0}
                alt=""
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
                style={{ opacity: front === 0 ? 1 : 0, transition: layerTransition }}
              />
            )}
            {src1 && (
              <img
                key="l1"
                src={src1}
                alt=""
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
                style={{ opacity: front === 1 ? 1 : 0, transition: layerTransition }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-black/5" />
          </button>
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-3 p-5"
            style={{
              opacity: textOn ? 1 : 0,
              transform: textOn ? "translateY(0)" : "translateY(8px)",
              transition: reduce
                ? "none"
                : `opacity ${TEXT_MS}ms ease, transform ${TEXT_MS}ms ease`,
            }}
          >
            <span className="inline-flex items-center gap-1.5 self-start rounded-md bg-black/45 px-2.5 py-1 text-[11.5px] font-semibold text-white backdrop-blur-md">
              <TrendingUp size={12} strokeWidth={2.6} className="text-accent" />#{safeActive + 1} in{" "}
              {kindLabel(current.type)} Today
            </span>
            {logo ? (
              <img
                src={logo}
                alt={current.name}
                className="max-h-[62px] max-w-[74%] object-contain object-left drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)]"
              />
            ) : (
              <h2 className="font-display text-[30px] font-medium leading-[1.02] tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)]">
                {current.name}
              </h2>
            )}
            <div className="flex items-center gap-3 text-[13px] text-white/80">
              {year && <span className="font-medium">{year}</span>}
              {current.imdbRating && (
                <span className="flex items-center gap-1.5">
                  <ImdbIcon className="h-[15px] w-auto rounded-[3px]" />
                  <span className="font-semibold text-white">{current.imdbRating}</span>
                </span>
              )}
              {current.genres?.[0] && <span className="text-white/70">{current.genres[0]}</span>}
            </div>
            <div
              className={`mt-1 flex items-center gap-2.5 ${textOn ? "pointer-events-auto" : "pointer-events-none"}`}
            >
              <button
                type="button"
                onClick={() => playOnHost(current)}
                className="flex h-[52px] items-center gap-2.5 rounded-full bg-white px-8 text-[16px] font-semibold text-black shadow-[0_6px_20px_-6px_rgba(0,0,0,0.5)] transition-transform duration-150 active:scale-[0.97]"
              >
                <Play size={19} strokeWidth={0} fill="currentColor" />
                Play
              </button>
              <button
                type="button"
                aria-label={inWl ? "In My List" : "Add to My List"}
                onClick={() =>
                  toggleWatchlist({
                    id: current.id,
                    type: current.type,
                    name: current.name,
                    poster: current.poster,
                    addonOrigin: current.addonOrigin,
                    videos: current.videos,
                  })
                }
                className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border border-white/25 bg-black/35 text-white backdrop-blur-sm transition-transform duration-150 active:scale-[0.94]"
              >
                {inWl ? (
                  <Check size={20} strokeWidth={2.6} className="text-accent" />
                ) : (
                  <Plus size={21} strokeWidth={2.2} />
                )}
              </button>
              <button
                type="button"
                aria-label="More info"
                onClick={open}
                className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border border-white/25 bg-black/35 text-white backdrop-blur-sm transition-transform duration-150 active:scale-[0.94]"
              >
                <Info size={21} strokeWidth={2.2} />
              </button>
            </div>
          </div>
        </div>
      </div>
      {shown.length > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {shown.map((m, i) => (
            <button
              key={m.id}
              type="button"
              aria-label={`Show ${m.name}`}
              onClick={() => {
                pausedUntil.current = Date.now() + PILL_PAUSE_MS;
                goTo(i);
              }}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === target ? "w-5 bg-accent" : "w-1.5 bg-ink/20"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
