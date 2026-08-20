import { useEffect, useState } from "react";
import { narrowMediaType, isAddonNativeMeta, type Meta } from "@/lib/cinemeta";
import { animeKitsuMeta } from "@/lib/providers/anime-kitsu-addon";
import { externalToKitsu, kitsuToImdb } from "@/lib/providers/anime-mapping";
import { tmdbImdbId } from "@/lib/providers/tmdb";
import { cinemetaImdbFallback } from "./picker-utils";

export type ResolvedImdb = { id: string | null; verified: boolean };

const UNRESOLVED: ResolvedImdb = { id: null, verified: false };

export function useImdbId(meta: Meta, tmdbKey: string | undefined): ResolvedImdb {
  const [resolved, setResolved] = useState<ResolvedImdb>(UNRESOLVED);
  useEffect(() => {
    let cancelled = false;
    const set = (r: ResolvedImdb) => {
      if (!cancelled) setResolved(r);
    };
    if (meta.id.startsWith("tt")) {
      set({ id: meta.id, verified: true });
      return;
    }
    const extMatch = meta.id.match(/^(kitsu|mal|anilist|anidb):(\d+)$/);
    if (extMatch) {
      (async () => {
        const source = extMatch[1] === "mal" ? "myanimelist" : extMatch[1];
        const rawId = parseInt(extMatch[2], 10);
        let kitsuId = source === "kitsu" ? rawId : null;
        if (source !== "kitsu" && Number.isFinite(rawId)) {
          kitsuId = await externalToKitsu(source, rawId).catch(() => null);
        }

        if (kitsuId && Number.isFinite(kitsuId)) {
          const addonRes = await animeKitsuMeta(`kitsu:${kitsuId}`).catch(() => null);
          if (addonRes?.imdb_id) {
            set({ id: addonRes.imdb_id, verified: true });
            return;
          }
          const fromXml = await kitsuToImdb(kitsuId).catch(() => null);
          set(fromXml ? { id: fromXml, verified: true } : UNRESOLVED);
          return;
        }
        set(UNRESOLVED);
      })();
      return () => {
        cancelled = true;
      };
    }
    if (isAddonNativeMeta(meta)) {
      set(UNRESOLVED);
      return;
    }
    (async () => {
      if (tmdbKey) {
        const id = await tmdbImdbId(tmdbKey, meta.id).catch(() => null);
        if (id) {
          set({ id, verified: true });
          return;
        }
      }
      const fallback = await cinemetaImdbFallback(
        meta.name,
        narrowMediaType(meta.type),
        meta.releaseInfo,
      ).catch(() => null);
      set(fallback ? { id: fallback, verified: false } : UNRESOLVED);
    })();
    return () => {
      cancelled = true;
    };
  }, [meta.id, meta.type, meta.addonOrigin?.id, tmdbKey]);
  return resolved;
}
