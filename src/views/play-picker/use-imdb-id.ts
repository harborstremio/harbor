import { narrowMediaType, isAddonNativeMeta, type Meta } from "@/lib/cinemeta";
import { animeKitsuMeta } from "@/lib/providers/anime-kitsu-addon";
import { kitsuToImdb } from "@/lib/providers/anime-mapping";
import { tmdbImdbId } from "@/lib/providers/tmdb";
import { useEffect, useState } from "react";

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
    if (meta.id.startsWith("kitsu:") || meta.id.startsWith("mal:")) {
      (async () => {
        const addonRes = await animeKitsuMeta(meta.id).catch(() => null);
        if (addonRes?.imdb_id) {
          set({ id: addonRes.imdb_id, verified: true });
          return;
        }
        if (meta.id.startsWith("kitsu:")) {
          const n = parseInt(meta.id.slice("kitsu:".length), 10);
          if (Number.isFinite(n)) {
            const fromXml = await kitsuToImdb(n).catch(() => null);
            set(fromXml ? { id: fromXml, verified: true } : UNRESOLVED);
            return;
          }
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
      const fallback = await cinemetaImdbFallback(meta.name, narrowMediaType(meta.type), meta.releaseInfo).catch(
        () => null,
      );
      set(fallback ? { id: fallback, verified: false } : UNRESOLVED);
    })();
    return () => {
      cancelled = true;
    };
  }, [meta.id, meta.type, meta.addonOrigin?.id, tmdbKey]);
  return resolved;
}
