export {
  ALL_LANGS,
  isAgnosticLang,
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

function isLocalSource(s: SuwayomiSource): boolean {
  return s.isLocal || s.id === "0" || s.lang.toLowerCase() === "localsourcelang";
}

const sourcesCache = new Map<string, SuwayomiSource[]>();

export function cachedSuwayomiSources(config: ServerConfig): Promise<SuwayomiSource[]> {
  const hit = sourcesCache.get(config.baseUrl);
  if (hit) return Promise.resolve(hit);
  return listSources(config).then((list) => {
    const sources = list.filter((s) => !isLocalSource(s));
    sourcesCache.set(config.baseUrl, sources);
    return sources;
  });
}

export function invalidateSuwayomiSources(baseUrl: string): void {
  sourcesCache.delete(baseUrl);
}
