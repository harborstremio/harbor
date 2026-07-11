import { usePinnedCatalogs } from "@/lib/pinned-catalogs";
import { buildPinnedCatalogRows, pinnedRowKey } from "@/lib/pinned-catalogs-rows";
import { useAnilistAnimeRails } from "@/lib/use-anilist-anime-rails";
import { useAnilistTrending, useAnilistTop } from "@/lib/use-anilist-top";
import { useMalAnimeRails } from "@/lib/use-mal-anime-rails";
import { useEffect, useMemo, useState } from "react";

import type { HomeRow } from "../home-types";

export function usePinnedRows(): HomeRow[] {
  const pinned = usePinnedCatalogs();
  const anilistRails = useAnilistAnimeRails();
  const malRails = useMalAnimeRails();
  const trendingMetas = useAnilistTrending();
  const topMetas = useAnilistTop();
  const [catalogRows, setCatalogRows] = useState<HomeRow[]>([]);

  const catalogKey = pinned
    .filter((p) => p.source === "catalog")
    .map((p) => p.id)
    .join("|");

  useEffect(() => {
    let cancelled = false;
    buildPinnedCatalogRows(pinned)
      .then((rows) => {
        if (!cancelled) setCatalogRows(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [catalogKey]);

  const extraMap = useMemo(() => {
    const m = new Map<string, HomeRow>();
    if (trendingMetas.length > 0) {
      m.set("trending", {
        key: "",
        type: "series",
        name: "",
        metas: trendingMetas,
        page: 1,
        hasMore: false,
        noDedup: true,
      });
    }
    if (topMetas.length > 0) {
      m.set("top100", { key: "", type: "series", name: "", metas: topMetas, page: 1, hasMore: false, noDedup: true });
    }
    return m;
  }, [trendingMetas, topMetas]);

  return useMemo(() => {
    const catalogById = new Map<string, HomeRow>();
    for (const r of catalogRows) catalogById.set(r.key, r);
    const out: HomeRow[] = [];
    for (const desc of pinned) {
      const key = pinnedRowKey(desc.id);
      if (desc.source === "catalog") {
        const row = catalogById.get(key);
        if (row) out.push(row);
      } else if (desc.source === "anilist") {
        const extra = extraMap.get(desc.params.railKey);
        if (extra) {
          out.push({ ...extra, key, name: desc.name });
          continue;
        }
        const rail = anilistRails.find((r) => r.key === desc.params.railKey);
        if (rail && rail.metas.length > 0) {
          out.push({ key, type: "series", name: desc.name, metas: rail.metas, page: 1, hasMore: false, noDedup: true });
        }
      } else if (desc.source === "mal") {
        const rail = malRails.find((r) => r.key === desc.params.railKey);
        if (rail && rail.metas.length > 0) {
          out.push({ key, type: "series", name: desc.name, metas: rail.metas, page: 1, hasMore: false, noDedup: true });
        }
      }
    }
    return out;
  }, [pinned, catalogRows, anilistRails, malRails, extraMap]);
}
