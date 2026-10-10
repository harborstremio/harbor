import { useEffect, useMemo, useState } from "react";
import { aniZipByKitsu, aniZipByMal, type AniZipMapping } from "@/lib/providers/anizip";
import type { KitsuEpisode } from "@/lib/providers/kitsu";
import { entryTvdbPairs } from "@/lib/anime-entry-target";
import { useSimkl } from "./provider";
import { loadSimklWatchedMap } from "./list-status";

const EMPTY = new Set<string>();
const NATIVE = /^(kitsu|mal):(\d+)$/;

function aniZipFor(id: string): Promise<AniZipMapping | null> {
  const m = NATIVE.exec(id);
  if (!m) return Promise.resolve(null);
  const n = Number(m[2]);
  return (m[1] === "kitsu" ? aniZipByKitsu(n) : aniZipByMal(n)).catch(() => null);
}

/** Simkl's watched anime episodes as the pairs rows read: TVDB pair, or own key for unmapped rows. */
export function useSimklAnimeWatched(
  imdbId: string | null | undefined,
  entryIds: Array<string | null | undefined>,
  episodes: KitsuEpisode[],
): Set<string> {
  const { isConnected } = useSimkl();
  const [watched, setWatched] = useState<Set<string>>(EMPTY);
  const entrySig = [...new Set(entryIds.filter((id): id is string => !!id && NATIVE.test(id)))]
    .sort()
    .join("|");
  const epSig = useMemo(
    () =>
      episodes
        .map(
          (e) =>
            `${e.sourceMetaId ?? ""}:${e.seasonNumber}:${e.number}:${e.imdbSeason}:${e.imdbEpisode}`,
        )
        .join("|"),
    [episodes],
  );
  useEffect(() => {
    if (!isConnected || (!imdbId && !entrySig)) {
      setWatched(EMPTY);
      return;
    }
    let cancelled = false;
    void (async () => {
      const map = await loadSimklWatchedMap().catch(() => null);
      if (cancelled || !map) return;
      // IMDb/TMDB keys are already stored by TVDB pair.
      const out = new Set(imdbId ? (map.get(imdbId) ?? []) : []);
      for (const id of entrySig ? entrySig.split("|") : []) {
        const numbers = new Set(
          [...(map.get(id) ?? [])].map((k) => Number(k.split(":")[1])).filter((n) => n >= 1),
        );
        if (numbers.size === 0) continue;
        // Native ids hold entry-relative numbers; translate them to each row's lookup pair.
        for (const ep of episodes) {
          if (ep.sourceMetaId != null || !numbers.has(ep.number)) continue;
          out.add(
            ep.imdbSeason != null && ep.imdbEpisode != null
              ? `${ep.imdbSeason}:${ep.imdbEpisode}`
              : `${ep.seasonNumber ?? 1}:${ep.number}`,
          );
        }
        const az = await aniZipFor(id);
        if (cancelled) return;
        const pairs = entryTvdbPairs(az);
        for (const n of numbers) {
          const pair = pairs.get(n);
          if (pair) out.add(pair);
        }
      }
      if (!cancelled) setWatched(out);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, imdbId, entrySig, epSig]);
  return watched;
}
