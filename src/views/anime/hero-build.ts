import { findTopAward, parseAwardYear } from "@/lib/anime-awards";
import { resolveHeroArt, type HeroArt } from "@/lib/anime-backdrop";
import { animeFiltered, enrichAnimeCountry, type AnimeFilterOpts } from "@/lib/anime-filter";
import type { Meta } from "@/lib/cinemeta";
import { franchiseRootSync, prefetchFranchiseRoot } from "@/lib/providers/anime-franchise-root";
import { animeKitsuMeta } from "@/lib/providers/anime-kitsu-addon";
import { stripFranchiseSuffix } from "@/lib/providers/jikan";
import { SPECS, type RowState } from "./anime-rows";

export type HeroBuilt = { metas: Meta[]; trending: Record<string, string> };

const isAnimeId = (id: string) => /^(kitsu|mal|anilist|anidb):/.test(id);

const HERO_CACHE_KEY = "harbor.anime.hero.v2";
const HERO_TTL_MS = 3 * 60 * 60 * 1000;
const HERO_DESC_MAX = 320;

let heroMem: { built: HeroBuilt; t: number; sig: string } | null = null;

export function readCachedHero(sig: string): HeroBuilt | null {
  if (heroMem && heroMem.sig === sig && heroMem.built.metas.length) return heroMem.built;
  try {
    const raw = localStorage.getItem(HERO_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { built: HeroBuilt; t: number; sig?: string };
    if (!parsed?.built?.metas?.length || parsed.sig !== sig) return null;
    heroMem = { built: parsed.built, t: parsed.t, sig };
    return parsed.built;
  } catch {
    return null;
  }
}

export function isHeroCacheFresh(sig: string): boolean {
  return !!heroMem && heroMem.sig === sig && Date.now() - heroMem.t < HERO_TTL_MS;
}

export function cacheHero(built: HeroBuilt, sig: string): void {
  heroMem = { built, t: Date.now(), sig };
  try {
    const slim: HeroBuilt = {
      trending: built.trending,
      metas: built.metas.map((m) =>
        m.description && m.description.length > HERO_DESC_MAX
          ? { ...m, description: `${m.description.slice(0, HERO_DESC_MAX)}...` }
          : m,
      ),
    };
    localStorage.setItem(HERO_CACHE_KEY, JSON.stringify({ built: slim, t: heroMem.t, sig }));
  } catch {
    /* ignore */
  }
}

function cleanMeta(m: Meta): Meta {
  const cleaned = stripFranchiseSuffix(m.name);
  return cleaned === m.name ? m : { ...m, name: cleaned };
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildHeroSelection(
  rowsByKey: Record<string, RowState>,
  seed: number,
  filterOpts: AnimeFilterOpts,
  anilistTrending: Meta[],
): HeroBuilt {
  const keep = (m: Meta) => !animeFiltered(m, filterOpts);
  const rng = mulberry32(seed);
  const shuffle = <T>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const withBg = (key: string): Meta[] => {
    const r = rowsByKey[key];
    return r && r.ready ? r.metas.filter((m) => m.background && keep(m)) : [];
  };
  const allWithBg = new Map<string, Meta>();
  for (const spec of SPECS) {
    const r = rowsByKey[spec.key];
    if (!r || !r.ready) continue;
    for (const m of r.metas)
      if (m.background && keep(m) && !allWithBg.has(m.id)) allWithBg.set(m.id, m);
  }
  const isWinner = (m: Meta) => !!findTopAward(m.name, parseAwardYear(m.releaseInfo));
  const anilistWithBg = anilistTrending.filter((m) => m.background && keep(m));
  const winners = shuffle([...allWithBg.values(), ...anilistWithBg].filter(isWinner));
  const trending = shuffle(withBg("top-airing"));
  const popular = shuffle(withBg("popular"));
  const airing = shuffle(withBg("airing"));
  const anilistTrend = shuffle(anilistWithBg);

  const out: Meta[] = [];
  const trendingIds: Record<string, string> = {};
  const seen = new Set<string>();
  const take = (list: Meta[], n: number, source?: string) => {
    let taken = 0;
    for (const m of list) {
      if (taken >= n || out.length >= 12) break;
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      if (source && !isWinner(m)) trendingIds[m.id] = source;
      out.push(cleanMeta(m));
      taken += 1;
    }
  };
  take(winners, 2);
  take(anilistTrend, 2, "AniList");
  take(trending, 2, "MAL");
  take(airing, 2, "MAL");
  take(popular, 1, "MAL");
  take(anilistTrend, 3, "AniList");
  take(trending, 3, "MAL");
  take(airing, 3, "MAL");
  take(shuffle([...allWithBg.values(), ...anilistTrend]), 12);
  return { metas: shuffle(out), trending: trendingIds };
}

export function buildHostedHero(
  items: Array<Meta & { source?: string }>,
  seed: number,
  filterOpts: AnimeFilterOpts,
): HeroBuilt {
  const rng = mulberry32(seed);
  const shuffle = <T>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const keep = (m: Meta) => !animeFiltered(m, filterOpts) && !!m.background;
  const pool = items.filter(keep);
  const isWinner = (m: Meta) => !!findTopAward(m.name, parseAwardYear(m.releaseInfo));
  const winners = shuffle(pool.filter(isWinner));
  const airing = shuffle(pool.filter((m) => m.source === "Airing" && !isWinner(m)));
  const rest = shuffle(pool.filter((m) => m.source !== "Airing" && !isWinner(m)));

  const out: Meta[] = [];
  const trending: Record<string, string> = {};
  const seen = new Set<string>();
  const take = (list: Meta[], n: number, label?: string) => {
    let taken = 0;
    for (const m of list) {
      if (taken >= n || out.length >= 8) break;
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      if (label && !isWinner(m)) trending[m.id] = label;
      out.push(cleanMeta(m));
      taken += 1;
    }
  };
  take(winners, 1);
  take(airing, 2, "AniList");
  take(rest, 3, "AniList");
  take(winners, 1);
  take([...airing, ...rest], 8, "AniList");
  return { metas: shuffle(out), trending };
}

type HeroPick = { meta: Meta; rootId: string; src?: string };

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);
}

