import { useEffect, useMemo, useState } from "react";
import { lruSet } from "@/lib/cache";
import type { Meta } from "@/lib/cinemeta";
import { useSettings } from "@/lib/settings";
import { aniZipByImdb, aniZipByKitsu, type AniZipMapping } from "@/lib/providers/anizip";
import { kitsuToTvdb } from "@/lib/providers/anime-mapping";
import { parseKitsuId } from "@/lib/providers/kitsu";
import { tmdbIdFromImdb, tmdbImdbId, tmdbSeasonEpisodes } from "@/lib/providers/tmdb";
import { IMG, tmdbLanguageIso } from "@/lib/providers/tmdb/tmdb-client";
import { tvdbLangFromIso1, tvdbSeriesByRemote } from "@/lib/providers/tvdb";
import { fetchTvdbOrderBySeriesId, type TvdbOrder } from "@/lib/providers/tvdb-order";
import { fetchTvdbProxyImages, pickTvdbImage, type TvdbImageMap } from "@/lib/providers/tvdb-proxy";
import { bpBoxPx, bpCardArt } from "./bp-art";
import { BP_EPISODE_BOX } from "./bp-episode-still";

export type BpEpisodeArtRef = {
  key: string;
  season: number;
  episode: number;
  absoluteNumber?: number;
  still?: string;
};

const MEMO_MAX = 60;

const memo = new Map<string, Promise<unknown>>();

// A resolved answer is reused for the session so stepping back into a season on
// a D-pad never refires the request. A rejection is dropped so it can retry.
function once<T>(slot: string, run: () => Promise<T>): Promise<T> {
  const hit = memo.get(slot) as Promise<T> | undefined;
  if (hit) return hit;
  const p = run();
  lruSet(memo, slot, p as Promise<unknown>, MEMO_MAX);
  void p.catch(() => memo.delete(slot));
  return p;
}

function directImdb(metaId: string): string | null {
  return metaId.startsWith("tt") ? metaId.split(":")[0] : null;
}

function directTmdbTv(metaId: string): number | null {
  const m = /^tmdb:tv:(\d+)$/.exec(metaId);
  return m ? Number(m[1]) : null;
}

function episodeArtWidth(hd: boolean): number {
  const drawn = bpBoxPx(BP_EPISODE_BOX);
  return hd ? drawn : drawn / 2;
}

function tmdbStill(path: string, hd: boolean): string {
  if (path.startsWith("http")) return path;
  const full = `${IMG}/original${path}`;
  return bpCardArt(full, episodeArtWidth(hd)) ?? full;
}

function metahubStill(imdb: string | null, season: number, episode: number): string | undefined {
  if (!imdb?.startsWith("tt")) return undefined;
  return `https://episodes.metahub.space/${imdb}/${season}/${episode}/w780.jpg`;
}

type AniZipArt = {
  byPair: Map<string, string>;
  byNumber: Map<number, string>;
  pairByNumber: Map<number, { season: number; episode: number }>;
};

function aniZipArt(mapping: AniZipMapping | null): AniZipArt {
  const art: AniZipArt = { byPair: new Map(), byNumber: new Map(), pairByNumber: new Map() };
  for (const [key, ep] of Object.entries(mapping?.episodes ?? {})) {
    const n = Number(key);
    const abs = ep.absoluteEpisodeNumber;
    if (ep.image) {
      if (Number.isFinite(n)) art.byNumber.set(n, ep.image);
      if (abs != null) art.byNumber.set(abs, ep.image);
      if (ep.seasonNumber != null && ep.episodeNumber != null) {
        art.byPair.set(`${ep.seasonNumber}:${ep.episodeNumber}`, ep.image);
      }
    }
    if (ep.seasonNumber == null || ep.seasonNumber < 1 || ep.episodeNumber == null) continue;
    const pair = { season: ep.seasonNumber, episode: ep.episodeNumber };
    if (Number.isFinite(n)) art.pairByNumber.set(n, pair);
    if (abs != null) art.pairByNumber.set(abs, pair);
  }
  return art;
}

