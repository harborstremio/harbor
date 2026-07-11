import type { Meta } from "../cinemeta";
import { animeKitsuMeta } from "../providers/anime-kitsu-addon";
import { omdbScoresCached } from "../providers/omdb";
import { tmdbImdbCached } from "../providers/tmdb";
import { tmdbLiteMeta } from "../providers/tmdb/tmdb-lite";
import { resolveResume, type PreviewResume } from "./resume-index";
import { previewMeta } from "./synopsis-cache";
import { LATE_ART_SWAP_WINDOW_MS } from "./timing";

export type PreviewArt = { mode: "backdrop" | "poster" | "plate"; src?: string };

export type PreviewData = {
  meta: Meta;
  art: PreviewArt;
  chip: "In Cinema" | "New" | null;
  rating: { kind: "mal" | "imdb" | "tmdb"; value: string } | null;
  year: string | null;
  length: string | null;
  genre: string | null;
  synopsis: string | null;
  resume: PreviewResume | null;
};

export type PreviewAssembly = {
  meta: Meta;
  isFinal: () => boolean;
  data: () => PreviewData;
  onFinal: (cb: () => void) => void;
  markOpened: (onUpgrade: (art: PreviewArt) => void) => void;
  cancel: () => void;
};

const ANIME_ID = /^(kitsu|mal|anilist|anidb):/;

let previewTmdbKey = "";

export function setPreviewTmdbKey(key: string): void {
  previewTmdbKey = key;
}

