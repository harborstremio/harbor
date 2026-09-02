import { memo, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { needsImdbForPoster, needsTmdbForPoster, rpdbPoster } from "@/lib/providers/rpdb";
import { useTitlePoster } from "@/lib/title-poster";
import {
  tmdbIdFromImdb,
  tmdbImdbId,
  useTmdbIdFromImdb,
  useTmdbImdbId,
} from "@/lib/providers/tmdb/tmdb-imdb-resolve";
import { useSettings } from "@/lib/settings";
import { externalToKitsu, kitsuToImdb, kitsuToTvdb } from "@/lib/providers/anime-mapping";
import { tmdbLocalizedPoster } from "@/lib/providers/tmdb/tmdb-images";
import { sizeImageUrl, qualityMultiplier } from "@/lib/img-size";
import { shouldLocalizePosters } from "@/lib/providers/tmdb/tmdb-image-lang";
import { useProxiedImageSrc } from "@/lib/remote-image-proxy";

type Ratio = "portrait" | "landscape" | "wide";

export function useLocalizedPoster(metaId: string): {
  url: string | undefined;
  localizing: boolean;
} {
  const { settings } = useSettings();
  const [url, setUrl] = useState<string | undefined>(undefined);
  const [localizing, setLocalizing] = useState<boolean>(() => {
    const canResolve = metaId.startsWith("tmdb:") || metaId.startsWith("tt");
    return !!settings.tmdbKey && canResolve && shouldLocalizePosters();
  });
  useEffect(() => {
    setUrl(undefined);
    const canResolve = metaId.startsWith("tmdb:") || metaId.startsWith("tt");
    const active = !!settings.tmdbKey && canResolve && shouldLocalizePosters();
    setLocalizing(active);
    if (!active) return;
    let alive = true;
    void (async () => {
      const tmdbId = metaId.startsWith("tmdb:")
        ? metaId
        : await tmdbIdFromImdb(settings.tmdbKey, metaId);
      if (!alive) return;
      if (!tmdbId) {
        setLocalizing(false);
        return;
      }
      const localized = await tmdbLocalizedPoster(settings.tmdbKey, tmdbId);
      if (!alive) return;
      if (localized) setUrl(localized);
      setLocalizing(false);
    })();
    return () => {
      alive = false;
    };
  }, [metaId, settings.tmdbKey, settings.tmdbLanguage, settings.tmdbImageLangs]);
  return { url, localizing };
}

export function useRpdbAltId(
  rpdbKey: string,
  metaId: string,
  type?: "movie" | "series",
): { altId: string | undefined; pending: boolean } {
  const { settings } = useSettings();
  const wantImdb = needsImdbForPoster(rpdbKey, metaId);
  const wantTmdb = needsTmdbForPoster(rpdbKey, metaId);
  const imdb = useTmdbImdbId(wantImdb ? metaId : undefined);
  const tmdb = useTmdbIdFromImdb(wantTmdb ? metaId : undefined);
  useEffect(() => {
    if (wantImdb && settings.tmdbKey) void tmdbImdbId(settings.tmdbKey, metaId);
    if (wantTmdb && settings.tmdbKey) void tmdbIdFromImdb(settings.tmdbKey, metaId, type);
  }, [wantImdb, wantTmdb, settings.tmdbKey, metaId, type]);
  const pending =
    !!settings.tmdbKey && ((wantImdb && imdb === undefined) || (wantTmdb && tmdb === undefined));
  let altId: string | undefined;
  if (wantImdb && typeof imdb === "string" && imdb.startsWith("tt")) altId = imdb;
  else if (wantTmdb && typeof tmdb === "string") altId = tmdb;
  return { altId, pending };
}

function useAnimeRpdbIds(
  rpdbKey: string,
  metaId: string,
): { animeImdb?: string; animeTvdb?: string; animeTmdb?: string } {
  const { settings } = useSettings();
  const [animeImdb, setAnimeImdb] = useState<string>();
  const [animeTvdb, setAnimeTvdb] = useState<string>();
  const isAnime = /^(kitsu|mal|anilist|anidb):/.test(metaId);
  useEffect(() => {
    setAnimeImdb(undefined);
    setAnimeTvdb(undefined);
  }, [metaId]);
  useEffect(() => {
    if (!isAnime || (!rpdbKey && !settings.posterBaseUrl)) return;
    const m = metaId.match(/^(kitsu|mal|anilist|anidb):(\d+)/);
    if (!m) return;
    const source = m[1];
    const idNum = Number(m[2]);
    if (!Number.isFinite(idNum)) return;
    let cancelled = false;
    (async () => {
      let kitsuId: number | null = source === "kitsu" ? idNum : null;
      if (kitsuId == null) {
        const armSource = source === "mal" ? "myanimelist" : source;
        kitsuId = await externalToKitsu(armSource, idNum).catch(() => null);
      }
      if (cancelled || kitsuId == null) return;
      const [tt, tv] = await Promise.all([
        kitsuToImdb(kitsuId).catch(() => null),
        kitsuToTvdb(kitsuId).catch(() => null),
      ]);
      if (cancelled) return;
      if (tt) setAnimeImdb(tt);
      if (tv) setAnimeTvdb(String(tv));
    })();
    return () => {
      cancelled = true;
    };
  }, [metaId, isAnime, rpdbKey, settings.posterBaseUrl]);
  const animeTmdb = useTmdbIdFromImdb(animeImdb) ?? undefined;
  return { animeImdb, animeTvdb, animeTmdb };
}

export function usePosterChain(
  rpdbKey: string,
  metaId: string,
  metaPoster?: string,
  type?: "movie" | "series",
) {
  const { altId, pending } = useRpdbAltId(rpdbKey, metaId, type);
  const { animeImdb, animeTvdb, animeTmdb } = useAnimeRpdbIds(rpdbKey, metaId);
  const { url: localized, localizing } = useLocalizedPoster(metaId);
  const pinned = useTitlePoster(metaId);
  const candidates = useMemo(() => {
    if (pending && !pinned) return [];
    const base = localized ?? metaPoster;
    const out: string[] = [];
    const seen = new Set<string>();
    // While the localized poster is being resolved, hold the artwork instead of flashing the
    // original-language (e.g. Japanese) search poster, which then swaps to English once resolved.
    const fallbacks = localizing
      ? [pinned]
      : [
          animeImdb ? rpdbPoster(rpdbKey, animeImdb, base, animeTmdb) : undefined,
          animeTvdb ? rpdbPoster(rpdbKey, `tvdb:${animeTvdb}`, base) : undefined,
          rpdbPoster(rpdbKey, metaId, base, altId),
          localized,
          metaPoster,
        ];
    for (const u of [pinned, ...fallbacks]) {
      if (u && !seen.has(u)) {
        seen.add(u);
        out.push(u);
      }
    }
    return out;
  }, [
    rpdbKey,
    metaId,
    altId,
    metaPoster,
    animeImdb,
    animeTvdb,
    animeTmdb,
    localized,
    localizing,
    pending,
    pinned,
  ]);
  const sig = candidates.join("|");
  const failedRef = useRef<Set<string>>(new Set());
  const sigRef = useRef(sig);
  const [, bump] = useReducer((n: number) => n + 1, 0);
  if (sigRef.current !== sig) {
    sigRef.current = sig;
    failedRef.current = new Set();
  }
  const src = candidates.find((u) => !failedRef.current.has(u));
  return {
    src,
    onError: () => {
      if (src && !failedRef.current.has(src)) {
        failedRef.current.add(src);
        bump();
      }
    },
  };
}

// Height is reserved with an in-flow padding spacer (see render below) instead of
// relying solely on CSS `aspect-ratio`. Older WebView2/Chromium engines (≲124, e.g.
// the 123.x runtime shipped on debloated Windows builds) fail to size `aspect-ratio`
// grid items, collapsing every poster card to 0px height so artwork never shows.
// The padding-top hack works identically on every engine.
// https://github.com/harborstremio/harbor/issues/403
const ASPECT_PAD: Record<Ratio, string> = {
  portrait: "150%", // 3 / 2
  landscape: "56.25%", // 9 / 16
  wide: "43.75%", // 7 / 16
};

const RATIO_AR: Record<Ratio, number> = {
  portrait: 2 / 3,
  landscape: 16 / 9,
  wide: 16 / 7,
};

function PosterBody({
  src,
  seed,
  ratio = "portrait",
  className = "",
  children,
  onError,
  lazy = false,
  fallbacks,
}: {
  src?: string;
  seed: string;
  lowResImdb?: string;
  ratio?: Ratio;
  className?: string;
  children?: React.ReactNode;
  onError?: () => void;
  lazy?: boolean | "release";
  fallbacks?: Array<string | null | undefined>;
}) {
  const { settings } = useSettings();
  const effect = settings.posterEffect;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(!lazy);
  const [eager, setEager] = useState(!lazy);
  const [targetPx, setTargetPx] = useState(0);
  const qMult = qualityMultiplier(settings.posterQuality);
  useEffect(() => {
    if (inView) return;
    const el = rootRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries.find((x) => x.isIntersecting);
        if (!e) return;
        const r = e.boundingClientRect;
        if (r.top < (window.innerHeight || 0) && r.bottom > 0) setEager(true);
        setInView(true);
        obs.disconnect();
      },
      { rootMargin: "1200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [inView]);
  useEffect(() => {
    if (!lazy || eager || !inView) return;
    const el = rootRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((x) => x.isIntersecting)) {
          setEager(true);
          obs.disconnect();
        }
      },
      { rootMargin: "150px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [lazy, eager, inView]);
  useEffect(() => {
    if (!inView || qMult === 0) return;
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      if (box.width <= 0) return;
      const need = Math.max(box.width, box.height * RATIO_AR[ratio]);
      // Capped at 2. An Android TV WebView reports devicePixelRatio 4 because it is
      // describing the 4K panel, while the window it rasterises is 1920x1080, so the
      // raw value asks for a bucket twice as wide and four times the pixels.
      const t = Math.ceil(need * Math.min(2, window.devicePixelRatio || 1) * qMult);
      setTargetPx((prev) => (t > prev ? t : prev));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [inView, qMult, ratio]);
  const rawCandidates = [src, ...(fallbacks ?? [])].filter((u): u is string => !!u);
  const candidates =
    qMult === 0 || targetPx <= 0
      ? rawCandidates
      : rawCandidates.map((u) => sizeImageUrl(u, targetPx));
  const sig = candidates.join("|");
  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [displayed, setDisplayed] = useState<string | undefined>(undefined);
  const [retry, setRetry] = useState(0);
  const failedRef = useRef<Set<string>>(new Set());
  const firedRef = useRef(false);
  const failBurstRef = useRef<{ t: number; n: number }>({ t: 0, n: 0 });
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  useEffect(() => {
    setIdx(0);
    setLoaded(false);
    setRetry(0);
    failedRef.current = new Set();
    firedRef.current = false;
  }, [sig]);

  useEffect(() => {
    if (lazy !== "release") return;
    const el = rootRef.current;
    if (!el) return;
    let timer = 0;
    const obs = new IntersectionObserver(
      (entries) => {
        const inside = entries.some((x) => x.isIntersecting);
        if (inside) {
          if (timer) {
            window.clearTimeout(timer);
            timer = 0;
          }
          return;
        }
        if (timer) return;
        timer = window.setTimeout(() => {
          timer = 0;
          if (el.closest("a,button,[tabindex]") === document.activeElement) return;
          setInView(false);
          setEager(false);
          setLoaded(false);
          setDisplayed(undefined);
        }, 1500);
      },
      { rootMargin: "2400px" },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      if (timer) window.clearTimeout(timer);
    };
  }, [lazy]);

  let cursor = idx;
  while (cursor < candidates.length && failedRef.current.has(candidates[cursor])) cursor++;
  const current: string | undefined = candidates[cursor];
  const exhausted = cursor >= candidates.length;
  // Remote plain-HTTP images (e.g. a Suwayomi server on a VPS) are mixed-content
  // blocked by the WebView; resolve them to a same-origin blob URL.
  const currentSrc = useProxiedImageSrc(current);
  const displayedSrc = useProxiedImageSrc(displayed);

  useEffect(() => {
    if (exhausted && !firedRef.current) {
      firedRef.current = true;
      onErrorRef.current?.();
    }
  }, [exhausted]);

  useEffect(() => {
    if (!exhausted) return;
    const retryNow = () => {
      failedRef.current = new Set();
      firedRef.current = false;
      setIdx(0);
      setRetry((r) => r + 1);
    };
    window.addEventListener("online", retryNow);
    const timer = retry < 4 ? window.setTimeout(retryNow, 1200 * 2 ** retry) : undefined;
    return () => {
      window.removeEventListener("online", retryNow);
      if (timer) window.clearTimeout(timer);
    };
  }, [exhausted, retry]);

  const fail = useCallback((url: string) => {
    const now = Date.now();
    const b = failBurstRef.current;
    if (now - b.t > 1000) {
      b.t = now;
      b.n = 0;
    }
    if (++b.n > 24) return;
    if (failedRef.current.has(url)) return;
    failedRef.current.add(url);
    setLoaded(false);
    setIdx((i) => i + 1);
  }, []);
  const currentRef = useRef(current);
  currentRef.current = current;
  const imgElRef = useRef<HTMLImageElement | null>(null);
  const handleImgRef = useCallback(
    (el: HTMLImageElement | null) => {
      imgElRef.current = el;
      if (!el) return;
      if (el.complete) {
        if (el.naturalWidth > 0) {
          setLoaded(true);
          setDisplayed(currentRef.current);
        } else if (currentRef.current) fail(currentRef.current);
        return;
      }
      const target = currentRef.current;
      el.decode().then(
        () => {
          if (imgElRef.current === el && currentRef.current === target && target) {
            setLoaded(true);
            setDisplayed(target);
          }
        },
        () => {},
      );
    },
    [fail],
  );
  useEffect(() => {
    if (loaded || !current) return;
    const el = imgElRef.current;
    if (el && el.complete && el.naturalWidth > 0) {
      setLoaded(true);
      setDisplayed(current);
    }
  }, [loaded, current, sig]);
  const showShimmer = !displayed && !loaded && !exhausted;
  const showPlate = !displayed && exhausted;
  const hasBase = !!displayed && displayed !== current;
  const hue = hash(seed) % 360;

  return (
    <div
      ref={rootRef}
      className={`harbor-poster your-card relative w-full overflow-hidden rounded-[var(--poster-radius,12px)] ${className}`}
      style={showPlate ? { background: gradient(hue) } : undefined}
    >
      <div aria-hidden style={{ paddingTop: ASPECT_PAD[ratio] }} />
      {showShimmer && <span aria-hidden className="harbor-shimmer absolute inset-0" />}
      {displayed && displayed !== current && displayedSrc && (
        <img
          src={displayedSrc}
          alt=""
          aria-hidden
          draggable={false}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {current && currentSrc && inView && (qMult === 0 || targetPx > 0) && (
        <img
          key={current}
          ref={handleImgRef}
          src={currentSrc}
          alt=""
          draggable={false}
          decoding="async"
          fetchPriority={eager ? "high" : undefined}
          onLoad={() => {
            setLoaded(true);
            setDisplayed(current);
          }}
          onError={() => fail(current)}
          className="absolute inset-0 h-full w-full object-cover"
          style={
            effect === "off"
              ? { opacity: 1 }
              : {
                  opacity: loaded ? 1 : 0,
                  transition: hasBase ? "opacity 300ms ease-out" : undefined,
                }
          }
        />
      )}
      {children}
    </div>
  );
}

// Every arrow press on the Big Picture taste grid re-ran 40 Poster bodies for
// props whose values had not changed, and a MutationObserver recorded no DOM
// change from any of them. Call sites that pass children or onError inline will
// still re-render; those are fresh objects every time by construction.
export const Poster = memo(PosterBody);

export function posterPlate(seed: string): string {
  return gradient(hash(seed) % 360);
}

function gradient(hue: number) {
  const a = hue;
  const b = (hue + 140) % 360;
  const c = (hue + 60) % 360;
  return `
    radial-gradient(ellipse at 25% 30%, oklch(0.45 0.14 ${a}) 0%, transparent 55%),
    radial-gradient(ellipse at 75% 75%, oklch(0.32 0.10 ${b}) 0%, transparent 55%),
    linear-gradient(135deg, oklch(0.20 0.05 ${c}), oklch(0.10 0.02 ${b}))
  `;
}

function hash(s: string) {
  const str = typeof s === "string" ? s : "";
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
  return Math.abs(h);
}