// Absolute lookups lead for anime, where the season the meta reports is a
// constant 1 and only the running number identifies the episode. On a real
// multi-season series they must not lead: abs5 would answer S2E5 with the still
// from S1E5.
function orderStill(
  order: TvdbOrder | null,
  season: number,
  episode: number,
  abs: number | null,
  absFirst: boolean,
): string | undefined {
  if (!order) return undefined;
  const byAbs = abs != null ? order.imageByAbs.get(abs) : undefined;
  if (absFirst && byAbs) return byAbs;
  const hit = order.bySeason.get(season)?.find((e) => e.episodeNumber === episode);
  return hit?.stillUrl ?? byAbs;
}

// pickTvdbImage falls back to `absoluteNumber ?? number` and tries abs first, so
// handing it an episode with no absolute number resolves a cour two episode five
// against abs5 and paints the series premiere's still. It only runs with a real
// absolute number in hand.
function proxyStill(
  map: TvdbImageMap,
  season: number,
  episode: number,
  abs: number | null,
  absFirst: boolean,
): string | undefined {
  if (absFirst && abs != null) {
    return (
      pickTvdbImage(map, { seasonNumber: season, number: episode, absoluteNumber: abs }) ?? undefined
    );
  }
  return map[`s${season}e${episode}`] ?? (abs != null ? map[`abs${abs}`] : undefined);
}

function ladder(candidates: Array<string | undefined>, hd: boolean): string[] {
  const want = episodeArtWidth(hd);
  const out: string[] = [];
  for (const url of candidates) {
    if (!url) continue;
    const sized = bpCardArt(url, want) ?? url;
    if (out.includes(sized)) continue;
    out.push(sized);
  }
  return out;
}

