import { EMULATION_SYSTEMS } from "./emulation";
import { ATLAS_DETAIL_FIELDS, parseAtlasGame, type AtlasGame, type GameConnection } from "./igdb-data";
import { savedMetadataAt } from "./metadata-records";
import { GAME_PLATFORMS } from "./platforms";
import { releasedOn } from "./release-data";

// Catalog scope, not a promise of native playback support. Launch support stays
// with emulation.ts. Additional Nintendo IDs/logos verified through live IGDB
// platform connections on 2026-09-30 (work/rom-discovery/platforms.json).
// Missing directory marks verified against IGDB platform connections and
// original Wikimedia logo files on October 1; provenance in ARTWORK.md.
const directoryMarks: Readonly<Record<number, string>> = {
  19: "/games/platforms/snes-logo.svg",
  4: "/games/platforms/n64-logo.svg",
  21: "/games/platforms/gamecube-logo.svg",
  7: "/games/platforms/playstation-logo.svg",
  18: "/games/platforms/nes-logo.svg",
  22: "/games/platforms/gbc-logo.svg",
  5: "/games/platforms/wii-logo.svg",
  33: "/games/platforms/gameboy-logo.svg",
  20: "/games/platforms/ds-logo.svg",
  38: "https://images.igdb.com/igdb/image/upload/t_logo_med/pl5y.png",
  29: "/games/platforms/genesis-logo.svg",
  64: "/games/platforms/master-system-logo.png",
  35: "https://images.igdb.com/igdb/image/upload/t_logo_med/pl7z.png",
  23: "https://images.igdb.com/igdb/image/upload/t_logo_med/pl7i.png",
};
export const ROM_PLATFORMS: ReadonlyArray<{ id: number; name: string; short: string; image?: string }> = [
  ...EMULATION_SYSTEMS.map(({ id, name, short }) => ({ id, name, short, image: directoryMarks[id] || GAME_PLATFORMS.find(platform => platform.id === id)?.image })),
  ...GAME_PLATFORMS.filter(platform => [8, 9, 11, 12].includes(platform.id)).map(({ id, name, short, image }) => ({ id, name, short, image: id === 8 ? "/games/platforms/ps2-logo.svg" : image })),
  { id: 37, name: "Nintendo 3DS", short: "3DS", image: "/games/platforms/3ds-logo.svg" },
  { id: 41, name: "Wii U", short: "Wii U", image: "https://images.igdb.com/igdb/image/upload/t_logo_med/pl6n.png" },
];
export const ROM_PLATFORM_IDS: readonly number[] = ROM_PLATFORMS.map(platform => platform.id);
// Default discovery leads with cartridge-era consoles/handhelds and PS1/Saturn/
// Dreamcast. A PS3/360 port must not make a modern PC bestseller a ROM classic.
// This is a catalog criterion, not a fixed list of games or a playback promise.
export const ROM_CLASSIC_PLATFORM_IDS: readonly number[] = [18, 19, 4, 33, 22, 24, 7, 29, 64, 35, 32, 23];
export const ROM_PAGE_SIZE = 36;
export const ROM_COLLECTIONS = ["all", "rated", "coop", "platformer", "rpg"] as const;
export type RomCollection = typeof ROM_COLLECTIONS[number];
export type RomRelationship = { kind: "franchise" | "series"; id: number };
export type RomDiscoveryFilters = {
  query: string;
  scope?: "all" | "classics";
  platform?: number;
  genre?: number;
  studio?: number;
  directory?: boolean;
  mode?: number;
  perspective?: number;
  year?: number;
  era: "all" | "before1990" | "1990" | "2000" | "2010" | "2020";
  sort: "relevance" | "discussed" | "rated" | "newest" | "oldest" | "name";
  collection?: RomCollection;
  relationship?: RomRelationship;
};
export const DEFAULT_ROM_FILTERS: RomDiscoveryFilters = { query: "", era: "all", sort: "discussed", collection: "all" };
export type RomFranchise = GameConnection & RomRelationship & {
  /** Examples from loaded results, never the franchise's total catalog. */
  games: AtlasGame[];
};
export type RomDiscoveryPage = {
  games: AtlasGame[];
  nextOffset: number | null;
  cachedAt?: number;
  platforms: GameConnection[];
  genres: GameConnection[];
  franchises: RomFranchise[];
};
type Sources = {
  query: (body: string, signal?: AbortSignal) => Promise<unknown[]>;
  snapshot: (body: string) => Promise<unknown[] | null>;
};
const positiveId = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const pageOffset = (offset: number) => {
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("Invalid ROM catalog offset");
  return offset;
};