async function pickHeroRoots(built: HeroBuilt, filterOpts: AnimeFilterOpts): Promise<HeroPick[]> {
  const enriched = await enrichAnimeCountry(built.metas);
  const filtered = enriched.filter((m) => !animeFiltered(m, filterOpts));
  const seen = new Set<string>();
  const picks: HeroPick[] = [];
  for (const m of filtered) {
    if (isAnimeId(m.id)) prefetchFranchiseRoot(m.id);
    const rootId = (isAnimeId(m.id) ? franchiseRootSync(m.id) : null) ?? m.id;
    if (seen.has(rootId)) continue;
    seen.add(rootId);
    picks.push({ meta: m, rootId, src: built.trending[m.id] });
  }
  return picks.slice(0, 6);
}

function preloadImage(url?: string): Promise<void> {
  if (!url || typeof Image === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    const img = new Image();
    img.onload = finish;
    img.onerror = finish;
    img.src = url;
    setTimeout(finish, 1500);
  });
}

async function hydrateSlide(
  tmdbKey: string,
  pick: HeroPick,
): Promise<{ meta: Meta; src?: string }> {
  const { meta, rootId } = pick;
  let slide: Meta = meta;
  if (rootId !== meta.id) {
    const rootMeta = await withTimeout(
      animeKitsuMeta(rootId).catch(() => null),
      2000,
      null,
    );
    slide = rootMeta
      ? {
          ...rootMeta,
          id: rootId,
          background: rootMeta.background ?? meta.background,
          poster: rootMeta.poster ?? meta.poster,
        }
      : { ...meta, id: rootId };
  }
  const hasBanner = !!slide.background && slide.background !== slide.poster;
  const art: HeroArt = await withTimeout(
    resolveHeroArt(tmdbKey, slide).catch(() => ({}) as HeroArt),
    hasBanner ? 2200 : 4000,
    {},
  );
  const background =
    (hasBanner ? slide.background : art.background) ?? slide.background ?? slide.poster;
  await preloadImage(background);
  return { meta: { ...slide, background, logo: art.logo ?? slide.logo }, src: pick.src };
}

export async function resolveHeroSlides(
  tmdbKey: string,
  built: HeroBuilt,
  filterOpts: AnimeFilterOpts,
  onProgress: (r: HeroBuilt) => void,
): Promise<void> {
  const picks = await pickHeroRoots(built, filterOpts);
  if (picks.length === 0) return;
  const slides: Meta[] = [];
  const trending: Record<string, string> = {};
  const emit = () => onProgress({ metas: [...slides], trending: { ...trending } });
  const first = await hydrateSlide(tmdbKey, picks[0]);
  slides.push(first.meta);
  if (first.src) trending[first.meta.id] = first.src;
  emit();
  const rest = await Promise.all(picks.slice(1).map((p) => hydrateSlide(tmdbKey, p)));
  for (const r of rest) {
    slides.push(r.meta);
    if (r.src) trending[r.meta.id] = r.src;
  }
  emit();
}
