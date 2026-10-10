// Source identifiers verified against Steam's public search controls, September 2026.
export const GAME_TAGS = [
  { id: 1695, key: "openWorld", label: "Open World" },
  { id: 1742, key: "storyRich", label: "Story Rich" },
  { id: 3834, key: "exploration", label: "Exploration" },
  { id: 3959, key: "roguelite", label: "Roguelite" },
  { id: 29482, key: "soulslike", label: "Souls-like" },
  { id: 1628, key: "metroidvania", label: "Metroidvania" },
  { id: 1654, key: "relaxing", label: "Relaxing" },
  { id: 1667, key: "horror", label: "Horror" },
  { id: 1662, key: "survival", label: "Survival" },
  { id: 1643, key: "building", label: "Building" },
  { id: 1664, key: "puzzle", label: "Puzzle" },
  { id: 1677, key: "turnBased", label: "Turn-Based" },
  { id: 19, key: "action", label: "Action" },
  { id: 21, key: "adventure", label: "Adventure" },
  { id: 122, key: "rpg", label: "RPG" },
  { id: 1754, key: "mmorpg", label: "MMORPG" },
  { id: 9, key: "strategy", label: "Strategy" },
  { id: 599, key: "simulation", label: "Simulation" },
] as const;

// Steam genres also include labels outside the curated discovery tag menu.
// Verified with IStoreService/GetTagList (English), October 2, 2026.
const GENRE_TAGS: Record<string, number> = {
  "indie": 492, "casual": 597, "sports": 701, "racing": 699,
  "free to play": 113, "massively multiplayer": 128, "early access": 493,
};
export function genreCatalogTag(genre: string): number | undefined {
  const name = genre.trim().toLowerCase();
  return GAME_TAGS.find(tag => tag.label.toLowerCase() === name)?.id ?? GENRE_TAGS[name];
}

export type CatalogFilters = {
  tags: number[];
  platform: "all" | "win" | "mac" | "linux";
  mode: "all" | "2" | "1" | "9" | "39" | "20";
  price: "all" | "free" | "offers";
  controller: boolean;
  sort: "_ASC" | "Released_DESC" | "Name_ASC" | "Price_ASC" | "Reviews_DESC";
  developer?: string;
  publisher?: string;
  features?: { id: number; name: string }[];
};
export const DEFAULT_CATALOG_FILTERS: CatalogFilters = { tags: [], platform: "all", mode: "all", price: "all", controller: false, sort: "_ASC" };
export const CATALOG_PAGE_SIZE = 30;

export function catalogParameters(query: string, filters: CatalogFilters, offset = 0): URLSearchParams {
  const params = new URLSearchParams({ term: query.trim().slice(0, 180), start: String(Math.max(0, Math.floor(offset))), count: String(CATALOG_PAGE_SIZE), category1: "998", cc: "us", l: "english", infinite: "1", sort_by: filters.sort });
  const tags = [...new Set(filters.tags)].filter(id => Number.isSafeInteger(id) && id > 0).slice(0, 32).sort((a, b) => a - b);
  if (tags.length) params.set("tags", tags.join(","));
  if (filters.platform !== "all") params.set("os", filters.platform);
  if (filters.mode !== "all") params.set("category3", filters.mode);
  const features = [...new Set((filters.features ?? []).map(feature => feature.id))].filter(id => Number.isSafeInteger(id) && id > 0 && id <= 4_294_967_295).slice(0, 32).sort((a, b) => a - b);
  if (features.length) params.set("category2", features.join(","));
  if (filters.price === "free") params.set("maxprice", "free");
  if (filters.price === "offers") params.set("specials", "1");
  if (filters.controller) params.set("controllersupport", "28");
  if (filters.developer) params.set("developer", filters.developer.slice(0, 180));
  if (filters.publisher) params.set("publisher", filters.publisher.slice(0, 180));
  return params;
}
