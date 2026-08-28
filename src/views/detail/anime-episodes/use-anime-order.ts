import { useCallback, useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import type { KitsuEpisode } from "@/lib/providers/kitsu";
import { tmdbLanguageIso } from "@/lib/providers/tmdb/tmdb-client";
import { useEpisodeOrder } from "../series-episodes/use-episode-order";
import type { PickerItem } from "../series-episodes/season-arc-picker";
import { buildSoloAnimeOrder, buildAnimeOrder } from "./anime-order-utils";
import { foreignAnimeProviderSeasons } from "@/lib/streams/anime-identity";

export type AnimeOrder = {
  items: PickerItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  visibleEpisodes: KitsuEpisode[];
};

export function useAnimeOrder(
  imdbId: string | null,
  metaId: string,
  episodes: KitsuEpisode[],
  provider: "default" | "tmdb" | "tvdb",
  seasonType: string,
  tvdbKey: string,
  preferredSeasonKey?: string,
  intentSeasonKey?: string,
  solo = false,
): AnimeOrder | null {
  const t = useT();
  const ordering = useEpisodeOrder(imdbId, metaId, provider, seasonType, tvdbKey, !solo);
  const built = useMemo(
    // pickLocalizedText keys its script tests by ISO-1 ("ko"), not TVDB codes ("kor").
    () =>
      solo
        ? buildSoloAnimeOrder(episodes, t("Specials"), (s) => t("Season {n}", { n: s }))
        : buildAnimeOrder(ordering, episodes, t("Specials"), tmdbLanguageIso()),
    [solo, ordering, episodes, t],
  );
  const [sel, setSel] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [foreignSeasons, setForeignSeasons] = useState<Set<number> | null>(null);
  useEffect(() => {
    if (solo) {
      setForeignSeasons(null);
      return;
    }
    let cancelled = false;
    void foreignAnimeProviderSeasons(metaId, imdbId)
      .then((s) => {
        if (!cancelled) setForeignSeasons(s);
      })
      .catch(() => {
        if (!cancelled) setForeignSeasons(null);
      });
    return () => {
      cancelled = true;
    };
  }, [metaId, imdbId, solo]);
  const filteredBuilt = useMemo(() => {
    if (!built || !foreignSeasons || foreignSeasons.size === 0) return built;
    const items = built.items.filter(
      (i) => !(Number.isFinite(Number(i.key)) && foreignSeasons.has(Number(i.key))),
    );
    if (items.length === built.items.length || items.length === 0) return built;
    const subsetByKey = new Map(built.subsetByKey);
    for (const s of foreignSeasons) subsetByKey.delete(String(s));
    return { ...built, items, subsetByKey };
  }, [built, foreignSeasons]);
  useEffect(() => {
    setSel(null);
    setTouched(false);
  }, [metaId]);
  const onSelect = useCallback((key: string) => {
    setSel(key);
    setTouched(true);
  }, []);
  if (!filteredBuilt) return null;
  const activeKey =
    touched && filteredBuilt.items.some((i) => i.key === sel)
      ? (sel as string)
      : intentSeasonKey && filteredBuilt.items.some((i) => i.key === intentSeasonKey)
        ? intentSeasonKey
        : preferredSeasonKey && filteredBuilt.items.some((i) => i.key === preferredSeasonKey)
          ? preferredSeasonKey
          : filteredBuilt.items[0].key;
  return {
    items: filteredBuilt.items,
    activeKey,
    onSelect,
    visibleEpisodes: filteredBuilt.subsetByKey.get(activeKey) ?? [],
  };
}
