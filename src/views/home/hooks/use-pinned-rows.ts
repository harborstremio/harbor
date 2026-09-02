import { useEffect, useMemo, useState } from "react";
import { pinnedBuiltinTitle, usePinnedCatalogs, type PinnedCatalog } from "@/lib/pinned-catalogs";
import { buildPinnedCatalogRows, pinnedRowKey } from "@/lib/pinned-catalogs-rows";
import { useAnilistAnimeRails } from "@/lib/use-anilist-anime-rails";
import { useMalAnimeRails } from "@/lib/use-mal-anime-rails";
import { useAnilistTrending, useAnilistTop } from "@/lib/use-anilist-top";
import type { HomeRow } from "../home-types";
import { useT } from "@/lib/i18n";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

function pinnedTitle(desc: PinnedCatalog, t: Translate): string {
  const title = pinnedBuiltinTitle(desc.source, desc.params.railKey);
  if (!title) return desc.name;
  return title.valueKey ? t(title.key, { name: t(title.valueKey) }) : t(title.key);
}

export function usePinnedRows(): HomeRow[] {
  const t = useT();
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
      m.set("top100", {
        key: "",
        type: "series",
        name: "",
        metas: topMetas,
        page: 1,
        hasMore: false,
        noDedup: true,
      });
    }
    return m;
  }, [trendingMetas, topMetas]);

  return useMemo(() => {
    const catalogById = new Map<string, HomeRow>();
    for (const r of catalogRows) catalogById.set(r.key, r);
    const out: HomeRow[] = [];
    for (const desc of pinned) {
      const key = pinnedRowKey(desc.id);
      const name = pinnedTitle(desc, t);
      if (desc.source === "catalog") {
        const row = catalogById.get(key);
        if (row) out.push(row);
      } else if (desc.source === "anilist") {
        const extra = extraMap.get(desc.params.railKey);
        if (extra) {
          out.push({ ...extra, key, name });
          continue;
        }
        const rail = anilistRails.find((r) => r.key === desc.params.railKey);
        if (rail && rail.metas.length > 0) {
          out.push({
            key,
            type: "series",
            name,
            metas: rail.metas,
            page: 1,
            hasMore: false,
            noDedup: true,
          });
        }
      } else if (desc.source === "mal") {
        const rail = malRails.find((r) => r.key === desc.params.railKey);
        if (rail && rail.metas.length > 0) {
          out.push({
            key,
            type: "series",
            name,
            metas: rail.metas,
            page: 1,
            hasMore: false,
            noDedup: true,
          });
        }
      }
    }
    return out;
  }, [pinned, catalogRows, anilistRails, malRails, extraMap, t]);
}
