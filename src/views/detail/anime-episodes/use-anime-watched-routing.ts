import type { Meta } from "@/lib/cinemeta";
import { recordManualWatchedMeta, setManualWatchedMany, type ManualWatchedMeta } from "@/lib/manual-watched";
import type { FranchiseEntry } from "@/lib/providers/anime-detail";
import type { KitsuEpisode } from "@/lib/providers/kitsu";
import { useMemo } from "react";

export function useAnimeWatchedRouting(meta: Meta, franchise: FranchiseEntry[]) {
  const byId = useMemo(() => {
    const m = new Map<string, Meta>();
    for (const f of franchise) m.set(f.meta.id, f.meta);
    return m;
  }, [franchise]);

  const metaForEp = (ep: KitsuEpisode): Meta => {
    if (!ep.sourceMetaId) return meta;
    return byId.get(ep.sourceMetaId) ?? { id: ep.sourceMetaId, type: "series", name: meta.name };
  };

  const manualMetaFor = (metaId: string): ManualWatchedMeta => {
    const m = metaId === meta.id ? meta : (byId.get(metaId) ?? meta);
    return { type: "series", name: m.name, poster: m.poster, background: m.background };
  };

  const markMany = (displayEpisodes: KitsuEpisode[], watched: boolean) => {
    if (displayEpisodes.length === 0) return;
    const groups = new Map<string, Array<{ season: number; episode: number }>>();
    for (const ep of displayEpisodes) {
      const id = ep.sourceMetaId ?? meta.id;
      const list = groups.get(id) ?? [];
      list.push({ season: ep.seasonNumber || 1, episode: ep.number });
      groups.set(id, list);
    }
    for (const [id, eps] of groups) {
      if (watched) recordManualWatchedMeta(id, manualMetaFor(id));
      setManualWatchedMany(id, eps, watched);
    }
  };

  return { metaForEp, manualMetaFor, markMany };
}
