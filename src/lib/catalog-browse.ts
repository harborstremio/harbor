import {
  createAddonCatalogFetcher,
  gatherCatalogAddons,
  isCollectionCatalog,
  type CatalogExtra,
} from "./addons";
import type { Meta, MetaType } from "./cinemeta";
import {
  extensionCatalogueBase,
  extensionCataloguePage,
  extensionCataloguesSync,
  isExtensionCatalogueBase,
  refreshExtensionCatalogues,
  subscribeExtensionCatalogues,
} from "./streams/plugins";

const NON_CONTENT = new Set(["addon_catalog"]);

const CATALOG_TYPE_LABEL_KEYS: Readonly<Record<string, string>> = {
  movie: "Movies",
  series: "Series",
  anime: "Anime",
  tv: "TV",
  channel: "Channels",
};

export function catalogTypeLabelKey(type: string): string | undefined {
  return CATALOG_TYPE_LABEL_KEYS[type];
}

export type BrowseCatalog = {
  key: string;
  addonName: string;
  addonLogo?: string;
  base: string;
  type: string;
  id: string;
  name: string;
  genreExtra: string | null;
  genres: string[];
};

/** A plugin's own rows, in the shape every browse surface already reads. `base` carries the plugin
 * and provider, because that is the field a pinned catalogue persists and reads back.
 *
 * The rows come from whatever the last look found, and a fresh look runs behind this call rather
 * than in front of it: the first one has to start a runtime and load every installed extension, and
 * the addon catalogues alongside them are not made to wait for that. */
function extensionCatalogs(includePlugins: boolean): BrowseCatalog[] {
  if (!includePlugins) return [];
  void refreshExtensionCatalogues();
  const rows = extensionCataloguesSync();
  const perPlugin = new Map<string, Set<string>>();
  for (const row of rows) {
    const seen = perPlugin.get(row.pluginId) ?? new Set<string>();
    seen.add(row.providerId);
    perPlugin.set(row.pluginId, seen);
  }
  return rows.map((row) => {
    const many = (perPlugin.get(row.pluginId)?.size ?? 1) > 1;
    // A hyphen rather than a dot: the provider follows the row and the pair reads as one name
    // rather than as two things joined by punctuation.
    const name = many && row.providerName ? `${row.row} - ${row.providerName}` : row.row;
    return {
      key: `${row.pluginId}-${row.providerId}-${row.row}`,
      addonName: row.pluginName,
      addonLogo: row.pluginIcon,
      base: extensionCatalogueBase(row.pluginId, row.providerId),
      type: row.type,
      id: row.row,
      name,
      genreExtra: null,
      genres: [],
    };
  });
}

export function subscribeBrowseCatalogs(cb: () => void): () => void {
  return subscribeExtensionCatalogues(cb);
}

/** A caller says whether a plugin's rows belong in its list. The Plugins page is where they belong
 * and always asks for them; every other surface asks only while the setting allows it. */
export async function listBrowseCatalogs(
  authKey: string | null,
  opts: { pluginRows: boolean },
): Promise<BrowseCatalog[]> {
  const out: BrowseCatalog[] = extensionCatalogs(opts.pluginRows);
  const addons = await gatherCatalogAddons(authKey).catch(() => []);
  for (const addon of addons) {
    const base = addon.transportUrl.replace(/\/manifest\.json$/, "");
    for (const cat of addon.manifest.catalogs ?? []) {
      if (!cat?.name || !cat.type || !cat.id) continue;
      if (NON_CONTENT.has(cat.type.toLowerCase())) continue;
      const extras = cat.extra ?? [];
      if (extras.some((e) => e.isRequired && e.name === "search")) continue;
      const genre = extras.find((e) => e.name === "genre" || e.name === "Genre");
      out.push({
        key: `${addon.manifest.id}-${cat.type}-${cat.id}`,
        addonName: addon.manifest.name,
        addonLogo: addon.manifest.logo,
        base,
        type: cat.type,
        id: cat.id,
        name: cat.name,
        genreExtra: genre ? genre.name : null,
        genres: genre?.options?.filter(Boolean) ?? [],
      });
    }
  }
  return out;
}

export function browseFetcher(
  cat: BrowseCatalog,
  genre: string | null,
): (page: number, loaded?: number) => Promise<Meta[]> {
  if (isExtensionCatalogueBase(cat.base)) {
    return (page: number) => extensionCataloguePage(cat.base, cat.id, cat.type as MetaType, page);
  }
  const extras: CatalogExtra[] | undefined =
    genre && cat.genreExtra ? [{ name: cat.genreExtra, value: genre }] : undefined;
  const cursor = { base: cat.base, type: cat.type, id: cat.id, extras };
  const origin = { id: cat.key, name: cat.addonName, logo: cat.addonLogo, base: cat.base };
  const collection = isCollectionCatalog({ type: cat.type, id: cat.id, name: cat.name });
  return createAddonCatalogFetcher(cursor, {
    mapMeta: (m) =>
      collection
        ? { ...m, addonOrigin: origin, isCollection: true }
        : { ...m, addonOrigin: origin },
  });
}