/** Build collections from provider criteria, never fixed lists of game IDs. */
export function romDiscoveryQuery(filters: RomDiscoveryFilters, offset = 0): string {
  if (filters.scope !== undefined && !["all", "classics"].includes(filters.scope)) throw new Error("Invalid ROM scope");
  const classicDiscovery = filters.scope === "classics" && !filters.query.trim();
  const platforms = classicDiscovery && filters.platform === undefined ? ROM_CLASSIC_PLATFORM_IDS : ROM_PLATFORM_IDS;
  const clauses = [`platforms = (${platforms.join(",")})`];
  if (classicDiscovery) clauses.push("game_type = (0,8,9,10,11)", "version_parent = null");
  if (filters.platform !== undefined) {
    if (!ROM_PLATFORM_IDS.includes(filters.platform)) throw new Error("Invalid ROM platform");
    clauses.push(`platforms = (${filters.platform})`);
  }
  if (filters.genre !== undefined) {
    if (!positiveId(filters.genre)) throw new Error("Invalid ROM genre");
    clauses.push(`genres = (${filters.genre})`);
  }
  if (filters.studio !== undefined) {
    if (!positiveId(filters.studio)) throw new Error("Invalid ROM studio");
    clauses.push(`involved_companies.company = (${filters.studio})`);
  }
  if (filters.directory) clauses.push("(franchises != null | collections != null)");
  for (const [key,field] of [['mode','game_modes'],['perspective','player_perspectives']] as const) {
    const id=filters[key];
    if(id!==undefined){if(!positiveId(id))throw new Error('Invalid ROM '+key);clauses.push(`${field} = (${id})`);}
  }
  const collection = filters.collection ?? "all";
  if (!ROM_COLLECTIONS.includes(collection)) throw new Error("Invalid ROM collection");
  if (collection === "rated") clauses.push("total_rating >= 80", "total_rating_count >= 20");
  if (collection === "coop") clauses.push("game_modes = (3)");
  if (collection === "platformer") clauses.push("genres = (8)");
  if (collection === "rpg") clauses.push("genres = (12)");
  if (filters.relationship) {
    const { kind, id } = filters.relationship;
    if (!["franchise", "series"].includes(kind) || !positiveId(id)) throw new Error("Invalid ROM relationship");
    clauses.push(`${kind === "franchise" ? "franchises" : "collections"} = (${id})`);
  }
  if (filters.year !== undefined) {
    if (!Number.isInteger(filters.year) || filters.year < 1950 || filters.year > new Date().getUTCFullYear()) throw Error("Invalid ROM year");
    clauses.push(`first_release_date >= ${Date.UTC(filters.year, 0, 1) / 1000}`, `first_release_date < ${Date.UTC(filters.year + 1, 0, 1) / 1000}`);
  }
  if (filters.era !== "all") {
    const era = { before1990: [1950, 1990], "1990": [1990, 2000], "2000": [2000, 2010], "2010": [2010, 2020], "2020": [2020, 2030] }[filters.era];
    if (!era) throw new Error("Invalid ROM era");
    clauses.push(`first_release_date >= ${Date.UTC(era[0], 0, 1) / 1000}`, `first_release_date < ${Date.UTC(era[1], 0, 1) / 1000}`);
  }
  const order = { relevance: "total_rating_count desc", discussed: "total_rating_count desc", rated: "total_rating desc", newest: "first_release_date desc", oldest: "first_release_date asc", name: "name asc" }[filters.sort];
  if (!order) throw new Error("Invalid ROM sort");
  if (filters.sort === "rated" && collection !== "rated") clauses.push("total_rating_count >= 5");
  const term = filters.query.trim().slice(0, 160).replace(/["\\\x00-\x1f\x7f]/g, " ");
  // Provider search handles accents and alternate titles. Explicit name/date/
  // rating orders use a composable filter instead of pretending page-local
  // sorting is a global ordering of search results.
  const search = !!term && filters.sort === "relevance";
  if (term && !search) clauses.push(`(name ~ *"${term}"* | alternative_names.name ~ *"${term}"*)`);
  return `${search ? `search "${term}"; ` : ""}fields ${ATLAS_DETAIL_FIELDS}; where ${clauses.join(" & ")}; ${search ? "" : `sort ${order}; `}limit ${ROM_PAGE_SIZE}; offset ${pageOffset(offset)};`;
}

function uniqueConnections(values: GameConnection[]): GameConnection[] {
  return [...new Map(values.map(value => [value.id, value])).values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Keep series and franchise namespaces distinct, even when numeric IDs coincide. */
export function romFranchises(games: readonly AtlasGame[]): RomFranchise[] {
  const connections = new Map<string, RomFranchise>();
  for (const game of games) {
    for (const [kind, related] of [["franchise", game.franchises], ["series", game.series]] as const) {
      for (const connection of related) {
        const key = `${kind}:${connection.id}`;
        const previous = connections.get(key);
        if (previous) {
          if (!previous.games.some(value => value.igdbId === game.igdbId)) previous.games.push(game);
          if (!previous.image) previous.image = game.hero || game.portrait || undefined;
        } else connections.set(key, { ...connection, kind, image: game.hero || game.portrait || undefined, games: [game] });
      }
    }
  }
  return [...connections.values()].sort((a, b) => b.games.length - a.games.length || a.name.localeCompare(b.name));
}

function romPage(rows: unknown[], offset: number, filters: RomDiscoveryFilters): RomDiscoveryPage {
  // A shared PC port ID is not enough to merge distinct console releases.
  const classicDiscovery = filters.scope === "classics" && !filters.query.trim();
  const platforms = filters.platform === undefined ? ROM_CLASSIC_PLATFORM_IDS : [filters.platform];
  const games = [...new Map(rows.map(parseAtlasGame).filter(game => !classicDiscovery || releasedOn(game.releaseHistory, platforms)).map(game => [game.igdbId, { ...game, id: `igdb:${game.igdbId}` }])).values()];
  return {
    games, nextOffset: rows.length === ROM_PAGE_SIZE ? offset + ROM_PAGE_SIZE : null, cachedAt: savedMetadataAt(rows),
    platforms: uniqueConnections(games.flatMap(game => game.platformLinks).filter(platform => ROM_PLATFORM_IDS.includes(platform.id))),
    genres: uniqueConnections(games.flatMap(game => game.genres)), franchises: romFranchises(games),
  };
}

export function createRomDiscovery(sources: Sources) {
  async function load(filters: RomDiscoveryFilters = DEFAULT_ROM_FILTERS, offset = 0, signal?: AbortSignal): Promise<RomDiscoveryPage> {
    signal?.throwIfAborted();
    const body = romDiscoveryQuery(filters, offset);
    const rows = await sources.query(body, signal);
    signal?.throwIfAborted();
    return romPage(rows, offset, filters);
  }
  async function snapshot(filters: RomDiscoveryFilters = DEFAULT_ROM_FILTERS, offset = 0): Promise<RomDiscoveryPage | null> {
    const body = romDiscoveryQuery(filters, offset);
    try { const rows = await sources.snapshot(body); return rows ? romPage(rows, offset, filters) : null; }
    catch { return null; }
  }
  return { load, snapshot };
}

const discovery = createRomDiscovery({
  query: (...args) => import("./atlas").then(module => module.queryIgdb(...args)),
  snapshot: (...args) => import("./atlas").then(module => module.readIgdbSnapshot(...args)),
});
export const loadRomDiscoveryPage = discovery.load;
export const readRomDiscoverySnapshot = discovery.snapshot;
