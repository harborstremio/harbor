import { useMemo } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { useSharedCrew, useAdaptationFamily, type SharedCrewFilm } from "@/lib/providers/wikidata-graph";

export type GraphReason = { label: string; detail?: string; rank: number };

export function useGraphReasons(
  imdbId?: string,
  isAnime = false,
): { crew: SharedCrewFilm[]; reasons: Map<string, GraphReason> } {
  const t = useT();
  const seed = isAnime || !imdbId || !/^tt\d+$/.test(imdbId) ? undefined : imdbId;
  const crew = useSharedCrew(seed);
  const family = useAdaptationFamily(seed);

  const reasons = useMemo(() => {
    const map = new Map<string, GraphReason>();
    for (const sibling of family?.siblings ?? []) {
      map.set(sibling.metaId, {
        label: t("Same source"),
        detail: family?.source.title,
        rank: 1,
      });
    }
    for (const film of crew) {
      map.set(film.metaId, {
        label: t("Shares {n} crew", { n: film.shared }),
        detail: film.who.join(", "),
        rank: 100 + film.shared,
      });
    }
    return map;
  }, [crew, family, t]);

  return { crew, reasons };
}

export function orderByReason(metas: Meta[], reasons: Map<string, GraphReason>): Meta[] {
  if (reasons.size === 0 || metas.length < 2) return metas;
  if (!metas.some((m) => reasons.has(m.id))) return metas;
  return metas
    .map((meta, index) => ({ meta, index, rank: reasons.get(meta.id)?.rank ?? 0 }))
    .sort((a, b) => b.rank - a.rank || a.index - b.index)
    .map((entry) => entry.meta);
}
