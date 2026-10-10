import { browseFetcher, type BrowseCatalog } from "./catalog-browse";
import type { Meta } from "./cinemeta";
import type { HomeRow } from "@/views/home/home-types";
import type { PinnedCatalog } from "./pinned-catalogs";
import { isExtensionCatalogueBase } from "./streams/plugins";

const MAX_PER_ROW = 30;
const PAGE_HINT = 20;

function toBrowseCatalog(desc: PinnedCatalog): BrowseCatalog | null {
  const { base, type, id } = desc.params;
  if (!base || !type || !id) return null;
  return {
    key: desc.id,
    addonName: "",
    base,
    type,
    id,
    name: desc.name,
    genreExtra: null,
    genres: [],
  };
}

export function pinnedRowKey(id: string): string {
  return `pinned:${id}`;
}

export async function buildPinnedCatalogRows(
  descriptors: PinnedCatalog[],
  opts: { pluginRows: boolean },
): Promise<HomeRow[]> {
  // A pinned row that came from a plugin is still a plugin being asked, so it goes with the rest
  // when the setting keeps plugins out of the surfaces outside their own page.
  const catalogDescs = descriptors.filter(
    (d) =>
      d.source === "catalog" &&
      (opts.pluginRows || !isExtensionCatalogueBase(d.params.base ?? "")),
  );
  const built = await Promise.all(
    catalogDescs.map(async (desc) => {
      const cat = toBrowseCatalog(desc);
      if (!cat) return null;
      const fetcher = browseFetcher(cat, null);
      const metas = await fetcher(1).catch(() => [] as Meta[]);
      if (metas.length === 0) return null;
      const row: HomeRow = {
        key: pinnedRowKey(desc.id),
        type: cat.type === "movie" ? "movie" : "series",
        name: desc.name,
        metas: metas.slice(0, MAX_PER_ROW),
        page: 1,
        hasMore: metas.length >= PAGE_HINT,
        noDedup: true,
        fetcher,
      };
      return row;
    }),
  );
  return built.filter((r): r is HomeRow => r != null);
}
