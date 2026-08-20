import { useCallback, useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import type { KitsuEpisode } from "@/lib/providers/kitsu";
import { tmdbLanguageIso } from "@/lib/providers/tmdb/tmdb-client";
import { useEpisodeOrder } from "../series-episodes/use-episode-order";
import type { PickerItem } from "../series-episodes/season-arc-picker";
import { buildAnimeOrder } from "./anime-order-utils";

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
): AnimeOrder | null {
  const t = useT();
  const ordering = useEpisodeOrder(imdbId, metaId, provider, seasonType, tvdbKey);
  const built = useMemo(
    // pickLocalizedText keys its script tests by ISO-1 ("ko"), not TVDB codes ("kor").
    () => buildAnimeOrder(ordering, episodes, t("Specials"), tmdbLanguageIso()),
    [ordering, episodes, t],
  );
  const [sel, setSel] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    setSel(null);
    setTouched(false);
  }, [metaId]);
  const onSelect = useCallback((key: string) => {
    setSel(key);
    setTouched(true);
  }, []);
  if (!built) return null;
  const activeKey =
    touched && built.items.some((i) => i.key === sel)
      ? (sel as string)
      : intentSeasonKey && built.items.some((i) => i.key === intentSeasonKey)
        ? intentSeasonKey
        : preferredSeasonKey && built.items.some((i) => i.key === preferredSeasonKey)
          ? preferredSeasonKey
          : built.items[0].key;
  return {
    items: built.items,
    activeKey,
    onSelect,
    visibleEpisodes: built.subsetByKey.get(activeKey) ?? [],
  };
}
