import type { FranchiseEntry } from "@/lib/providers/anime-detail";
import { useView } from "@/lib/view";
import { useMemo } from "react";

import type { PickerItem } from "../series-episodes/season-arc-picker";

type AnimeOrder = { items: PickerItem[]; onSelect: (key: string) => void } | null;

export function useAnimeFranchiseNav(order: AnimeOrder, franchise: FranchiseEntry[], currentId: string) {
  const { openMeta } = useView();

  const franchiseNav = useMemo(
    () =>
      order && franchise.length > 1
        ? franchise
            .filter((f) => f.meta.id !== currentId)
            .map((f) => ({
              meta: f.meta,
              key: `nav:${f.meta.id}`,
              name: f.meta.name,
              count: f.episodeCount ?? 0,
              year: f.startDate?.slice(0, 4),
            }))
        : [],
    [order, franchise, currentId],
  );

  const pickerItems: PickerItem[] = useMemo(
    () =>
      order
        ? [
            ...order.items,
            ...franchiseNav.map((n) => ({
              key: n.key,
              name: n.name,
              count: n.count,
              year: n.year,
              extra: true,
            })),
          ]
        : [],
    [order, franchiseNav],
  );

  const selectPickerItem = (key: string) => {
    const nav = franchiseNav.find((n) => n.key === key);
    if (nav) {
      openMeta(nav.meta);
      return;
    }
    order?.onSelect(key);
  };

  return { pickerItems, selectPickerItem };
}
