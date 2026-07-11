import { kitsuToTvdb } from "@/lib/providers/anime-mapping";
import type { KitsuEpisode } from "@/lib/providers/kitsu";
import { tmdbLanguageIso } from "@/lib/providers/tmdb/tmdb-client";
import {
  tvdbLangFromIso1,
  tvdbOrderTypeHasEpisodes,
  tvdbSeasonTypes,
  tvdbSeriesByRemote,
  type TvdbOrderType,
  type TvdbSeasonTypeOption,
} from "@/lib/providers/tvdb";
import { fetchTvdbOrderBySeriesId, seasonDateRange, type TvdbOrder } from "@/lib/providers/tvdb-order";
import { useEffect, useMemo, useState } from "react";

import type { PickerItem } from "../series-episodes/season-arc-picker";

export type AnimeTvdbPanel = {
  items: PickerItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  visibleEpisodes: KitsuEpisode[];
  orderTypes: TvdbSeasonTypeOption[];
  activeType: TvdbOrderType;
};

export function useAnimeTvdbPanel(
  kitsuId: number | null,
  imdbId: string | null,
  episodes: KitsuEpisode[],
  seasonType: string,
  tvdbKey: string,
  enabled: boolean,
  franchiseEpisodes?: KitsuEpisode[],
): AnimeTvdbPanel | null {
  const [seriesId, setSeriesId] = useState<number | null>(null);
  const [ordering, setOrdering] = useState<TvdbOrder | null>(null);
  const [orderTypes, setOrderTypes] = useState<TvdbSeasonTypeOption[]>([]);
  const [activeType, setActiveType] = useState<TvdbOrderType>("aired");
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !tvdbKey) {
      setSeriesId(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      let sid = kitsuId != null ? await kitsuToTvdb(kitsuId).catch(() => null) : null;
      if (sid == null && imdbId?.startsWith("tt")) {
        sid = await tvdbSeriesByRemote(tvdbKey, imdbId).catch(() => null);
      }
      if (!cancelled) setSeriesId(sid);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, tvdbKey, kitsuId, imdbId]);

  useEffect(() => {
    if (!enabled || !tvdbKey || seriesId == null) {
      setOrdering(null);
      setOrderTypes([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const base = await tvdbSeasonTypes(tvdbKey, seriesId);
      const candidates = base.some((c) => c.value === "aired")
        ? base
        : [{ value: "aired" as const, label: "Aired Order" }, ...base];
      const checks = await Promise.all(candidates.map((c) => tvdbOrderTypeHasEpisodes(tvdbKey, seriesId, c.value)));
      if (cancelled) return;
      const nonEmpty = candidates.filter((_, i) => checks[i]);
      if (nonEmpty.length === 0) {
        setOrderTypes([]);
        setOrdering(null);
        return;
      }
      const norm = (seasonType === "official" ? "aired" : seasonType) as TvdbOrderType;
      const values = new Set(nonEmpty.map((c) => c.value));
      const effective = values.has(norm) ? norm : values.has("aired") ? "aired" : nonEmpty[0].value;
      setOrderTypes(nonEmpty);
      setActiveType(effective);
      const o = await fetchTvdbOrderBySeriesId(tvdbKey, seriesId, effective, tvdbLangFromIso1(tmdbLanguageIso()));
      if (!cancelled) setOrdering(o);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, tvdbKey, seriesId, seasonType]);

  const built = useMemo(() => {
    if (!ordering) return null;
    const pool = franchiseEpisodes ?? episodes;
    const franchiseWide = franchiseEpisodes != null;
    const byPair = new Map<string, KitsuEpisode>();
    const byAbs = new Map<number, KitsuEpisode>();
    for (const ep of pool) {
      const abs = franchiseWide ? ep.absoluteNumber : (ep.absoluteNumber ?? ep.number);
      if (abs != null && !byAbs.has(abs)) byAbs.set(abs, ep);
      if (ep.imdbSeason != null && ep.imdbSeason >= 1 && ep.imdbEpisode != null) {
        const k = `${ep.imdbSeason}:${ep.imdbEpisode}`;
        if (!byPair.has(k)) byPair.set(k, ep);
      }
    }
    const items: PickerItem[] = [];
    const subset = new Map<string, KitsuEpisode[]>();
    for (const s of ordering.seasons) {
      if (s.seasonNumber < 1) continue;
      const bucket = ordering.bySeason.get(s.seasonNumber) ?? [];
      if (bucket.length === 0) continue;
      const eps: KitsuEpisode[] = bucket.map((e) => {
        const abs = ordering.absByEpId.get(e.id);
        const img = abs != null ? ordering.imageByAbs.get(abs) : undefined;
        let match = byPair.get(`${e.seasonNumber}:${e.episodeNumber}`);
        if (!match && abs != null) match = byAbs.get(abs);
        if (match) return !match.thumbnail && img ? { ...match, thumbnail: img } : match;
        return {
          id: -e.id,
          number: e.episodeNumber,
          seasonNumber: e.seasonNumber,
          title: e.name || `Episode ${e.episodeNumber}`,
          synopsis: e.overview ?? "",
          thumbnail: img ?? null,
          airdate: e.airDate ?? null,
          length: e.runtime ?? null,
          imdbSeason: e.seasonNumber,
          imdbEpisode: e.episodeNumber,
          absoluteNumber: abs ?? undefined,
        };
      });
      const key = String(s.seasonNumber);
      const { from, to } = seasonDateRange(bucket);
      items.push({ key, name: s.name, count: eps.length, year: s.airDate?.slice(0, 4), from, to });
      subset.set(key, eps);
    }
    if (items.length === 0) return null;
    return { items, subset, pool };
  }, [ordering, episodes, franchiseEpisodes]);

  if (!enabled || !built) return null;
  const activeKey = built.items.some((i) => i.key === sel) ? (sel as string) : built.items[0].key;
  return {
    items: built.items,
    activeKey,
    onSelect: setSel,
    visibleEpisodes: built.subset.get(activeKey) ?? built.pool,
    orderTypes,
    activeType,
  };
}
