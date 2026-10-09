import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { CLOUD_OK, libraryGetOne, type LibraryItem } from "@/lib/stremio";

// The recency capped Continue Watching list misses anything older than its top
// slice and is keyed on tt ids, so tmdb metas never match. Resolve per title
// the way the desktop detail view does.
export function useBpLibraryItem(metaId: string, imdbId: string | null): LibraryItem | null {
  const { authKey } = useAuth();
  const [item, setItem] = useState<LibraryItem | null>(null);

  useEffect(() => {
    setItem(null);
    if (!authKey || metaId.startsWith("simkl:")) return;
    const candidates: string[] = [];
    if (metaId.startsWith("tt")) candidates.push(metaId);
    if (imdbId?.startsWith("tt") && !candidates.includes(imdbId)) candidates.push(imdbId);
    if (!metaId.startsWith("tt") && CLOUD_OK.test(metaId)) candidates.push(metaId);
    if (candidates.length === 0) return;

    let cancelled = false;
    void (async () => {
      for (const cid of candidates) {
        const found = await libraryGetOne(authKey, cid).catch(() => null);
        if (cancelled) return;
        if (found) {
          setItem(found);
          return;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authKey, metaId, imdbId]);

  return item;
}
