import {
  tmdbEpisodeGroup,
  tmdbEpisodeGroups,
  tmdbSeasonEpisodes,
  type Episode,
  type StoryArc,
} from "@/lib/providers/tmdb";
import { useEffect, useState } from "react";

export type ArcGroupsState = {
  arcs: StoryArc[];
  activeArcId: string | null;
  setActiveArcId: (id: string) => void;
  hasArcs: boolean;
  episodes: Episode[];
  loading: boolean;
};

export function useArcGroups({
  tvId,
  tmdbKey,
  enabled,
}: {
  tvId: number;
  tmdbKey: string;
  enabled: boolean;
}): ArcGroupsState {
  const [arcs, setArcs] = useState<StoryArc[]>([]);
  const [activeArcId, setActiveArcId] = useState<string | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !tvId || !tmdbKey) {
      setArcs([]);
      setActiveArcId(null);
      setEpisodes([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const group = await tmdbEpisodeGroups(tmdbKey, tvId);
      if (cancelled || !group) return;
      const list = await tmdbEpisodeGroup(tmdbKey, group.id);
      if (cancelled || list.length === 0) return;
      setArcs(list);
      setActiveArcId((prev) => (prev && list.some((a) => a.id === prev) ? prev : list[0].id));
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, tvId, tmdbKey]);

  useEffect(() => {
    if (!enabled || !tmdbKey || !activeArcId) return;
    const arc = arcs.find((a) => a.id === activeArcId);
    if (!arc) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const seasonsNeeded = [...new Set(arc.episodes.map((e) => e.season))];
      const bySeason = new Map<number, Map<number, Episode>>();
      await Promise.all(
        seasonsNeeded.map(async (s) => {
          const eps = await tmdbSeasonEpisodes(tmdbKey, tvId, s);
          const m = new Map<number, Episode>();
          for (const ep of eps) m.set(ep.episodeNumber, ep);
          bySeason.set(s, m);
        }),
      );
      if (cancelled) return;
      const ordered: Episode[] = [];
      for (const ref of arc.episodes) {
        const ep = bySeason.get(ref.season)?.get(ref.episode);
        if (ep) ordered.push(ep);
      }
      setEpisodes(ordered);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, tmdbKey, tvId, activeArcId, arcs]);

  return {
    arcs,
    activeArcId,
    setActiveArcId,
    hasArcs: enabled && arcs.length > 0,
    episodes,
    loading,
  };
}
