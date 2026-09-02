import { useEffect, useMemo, useState } from "react";
import { lruSet } from "@/lib/cache";
import { tmdbSeasonEpisodes } from "@/lib/providers/tmdb";
import { tmdbLanguageIso } from "@/lib/providers/tmdb/tmdb-client";
import { useSettings } from "@/lib/settings";
import { useBpEpisodeEnrich } from "./use-bp-episode-enrich";

export type BpEpisodeFact = {
  rating?: number;
  ratingIsImdb?: boolean;
  runtime?: number;
  overview?: string;
  airDate?: string;
};

export type BpEpisodeFacts = Map<string, BpEpisodeFact>;

const MEMO_MAX = 40;
const EMPTY: BpEpisodeFacts = new Map();

const memo = new Map<string, Promise<BpEpisodeFacts>>();

// A resolved season is reused for the session so stepping back into it on a
// D-pad never refires. A rejection is dropped so it can retry.
function once(slot: string, run: () => Promise<BpEpisodeFacts>): Promise<BpEpisodeFacts> {
  const hit = memo.get(slot);
  if (hit) return hit;
  const p = run();
  lruSet(memo, slot, p, MEMO_MAX);
  void p.catch(() => memo.delete(slot));
  return p;
}

// use-bp-episode-art asks TMDB for the same season to harvest stills, and both
// readers mount in the same tick, so the tmdb scheduler collapses the identical
// in flight url and the facts are usually free rather than a second round trip.
export function useBpEpisodeFacts(
  tvId: number | null,
  season: number,
  imdbId: string | null,
): BpEpisodeFacts {
  const { settings } = useSettings();
  const key = settings.tmdbKey;
  const [tmdbFacts, setTmdbFacts] = useState<BpEpisodeFacts>(EMPTY);
  const enrich = useBpEpisodeEnrich(imdbId, season);

  useEffect(() => {
    setTmdbFacts(EMPTY);
    if (!key || tvId == null || season <= 0) return;
    let alive = true;
    const lang = tmdbLanguageIso() || "en";
    void once(`${tvId}:${season}:${lang}`, async () => {
      const list = await tmdbSeasonEpisodes(key, tvId, season);
      const out: BpEpisodeFacts = new Map();
      for (const e of list) {
        out.set(`${e.seasonNumber}:${e.episodeNumber}`, {
          rating: e.voteAverage != null && e.voteAverage > 0 ? e.voteAverage : undefined,
          runtime: e.runtime != null && e.runtime > 0 ? e.runtime : undefined,
          overview: e.overview || undefined,
          airDate: e.airDate ?? undefined,
        });
      }
      return out;
    })
      .then((m) => {
        if (alive && m.size > 0) setTmdbFacts(m);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key, tvId, season]);

  return useMemo(() => {
    const prefix = `${season}:`;
    const keys = new Set<string>(tmdbFacts.keys());
    for (const k of enrich.imdb.keys()) if (k.startsWith(prefix)) keys.add(k);
    for (const n of enrich.omdb.keys()) keys.add(`${prefix}${n}`);
    if (keys.size === 0) return EMPTY;
    const out: BpEpisodeFacts = new Map();
    for (const k of keys) {
      const base = tmdbFacts.get(k);
      const inSeason = k.startsWith(prefix);
      const num = Number(k.slice(k.indexOf(":") + 1));
      const raw = enrich.imdb.get(k) ?? (inSeason ? enrich.omdb.get(num) : undefined);
      const imdbVal = raw != null && Number.isFinite(raw) && raw > 0 ? raw : null;
      const tmdbVal = base?.rating != null && base.rating > 0 ? base.rating : null;
      const tv = inSeason ? enrich.tvdb.get(num) : undefined;
      const overview =
        tv?.overview && tv.overview.trim().length > (base?.overview?.trim().length ?? 0)
          ? tv.overview
          : base?.overview;
      out.set(k, {
        rating: imdbVal ?? tmdbVal ?? undefined,
        ratingIsImdb: imdbVal != null,
        runtime: base?.runtime ?? tv?.runtime,
        overview: overview || undefined,
        airDate: base?.airDate ?? tv?.aired,
      });
    }
    return out;
  }, [tmdbFacts, enrich, season]);
}
