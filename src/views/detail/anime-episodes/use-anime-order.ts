import { useT } from "@/lib/i18n";
import type { KitsuEpisode } from "@/lib/providers/kitsu";
import { useMemo, useState } from "react";

import type { PickerItem } from "../series-episodes/season-arc-picker";
import { useEpisodeOrder } from "../series-episodes/use-episode-order";
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
): AnimeOrder | null {
  const t = useT();
  const ordering = useEpisodeOrder(imdbId, metaId, provider, seasonType, tvdbKey);
  const built = useMemo(() => buildAnimeOrder(ordering, episodes, t("Specials")), [ordering, episodes, t]);
  const [sel, setSel] = useState<string | null>(null);
  if (!built) return null;
  const activeKey = built.items.some((i) => i.key === sel) ? (sel as string) : built.items[0].key;
  return {
    items: built.items,
    activeKey,
    onSelect: setSel,
    visibleEpisodes: built.subsetByKey.get(activeKey) ?? [],
  };
}
