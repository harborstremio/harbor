import {
  createAddonCatalogFetcher,
  gatherCatalogAddons,
  isCollectionCatalog,
  type CatalogExtra,
} from "./addons";

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

export async function listBrowseCatalogs(authKey: string | null): Promise<BrowseCatalog[]> {
  const addons = await gatherCatalogAddons(authKey).catch(() => []);
  const out: BrowseCatalog[] = [];
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

export function browseFetcher(cat: BrowseCatalog, genre: string | null) {
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
