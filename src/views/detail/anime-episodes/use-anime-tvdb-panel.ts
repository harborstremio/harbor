import { useCallback, useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import type { KitsuEpisode } from "@/lib/providers/kitsu";
import { kitsuToTvdb } from "@/lib/providers/anime-mapping";
import { isFranchiseExtra, type FranchiseEntry } from "@/lib/providers/anime-detail";
import {
  tvdbLangFromIso1,
  tvdbOrderTypeHasEpisodes,
  tvdbSeasonTypes,
  tvdbSeriesByRemote,
  type TvdbOrderType,
  type TvdbSeasonTypeOption,
} from "@/lib/providers/tvdb";
import { tmdbLanguageIso } from "@/lib/providers/tmdb/tmdb-client";
import { pickLocalizedText } from "@/lib/localized-text";
import { fetchTvdbOrderBySeriesId, seasonDateRange, type TvdbOrder } from "@/lib/providers/tvdb-order";
import { harborImdbEpisodesCached } from "@/lib/providers/harbor-imdb";
import type { PickerItem } from "../series-episodes/season-arc-picker";

export type AnimeTvdbPanel = {
  items: PickerItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  visibleEpisodes: KitsuEpisode[];
  orderTypes: TvdbSeasonTypeOption[];
  activeType: TvdbOrderType;
};

export type AnimeTvdbPanelState = {
  panel: AnimeTvdbPanel | null;
  active: boolean;
};

const normTitle = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

const matchTitle = (a?: string | null, b?: string | null) => {
  if (!a || !b) return false;
  const n1 = normTitle(a);
  const n2 = normTitle(b);
  return n1.length > 0 && n1 === n2;
};
const isCloseDate = (d1: string, d2: string) => {
  const t1 = new Date(d1).getTime();
  const t2 = new Date(d2).getTime();
  if (isNaN(t1) || isNaN(t2)) return false;
  return Math.abs(t1 - t2) <= 86400000;
};

export function useAnimeTvdbPanel(
  kitsuId: number | null,
  imdbId: string | null,
  episodes: KitsuEpisode[],
  seasonType: string,
  tvdbKey: string,
  enabled: boolean,
  franchiseEpisodes?: KitsuEpisode[],
  preferredSeasonKey?: string,
  intentSeasonKey?: string,
  franchise?: FranchiseEntry[],
): AnimeTvdbPanelState {
  const t = useT();
  const [seriesId, setSeriesId] = useState<number | null>(null);
  const [ordering, setOrdering] = useState<TvdbOrder | null>(null);
  const [orderTypes, setOrderTypes] = useState<TvdbSeasonTypeOption[]>([]);
  const [activeType, setActiveType] = useState<TvdbOrderType>("aired");
  const [sel, setSel] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [resolved, setResolved] = useState<"pending" | "has" | "none">("pending");

  useEffect(() => {
    setSel(null);
    setTouched(false);
  }, [kitsuId, imdbId]);

  const onSelect = useCallback((key: string) => {
    setSel(key);
    setTouched(true);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setSeriesId(null);
      setResolved("none");
      return;
    }
    setResolved("pending");
    let cancelled = false;
    void (async () => {
      let sid = kitsuId != null ? await kitsuToTvdb(kitsuId).catch(() => null) : null;
      if (sid == null && imdbId?.startsWith("tt")) {
        sid = await tvdbSeriesByRemote(tvdbKey, imdbId).catch(() => null);
      }
      if (cancelled) return;
      setSeriesId(sid);
      if (sid == null) setResolved("none");
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, tvdbKey, kitsuId, imdbId]);

  useEffect(() => {
    if (!enabled || seriesId == null) {
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
      const checks = await Promise.all(
        candidates.map((c) => tvdbOrderTypeHasEpisodes(tvdbKey, seriesId, c.value)),
      );
      if (cancelled) return;
      const nonEmpty = candidates.filter((_, i) => checks[i]);
      if (nonEmpty.length === 0) {
        setOrderTypes([]);
        setOrdering(null);
        setResolved("none");
        return;
      }
      const norm = (seasonType === "official" ? "aired" : seasonType) as TvdbOrderType;
      const values = new Set(nonEmpty.map((c) => c.value));
      const effective = values.has(norm) ? norm : values.has("aired") ? "aired" : nonEmpty[0].value;
      setOrderTypes(nonEmpty);
      setActiveType(effective);
      const o = await fetchTvdbOrderBySeriesId(tvdbKey, seriesId, effective, tvdbLangFromIso1(tmdbLanguageIso()));
      if (cancelled) return;
      setOrdering(o);
      if (!o) setResolved("none");
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, tvdbKey, seriesId, seasonType]);

  const extrasLabel = t("Extras");
  const built = useMemo(() => {
    if (!ordering) return null;
    const lang = tmdbLanguageIso();
    const pool = franchiseEpisodes ?? episodes;
    const franchiseWide = franchiseEpisodes != null;
    const byPair = new Map<string, KitsuEpisode>();
    const byAbs = new Map<number, KitsuEpisode>();
    const byTvdbId = new Map<number, KitsuEpisode>();
    const currentByPair = new Map<string, KitsuEpisode>();
    const currentByAbs = new Map<number, KitsuEpisode>();
    const currentByTvdbId = new Map<number, KitsuEpisode>();
    for (const ep of episodes) {
      const abs = ep.absoluteNumber ?? ep.number;
      if (abs != null && !currentByAbs.has(abs)) currentByAbs.set(abs, ep);
      if (ep.tvdbEpisodeId != null && !currentByTvdbId.has(ep.tvdbEpisodeId)) currentByTvdbId.set(ep.tvdbEpisodeId, ep);
      if (ep.imdbSeason != null && ep.imdbSeason >= 1 && ep.imdbEpisode != null) {
        const key = `${ep.imdbSeason}:${ep.imdbEpisode}`;
        if (!currentByPair.has(key)) currentByPair.set(key, ep);
      }
    }
    for (const ep of pool) {
      const abs = franchiseWide ? ep.absoluteNumber : ep.absoluteNumber ?? ep.number;
      if (abs != null && !byAbs.has(abs)) byAbs.set(abs, ep);
      if (ep.tvdbEpisodeId != null && !byTvdbId.has(ep.tvdbEpisodeId)) byTvdbId.set(ep.tvdbEpisodeId, ep);
      if (ep.imdbSeason != null && ep.imdbSeason >= 0 && ep.imdbEpisode != null) {
        const k = `${ep.imdbSeason}:${ep.imdbEpisode}`;
        if (!byPair.has(k)) byPair.set(k, ep);
      }
    }
    const items: PickerItem[] = [];
    const subset = new Map<string, KitsuEpisode[]>();
    const claimed = new Set<number>();
    const claimedExtras = new Set<string>();
    const imdbMap = imdbId ? harborImdbEpisodesCached(imdbId) : undefined;
    for (const s of ordering.seasons) {
      if (s.seasonNumber < 0) continue;
      const bucket = ordering.bySeason.get(s.seasonNumber) ?? [];
      if (bucket.length === 0) continue;
      const seenId = new Set<number>();
      const eps: KitsuEpisode[] = [];
      for (const e of bucket) {
        const abs = ordering.absByEpId.get(e.id);
        const img = e.stillUrl ?? e.stillPath ?? (abs != null ? ordering.imageByAbs.get(abs) : undefined);
        let match: KitsuEpisode | undefined;
        if (e.seasonNumber > 0) {
          match = byTvdbId.get(e.id) ?? byPair.get(`${e.seasonNumber}:${e.episodeNumber}`);
          if (!match && abs != null) match = byAbs.get(abs);
        }
        const currentMatch =
          currentByTvdbId.get(e.id) ??
          currentByPair.get(`${e.seasonNumber}:${e.episodeNumber}`) ??
          (abs != null ? currentByAbs.get(abs) : undefined);
        let title: string | undefined;
        let synopsis: string | undefined;
        if (match && currentMatch && match !== currentMatch) {
          title = pickLocalizedText(
            [{ text: match?.title }, { text: currentMatch?.title }],
            { forName: true, lang },
          );
          synopsis = pickLocalizedText(
            [{ text: match?.synopsis }, { text: currentMatch?.synopsis }],
            { lang },
          );
        }
        if (match && claimed.has(match.id)) match = undefined;

        let streamId: string | undefined;
        if (!match && franchise) {
          let extra = franchise.find((f) =>
            isFranchiseExtra(f) &&
            !claimedExtras.has(f.meta.id) &&
            matchTitle(f.meta.name, e.name)
          );

          if (!extra) {
            extra = franchise.find((f) =>
              isFranchiseExtra(f) &&
              !claimedExtras.has(f.meta.id) &&
              f.startDate && e.airDate && isCloseDate(f.startDate, e.airDate)
            );
          }

          if (extra) {
            streamId = `${extra.meta.id}:1`;
            claimedExtras.add(extra.meta.id);
          }
        }

        const imdbRating =
          imdbMap?.get(`${e.seasonNumber}:${e.episodeNumber}`) ??
          (abs != null ? imdbMap?.get(`1:${abs}`) : undefined);

        const ep: KitsuEpisode = match
          ? {
              ...match,
              thumbnail: !match.thumbnail && img ? img : match.thumbnail,
              ...(title != null ? { title } : {}),
              ...(synopsis != null ? { synopsis } : {}),
              ...(match.rating == null && imdbRating != null
                ? { rating: imdbRating, ratingIsImdb: true }
                : {}),
            }
          : {
              id: -e.id,
              number: e.episodeNumber,
              seasonNumber: e.seasonNumber,
              title: pickLocalizedText(
                [{ text: e.name }, { text: e.nameEn ?? "" }, { text: currentMatch?.title ?? "" }],
                { forName: true, lang },
              ) ?? e.name,
              synopsis: pickLocalizedText(
                [{ text: e.overview }, { text: e.overviewEn ?? "" }, { text: currentMatch?.synopsis ?? "" }],
                { lang },
              ) ?? e.overview,
              thumbnail: img ?? null,
              airdate: e.airDate ?? null,
              length: e.runtime ?? null,
              imdbSeason: e.seasonNumber,
              imdbEpisode: e.episodeNumber,
              absoluteNumber: abs ?? undefined,
              tvdbEpisodeId: e.id > 0 ? e.id : undefined,
              streamId,
              rating: imdbRating,
              ratingIsImdb: imdbRating != null ? true : undefined,
            };
        if (seenId.has(ep.id)) continue;
        seenId.add(ep.id);
        if (match) claimed.add(match.id);
        eps.push(ep);
      }
      const key = String(s.seasonNumber);
      const { from, to } = seasonDateRange(bucket);
      items.push({ key, name: s.name, count: eps.length, year: s.airDate?.slice(0, 4), from, to, extra: s.seasonNumber === 0 });
      subset.set(key, eps);
    }
    const matchedIds = new Set<number>();
    for (const eps of subset.values()) for (const e of eps) matchedIds.add(e.id);
    const leftovers = pool.filter((e) => e.id > 0 && e.sourceMetaId == null && !matchedIds.has(e.id));
    if (leftovers.length > 0) {
      items.push({ key: "specials", name: extrasLabel, count: leftovers.length, extra: true });
      subset.set("specials", leftovers);
    }
    if (items.length === 0) return null;
    return { items, subset, pool };
  }, [ordering, episodes, franchiseEpisodes, extrasLabel, franchise]);

  useEffect(() => {
    if (!ordering) return;
    setResolved(built ? "has" : "none");
  }, [ordering, built]);

  const active = enabled && resolved !== "none";
  if (!enabled || !built) return { panel: null, active };
  const activeKey =
    touched && built.items.some((i) => i.key === sel)
      ? (sel as string)
      : intentSeasonKey && built.items.some((i) => i.key === intentSeasonKey)
        ? intentSeasonKey
        : preferredSeasonKey && built.items.some((i) => i.key === preferredSeasonKey)
          ? preferredSeasonKey
          : built.items[0].key;
  return {
    panel: {
      items: built.items,
      activeKey,
      onSelect,
      visibleEpisodes: built.subset.get(activeKey) ?? built.pool,
      orderTypes,
      activeType,
    },
    active,
  };
}
