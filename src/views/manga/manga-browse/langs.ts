export {
  ALL_LANGS,
  langFilterMatches,
  loadMangaLangFilter,
  mangaLangFilterRevision,
  saveMangaLangFilter,
  subscribeMangaLangFilter,
} from "@/lib/manga/lang-filter";

import {
  listSources,
  type ServerConfig,
  type SuwayomiSource,
} from "@/lib/manga/sources/suwayomi/provider";

const sourcesCache = new Map<string, SuwayomiSource[]>();

export function cachedSuwayomiSources(config: ServerConfig): Promise<SuwayomiSource[]> {
  const hit = sourcesCache.get(config.baseUrl);
  if (hit) return Promise.resolve(hit);
  return listSources(config).then((list) => {
    sourcesCache.set(config.baseUrl, list);
    return list;
  });
}

export function invalidateSuwayomiSources(baseUrl: string): void {
  sourcesCache.delete(baseUrl);
}