export function rewriteTmdbRung(url: string): string {
  return url.replace(/\/t\/p\/[^/]+\//, "/t/p/w780/");
}

const primed = new Set<string>();
let primeQueue: Promise<void> = Promise.resolve();

function primeImage(url: string, isCancelled: () => boolean): Promise<boolean> {
  if (primed.has(url)) return Promise.resolve(true);
  return new Promise((resolve) => {
    primeQueue = primeQueue.then(() => {
      if (isCancelled()) {
        resolve(false);
        return;
      }
      if (primed.has(url)) {
        resolve(true);
        return;
      }
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      return img.decode().then(
        () => {
          primed.add(url);
          resolve(true);
        },
        () => resolve(false),
      );
    });
  });
}

function deriveChip(meta: Meta): "In Cinema" | "New" | null {
  const inCinema = meta.type === "movie" && meta.inTheaters === true;
  const rerun = inCinema && isRerunMeta(meta);
  if (inCinema && !rerun) return "In Cinema";
  if (!inCinema && meta.releaseInfo === String(new Date().getFullYear())) return "New";
  return null;
}

function isRerunMeta(meta: Meta): boolean {
  if (!meta.releaseDate) return false;
  const released = Date.parse(meta.releaseDate);
  if (Number.isNaN(released)) return false;
  const monthsOld = (Date.now() - released) / (1000 * 60 * 60 * 24 * 30.44);
  return monthsOld > 9;
}

function deriveLength(meta: Meta): string | null {
  if (meta.type === "series") {
    const seasons = new Set<number>();
    for (const v of meta.videos ?? []) {
      if (typeof v.season === "number" && v.season >= 1) seasons.add(v.season);
    }
    if (seasons.size === 0) return null;
    return seasons.size === 1 ? "1 season" : `${seasons.size} seasons`;
  }
  return meta.runtime?.trim() ? meta.runtime.trim() : null;
}

function deriveRating(meta: Meta, isAnime: boolean): PreviewData["rating"] {
  if (isAnime) {
    return meta.imdbRating ? { kind: "mal", value: meta.imdbRating } : null;
  }
  const imdbId = meta.id.startsWith("tt") ? meta.id : (tmdbImdbCached(meta.id) ?? undefined);
  const real = imdbId ? omdbScoresCached(imdbId)?.imdbRating : undefined;
  if (real) return { kind: "imdb", value: real };
  if (meta.imdbRating) {
    return { kind: meta.id.startsWith("tt") ? "imdb" : "tmdb", value: meta.imdbRating };
  }
  return null;
}

export function assemblePreviewData(meta: Meta): PreviewAssembly {
  let cancelled = false;
  let opened = false;
  let openedAt = 0;
  let upgradeCb: ((art: PreviewArt) => void) | null = null;
  const finalCbs: Array<() => void> = [];

  const isAnime = ANIME_ID.test(meta.id);
  const isTmdb = meta.id.startsWith("tmdb:");
  const isTt = meta.id.startsWith("tt");

  const resume = resolveResume(meta);
  const chip = deriveChip(meta);
  const rating = deriveRating(meta, isAnime);
  const year = meta.releaseInfo?.trim() ? meta.releaseInfo.trim() : null;
  const length = deriveLength(meta);
  const genre = meta.genres?.[0] ?? null;

  let synopsis: string | null = meta.description?.trim() ? meta.description.trim() : null;
  let synopsisFinal = true;

  const posterUrl = meta.poster ? rewriteTmdbRung(meta.poster) : null;
  let backdropSrc: string | null = null;
  let posterSrc: string | null = null;
  let backdropPending = false;
  let posterPending = false;

  const isCancelled = () => cancelled;
  const artSettled = () => !backdropPending && !posterPending;

  const settle = () => {
    if (cancelled) return;
    if (artSettled() && synopsisFinal) for (const cb of finalCbs.splice(0)) cb();
  };

  const tryPoster = () => {
    if (!posterUrl || posterSrc || posterPending) {
      settle();
      return;
    }
    posterPending = true;
    void primeImage(posterUrl, isCancelled).then((ok) => {
      posterPending = false;
      if (ok) posterSrc = posterUrl;
      if (!opened) settle();
    });
  };

  const tryBackdrop = (raw?: string | null) => {
    const url = raw ? rewriteTmdbRung(raw) : null;
    if (!url) {
      backdropPending = false;
      tryPoster();
      return;
    }
    backdropPending = true;
    void primeImage(url, isCancelled).then((ok) => {
      backdropPending = false;
      if (cancelled && !opened) return;
      if (!ok) {
        tryPoster();
        return;
      }
      backdropSrc = url;
      if (!opened) {
        settle();
        return;
      }
      if (upgradeCb && Date.now() - openedAt <= LATE_ART_SWAP_WINDOW_MS) {
        const cb = upgradeCb;
        upgradeCb = null;
        cb({ mode: "backdrop", src: url });
      }
    });
  };

  const kitsuFetch = isAnime && (!meta.background || !synopsis) ? animeKitsuMeta(meta.id).catch(() => null) : null;
  const ttFetch = isTt && !synopsis ? previewMeta(meta.type, meta.id) : null;

  if (!synopsis && kitsuFetch) {
    synopsisFinal = false;
    void kitsuFetch.then((m) => {
      if (m?.description?.trim()) synopsis = m.description.trim();
      synopsisFinal = true;
      settle();
    });
  } else if (!synopsis && ttFetch) {
    synopsisFinal = false;
    void ttFetch.then((pm) => {
      if (pm?.description?.trim()) synopsis = pm.description.trim();
      synopsisFinal = true;
      settle();
    });
  }

  if (meta.background) {
    tryBackdrop(meta.background);
  } else if (kitsuFetch) {
    backdropPending = true;
    void kitsuFetch.then((m) => tryBackdrop(m?.background ?? null));
  } else if (isTmdb) {
    backdropPending = true;
    void tmdbLiteMeta(previewTmdbKey, meta.id)
      .catch(() => null)
      .then((m) => tryBackdrop(m?.background ?? null));
  } else if (ttFetch) {
    backdropPending = true;
    void ttFetch.then((pm) => tryBackdrop(pm?.background ?? null));
  } else {
    tryPoster();
  }

  const currentArt = (): PreviewArt =>
    backdropSrc
      ? { mode: "backdrop", src: backdropSrc }
      : posterSrc
        ? { mode: "poster", src: posterSrc }
        : { mode: "plate" };

  return {
    meta,
    isFinal: () => artSettled() && synopsisFinal,
    data: () => ({
      meta,
      art: currentArt(),
      chip,
      rating,
      year,
      length,
      genre,
      synopsis,
      resume,
    }),
    onFinal: (cb) => {
      finalCbs.push(cb);
    },
    markOpened: (onUpgrade) => {
      opened = true;
      openedAt = Date.now();
      if (currentArt().mode !== "backdrop") upgradeCb = onUpgrade;
    },
    cancel: () => {
      cancelled = true;
      finalCbs.length = 0;
      upgradeCb = null;
    },
  };
}
