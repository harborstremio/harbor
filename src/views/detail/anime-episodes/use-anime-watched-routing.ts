import { useMemo } from "react";
import type { Meta } from "@/lib/cinemeta";
import type { FranchiseEntry } from "@/lib/providers/anime-detail";
import type { KitsuEpisode } from "@/lib/providers/kitsu";
import {
  recordManualWatchedMeta,
  setManualWatchedMany,
  type ManualWatchedMeta,
} from "@/lib/manual-watched";
import { pushAnimeMarks } from "@/lib/anime-tracker-marks";
import { syncAnimeWatchedToStremio } from "@/lib/anime-stremio-watched";
import { useSettings } from "@/lib/settings";
import { airedOnly } from "../helpers";
import { animeSeasonKey } from "./anime-season-key";

export function useAnimeWatchedRouting(
  meta: Meta,
  franchise: FranchiseEntry[],
  trackId?: string,
  imdbId?: string | null,
) {
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

  /** Writes the keys the rows read, then each tracker entry's own episode numbers. */
  const markMany = (
    displayEpisodes: KitsuEpisode[],
    watched: boolean,
    seriesRows?: Array<{ row: KitsuEpisode; watched: boolean }>,
  ) => {
    const eligible = watched ? airedOnly(displayEpisodes, (ep) => ep.airdate) : displayEpisodes;
    if (eligible.length === 0) return;
    const groups = new Map<string, KitsuEpisode[]>();
    for (const ep of eligible) {
      const id = ep.sourceMetaId ?? meta.id;
      const list = groups.get(id) ?? [];
      list.push(ep);
      groups.set(id, list);
    }
    for (const [id, eps] of groups) {
      if (watched) recordManualWatchedMeta(id, manualMetaFor(id));
      setManualWatchedMany(
        id,
        eps.map((ep) => ({ season: animeSeasonKey(ep), episode: ep.number })),
        watched,
      );
    }
    if (!/^(kitsu|mal|anilist|anidb):/.test(meta.id) && groups.has(meta.id))
      syncAnimeWatchedToStremio(meta, imdbId ?? null, groups.get(meta.id)!);
    const unmarked = new Set(eligible);
    void pushAnimeMarks(meta.id, eligible, watched, {
      title: meta.name,
      trackId,
      anilist: settings.anilistAutoSync,
      mal: settings.malAutoSync,
      simkl: true,
      watchedRows: seriesRows?.map(({ row, watched: w }) => ({
        row,
        watched: w && !unmarked.has(row),
      })),
    });
  };

  return { metaForEp, manualMetaFor, markMany };
}
