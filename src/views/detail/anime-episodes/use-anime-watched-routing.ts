import { useMemo } from "react";
import type { Meta } from "@/lib/cinemeta";
import type { FranchiseEntry } from "@/lib/providers/anime-detail";
import type { KitsuEpisode } from "@/lib/providers/kitsu";
import {
  recordManualWatchedMeta,
  setManualWatchedMany,
  type ManualWatchedMeta,
} from "@/lib/manual-watched";
import { syncAnimeProgress } from "@/lib/anilist/sync";
import { syncMalProgress } from "@/lib/mal/sync";
import { useSettings } from "@/lib/settings";
import { airedOnly } from "../helpers";
import { animeSeasonKey } from "./anime-season-key";

const ANIME_TRACK_ID = /^(kitsu|mal|anilist|anidb):/;

export function useAnimeWatchedRouting(meta: Meta, franchise: FranchiseEntry[], trackId?: string) {
  const { settings } = useSettings();
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
    const eligible = watched ? airedOnly(displayEpisodes, (ep) => ep.airdate) : displayEpisodes;
    if (eligible.length === 0) return;
    const groups = new Map<string, Array<{ season: number; episode: number }>>();
    for (const ep of eligible) {
      const id = ep.sourceMetaId ?? meta.id;
      const list = groups.get(id) ?? [];
      list.push({
        season: animeSeasonKey(ep),
        episode: ep.number,
      });
      groups.set(id, list);
    }
    for (const [id, eps] of groups) {
      if (watched) recordManualWatchedMeta(id, manualMetaFor(id));
      setManualWatchedMany(id, eps, watched);
      const syncId =
        id === meta.id && trackId && ANIME_TRACK_ID.test(trackId) && !ANIME_TRACK_ID.test(id)
          ? trackId
          : id;
      if (watched && ANIME_TRACK_ID.test(syncId)) {
        const highest = Math.max(...eps.map((e) => e.episode));
        if (Number.isFinite(highest) && highest > 0) {
          const title = manualMetaFor(id).name;
          if (settings.anilistAutoSync) void syncAnimeProgress(syncId, highest, title);
          if (settings.malAutoSync) void syncMalProgress(syncId, highest, title);
        }
      }
    }
  };

  return { metaForEp, manualMetaFor, markMany };
}
