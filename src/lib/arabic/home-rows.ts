import type { Meta } from "@/lib/cinemeta";
import { t } from "@/lib/i18n";
import type { HomeRow } from "@/views/home/home-types";

import { ARABIC_ROWS } from "./index";

export async function buildArabicHomeRows(tmdbKey: string): Promise<HomeRow[]> {
  if (!tmdbKey) return [];
  const firstPages = await Promise.all(ARABIC_ROWS.map((def) => def.fetch(tmdbKey, 1).catch(() => [] as Meta[])));
  return ARABIC_ROWS.map((def, i) => {
    const metas = firstPages[i];
    return {
      key: `arabic-${def.id}`,
      type: def.type,
      name: t(def.titleKey),
      metas,
      page: 1,
      hasMore: metas.length > 0,
      noDedup: true,
      fetcher: (page: number) => def.fetch(tmdbKey, page),
    };
  }).filter((row) => row.metas.length > 0);
}
