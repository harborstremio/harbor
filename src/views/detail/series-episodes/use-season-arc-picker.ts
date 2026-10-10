import { useMemo } from "react";
import type { Season } from "@/lib/providers/tmdb";
import { setViewedSeason } from "@/lib/season-view-pref";
import { seasonDateRange, type TvdbOrder } from "@/lib/providers/tvdb-order";
import { isNewSeason } from "../helpers";
import type { ArcGroupsState } from "./use-arc-groups";
import type { PickerItem } from "./season-arc-picker";

export function useSeasonArcPicker({
  source,
  arc,
  ordering,
  orderSeasonEff,
  seasons,
  active,
  lastEpisodeAir,
  metaId,
  setActive,
  setOrderSeason,
  userPickedRef,
}: {
  source: "arcs" | "order" | "default";
  arc: ArcGroupsState;
  ordering: TvdbOrder | null;
  orderSeasonEff: number;
  seasons: Season[];
  active: number;
  lastEpisodeAir?: { seasonNumber: number; airDate: string | null };
  metaId: string;
  setActive: (n: number) => void;
  setOrderSeason: (n: number) => void;
  userPickedRef: React.MutableRefObject<boolean>;
}): { items: PickerItem[]; activeKey: string; onSelect: (key: string) => void } {
  return useMemo(() => {
    if (source === "arcs") {
      return {
        items: arc.arcs.map((a) => ({ key: a.id, name: a.name, count: a.episodes.length })),
        activeKey: arc.activeArcId ?? arc.arcs[0]?.id ?? "",
        onSelect: arc.setActiveArcId,
      };
    }
    if (source === "order" && ordering) {
      return {
        items: ordering.seasons.map((s) => {
          const { from, to } = seasonDateRange(ordering.bySeason.get(s.seasonNumber) ?? []);
          return {
            key: String(s.seasonNumber),
            name: s.name,
            count: s.episodeCount,
            year: s.airDate?.slice(0, 4),
            from,
            to,
            extra: s.seasonNumber <= 0,
          };
        }),
        activeKey: String(orderSeasonEff),
        onSelect: (k: string) => {
          setViewedSeason(metaId, Number(k));
          setOrderSeason(Number(k));
        },
      };
    }
    return {
      items: seasons.map((s) => ({
        key: String(s.seasonNumber),
        name: s.name,
        count: s.episodeCount,
        year: s.airDate?.slice(0, 4),
        isNew: isNewSeason(s, lastEpisodeAir),
      })),
      activeKey: String(active),
      onSelect: (k: string) => {
        userPickedRef.current = true;
        setViewedSeason(metaId, Number(k));
        setActive(Number(k));
      },
    };
  }, [
    source,
    arc,
    ordering,
    orderSeasonEff,
    seasons,
    active,
    lastEpisodeAir,
    metaId,
    setActive,
    setOrderSeason,
    userPickedRef,
  ]);
}