export function useBpEpisodeArt(
  meta: Meta,
  episodes: BpEpisodeArtRef[],
  season: number,
): Map<string, string[]> {
  const { settings } = useSettings();
  const tmdbKey = settings.tmdbKey;
  const tvdbKey = settings.tvdbKey;
  const seasonType = settings.tvdbSeasonType;
  const hd = settings.hdEpisodeImages;
  const kitsuId = parseKitsuId(meta.id);

  const [imdbId, setImdbId] = useState<string | null>(() => directImdb(meta.id));
  const [tvId, setTvId] = useState<number | null>(() => directTmdbTv(meta.id));
  const [tmdb, setTmdb] = useState<Record<string, string>>({});
  const [order, setOrder] = useState<TvdbOrder | null>(null);
  const [proxy, setProxy] = useState<TvdbImageMap>({});
  const [aniZip, setAniZip] = useState<AniZipMapping | null>(null);

  useEffect(() => {
    const imdb = directImdb(meta.id);
    const tv = directTmdbTv(meta.id);
    setImdbId(imdb);
    setTvId(tv);
    setTmdb({});
    setOrder(null);
    setProxy({});
    setAniZip(null);
    if (!tmdbKey) return;
    let alive = true;
    if (!imdb && tv != null) {
      void once(`imdb:${meta.id}`, () => tmdbImdbId(tmdbKey, meta.id))
        .then((r) => {
          if (alive && r) setImdbId(r);
        })
        .catch(() => {});
    }
    if (tv == null && imdb) {
      void once(`tv:${imdb}`, () => tmdbIdFromImdb(tmdbKey, imdb, "series"))
        .then((r) => {
          const n = r?.startsWith("tmdb:tv:") ? Number(r.slice("tmdb:tv:".length)) : NaN;
          if (alive && Number.isFinite(n)) setTvId(n);
        })
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [meta.id, tmdbKey]);

  useEffect(() => {
    if (!tmdbKey || tvId == null || season <= 0) return;
    let alive = true;
    const lang = tmdbLanguageIso() || "en";
    void once(`eps:${tvId}:${season}:${lang}`, () => tmdbSeasonEpisodes(tmdbKey, tvId, season))
      .then((list) => {
        if (!alive) return;
        const out: Record<string, string> = {};
        for (const e of list) {
          if (!e.stillPath) continue;
          out[`${e.seasonNumber}:${e.episodeNumber}`] = tmdbStill(e.stillPath, hd);
        }
        if (Object.keys(out).length === 0) return;
        setTmdb((prev) => ({ ...prev, ...out }));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tmdbKey, tvId, season, hd]);

  const gaps = useMemo(
    () => episodes.some((e) => !e.still && !tmdb[`${e.season}:${e.episode}`]),
    [episodes, tmdb],
  );

  // Below TMDB nothing is paid for until a card in view is actually missing art.
  // Anime is the exception: ani.zip is not a gap filler there, it is the source
  // the kitsu thumbnail is meant to be replaced by, so it is always fetched.
  useEffect(() => {
    const anime = kitsuId != null;
    if (!gaps && !anime) return;
    const slot = anime ? `kitsu:${kitsuId}` : imdbId ? `imdb:${imdbId}` : "";
    if (!slot) return;
    let alive = true;
    void once(`anizip:${slot}`, () =>
      kitsuId != null
        ? aniZipByKitsu(kitsuId)
        : imdbId
          ? aniZipByImdb(imdbId)
          : Promise.resolve(null),
    )
      .then((m) => {
        if (alive && m) setAniZip(m);
      })
      .catch(() => {});
    if (!gaps) {
      return () => {
        alive = false;
      };
    }
    void once(`proxy:${slot}:${seasonType}`, () =>
      fetchTvdbProxyImages({ imdb: imdbId, kitsuId, type: seasonType }),
    )
      .then((m) => {
        if (alive) setProxy(m);
      })
      .catch(() => {});
    if (tvdbKey) {
      void once(`order:${slot}:${seasonType}:k`, async () => {
        let seriesId = kitsuId != null ? await kitsuToTvdb(kitsuId).catch(() => null) : null;
        if (seriesId == null && imdbId) {
          seriesId = await tvdbSeriesByRemote(tvdbKey, imdbId).catch(() => null);
        }
        if (seriesId == null) return null;
        const lang = tvdbLangFromIso1(tmdbLanguageIso());
        return fetchTvdbOrderBySeriesId(tvdbKey, seriesId, seasonType, lang);
      })
        .then((o) => {
          if (alive && o) setOrder(o);
        })
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [gaps, imdbId, kitsuId, seasonType, tvdbKey]);

  return useMemo(() => {
    const out = new Map<string, string[]>();
    const az = aniZipArt(aniZip);
    const seriesImdb = imdbId ?? aniZip?.mappings?.imdb_id ?? null;
    const anime = kitsuId != null;
    for (const ep of episodes) {
      const pair = `${ep.season}:${ep.episode}`;
      // Only a season one number can stand in for an absolute one. A mapped cour
      // two episode five is not absolute five, and guessing it here paints the
      // series premiere's still onto the second cour.
      const abs = ep.absoluteNumber ?? (ep.season === 1 ? ep.episode : null);
      const azPair = abs != null ? az.pairByNumber.get(abs) : undefined;
      out.set(
        ep.key,
        ladder(
          [
            tmdb[pair],
            orderStill(order, ep.season, ep.episode, abs, anime),
            proxyStill(proxy, ep.season, ep.episode, abs, anime),
            az.byPair.get(pair) ?? (abs != null ? az.byNumber.get(abs) : undefined),
            ep.still,
            metahubStill(seriesImdb, azPair?.season ?? ep.season, azPair?.episode ?? ep.episode),
          ],
          hd,
        ),
      );
    }
    return out;
  }, [episodes, tmdb, order, proxy, aniZip, imdbId, kitsuId, hd]);
}
