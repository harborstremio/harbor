import {
  sourceSearch,
  type ServerConfig,
  type SuwayomiSource,
} from "@/lib/manga/sources/suwayomi/provider";
import type { MangaSummary } from "@/lib/manga/types";

const CONCURRENCY = 4;

export async function searchExtensions(
  config: ServerConfig,
  sources: SuwayomiSource[],
  query: string,
  isCancelled: () => boolean,
  onChunk: (source: SuwayomiSource, items: MangaSummary[]) => void,
): Promise<{ okSources: number; failedSources: number }> {
  let next = 0;
  let okSources = 0;
  let failedSources = 0;

  const worker = async () => {
    while (!isCancelled()) {
      const source = sources[next++];
      if (!source) return;
      try {
        const page = await sourceSearch(config, source.id, query, 1);
        if (isCancelled()) return;
        okSources++;
        if (page.manga.length > 0) onChunk(source, page.manga);
      } catch {
        failedSources++;
      }
    }
  };

  const workers = Array.from(
    { length: Math.min(CONCURRENCY, sources.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return { okSources, failedSources };
}
