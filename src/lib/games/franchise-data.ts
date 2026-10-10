import { ATLAS_SUMMARY_FIELDS, ATLAS_PAGE_SIZE, atlasQuery, parseAtlasGame, type AtlasFilters, type AtlasGame, type AtlasRoute } from "./igdb-data";
import { savedMetadataAt } from "./metadata-records";
import { franchiseArtwork } from "./franchise-artwork";

// Editorial doorways, not fixed catalogs. Each identity/relationship was checked
// against IGDB and is verified again when its provider record is loaded.
export const FRANCHISE_SEEDS = [
  { seed: 132181, kind: "franchise", id: 29 },
  { seed: 1942, kind: "franchise", id: 452 },
  { seed: 9630, kind: "franchise", id: 1034 },
  { seed: 19560, kind: "franchise", id: 2098 },
  { seed: 7346, kind: "franchise", id: 596 },
  { seed: 26758, kind: "franchise", id: 845 },
  { seed: 2406, kind: "franchise", id: 4 },
  { seed: 25076, kind: "series", id: 366 },
  { seed: 119133, kind: "franchise", id: 8190 },
  { seed: 134070, kind: "series", id: 562 },
  { seed: 1020, kind: "franchise", id: 493 },
  { seed: 72, kind: "franchise", id: 1724 },
  { seed: 472, kind: "franchise", id: 456 },
  { seed: 2155, kind: "franchise", id: 1124 },
  { seed: 7351, kind: "franchise", id: 798 },
  { seed: 73, kind: "franchise", id: 1048 },
] as const;
export type GameFranchise = {
  id: string; name: string; hero: string; route: AtlasRoute;
  featuredGame: AtlasGame; cachedAt?: number;
};
export type GameFranchisePage = { games: AtlasGame[]; nextOffset: number | null; cachedAt?: number };
const FIELDS = `${ATLAS_SUMMARY_FIELDS},collections.name,franchises.name,parent_game.name,parent_game.cover.image_id,parent_game.platforms.name,parent_game.external_games.external_game_source,parent_game.external_games.uid`;
export const FRANCHISE_INDEX_QUERY = `fields ${FIELDS}; where id = (${FRANCHISE_SEEDS.map(seed => seed.seed).join(",")}); limit 20;`;
export const FRANCHISE_DISCOVERY_SIZE = 60;
export function franchiseDiscoveryQuery(offset = 0) {
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("Invalid franchise offset");
  return `fields ${FIELDS}; where cover != null & version_parent = null & total_rating_count >= 1 & (screenshots != null | artworks != null) & (franchises != null | collections != null); sort total_rating_count desc; limit ${FRANCHISE_DISCOVERY_SIZE}; offset ${offset};`;
}

// Cursor zero keeps the existing doorways fast; positive cursors address the
// provider's ranked discovery feed (cursor 1 = provider offset 0).
export function gameWorldsQuery(cursor = 0) {
  if (!Number.isSafeInteger(cursor) || cursor < 0) throw new Error("Invalid world cursor");
  return cursor === 0 ? FRANCHISE_INDEX_QUERY : franchiseDiscoveryQuery(cursor - 1);
}
export function parseGameWorldsPage(rows: unknown[], cursor: number) {
  gameWorldsQuery(cursor);
  return {
    games: uniqueGameWorlds(cursor === 0 ? parseFranchiseIndex(rows) : parseFranchiseDiscovery(rows)),
    // Advance by raw provider records, including pages consisting of repeats.
    nextOffset: cursor === 0 ? 1 : rows.length === FRANCHISE_DISCOVERY_SIZE ? cursor + FRANCHISE_DISCOVERY_SIZE : null,
    cachedAt: savedMetadataAt(rows),
  };
}

/** Relationship IDs from live records, not title matching or a finite seed list. */
export function parseFranchiseDiscovery(rows: unknown[]): GameFranchise[] {
  const worlds = new Map<string, GameFranchise>(), names = new Set<string>();
  for (const game of rows.map(parseAtlasGame)) {
    const hero = game.screenshots[0] || game.hero;
    if (!hero) continue;
    // A game belongs to several subseries. One franchise doorway avoids showing
    // Mario, Super Mario, Mario Bros. and Super Mario 64 over the same artwork.
    for (const [kind, relations] of (game.franchises.length ? [["franchise", game.franchises]] : [["series", game.series]]) as ["franchise"|"series",typeof game.franchises][]) {
      for (const relation of relations) {
        const id = `${kind}:${relation.id}`, name = relation.name.toLocaleLowerCase();
        if (worlds.has(id) || names.has(name)) continue;
        const image=franchiseArtwork(id)?.hero??hero;
        worlds.set(id, { id, name: relation.name, hero:image, featuredGame: game, cachedAt: savedMetadataAt(rows), route: { kind, id: relation.id, name: relation.name, image } }); names.add(name);
        break;
      }
    }
  }
  return [...worlds.values()];
}

export function parseFranchiseIndex(rows: unknown[]): GameFranchise[] {
  const games = rows.map(parseAtlasGame), cachedAt = savedMetadataAt(rows);
  return FRANCHISE_SEEDS.flatMap(seed => {
    const game = games.find(game => game.igdbId === seed.seed);
    const relation = (seed.kind === "series" ? game?.series : game?.franchises)?.find(relation => relation.id === seed.id);
    if (!game || !relation || !game.hero) return [];
    const hero = franchiseArtwork(`${seed.kind}:${seed.id}`)?.hero || game.screenshots[0] || game.hero;
    return [{ id: `${seed.kind}:${seed.id}`, name: relation.name, hero, featuredGame: game, cachedAt,
      route: { kind: seed.kind, id: relation.id, name: relation.name, image: hero } }];
  });
}

export function uniqueGameWorlds(worlds: GameFranchise[]): GameFranchise[] {
  const ids=new Set<string>(),names=new Set<string>(),games=new Set<number>(),images=new Set<string>();
  return worlds.filter(world=>{
    const name=world.name.toLocaleLowerCase().replace(/^the\s+/,'').replace(/^red dead redemption$/,'red dead');
    if(ids.has(world.id)||names.has(name)||games.has(world.featuredGame.igdbId)||images.has(world.hero))return false;
    ids.add(world.id);names.add(name);games.add(world.featuredGame.igdbId);images.add(world.hero);return true;
  });
}
export function franchiseRoute(id: string): AtlasRoute {
  const match = /^(franchise|series):([1-9]\d*)$/.exec(id), identity = Number(match?.[2]);
  if (!match || !Number.isSafeInteger(identity)) throw Error("Invalid franchise identity");
  return { kind: match[1] as "franchise" | "series", id: identity, name: "" };
}
export function franchiseQuery(id: string, filters: AtlasFilters, offset = 0) {
  return atlasQuery(franchiseRoute(id), filters, offset).replace(`fields ${ATLAS_SUMMARY_FIELDS};`, `fields ${FIELDS};`);
}
export function parseFranchisePage(rows: unknown[], id: string, offset: number): GameFranchisePage {
  const route = franchiseRoute(id), cachedAt = savedMetadataAt(rows);
  const games = rows.map(parseAtlasGame).filter(game => (route.kind === "series" ? game.series : game.franchises).some(relation => relation.id === route.id));
  if (rows.length && !games.length) throw Error("Franchise relationship unavailable");
  return { games: [...new Map(games.map(game => [game.igdbId, game])).values()], nextOffset: rows.length === ATLAS_PAGE_SIZE ? offset + ATLAS_PAGE_SIZE : null, cachedAt };
}
