import { t } from "@/lib/i18n";
import type { Meta } from "@/lib/cinemeta";
import type { HomeRow } from "@/views/home/home-types";
import { russianRows } from "./index";

export async function buildRussianHomeRows(tmdbKey: string): Promise<HomeRow[]> {
  if (!tmdbKey) return [];
  const defs = russianRows();
  const firstPages = await Promise.all(
    defs.map((def) => def.fetch(tmdbKey, 1).catch(() => [] as Meta[])),
  );
  return defs
    .map((def, i) => {
      const metas = firstPages[i];
      return {
        key: `russian-${def.id}`,
        type: def.type,
        name: t(def.title),
        metas,
        page: 1,
        hasMore: metas.length > 0,
        noDedup: true,
        fetcher: (page: number) => def.fetch(tmdbKey, page),
      };
    })
    .filter((row) => row.metas.length > 0);
}
