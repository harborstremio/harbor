import { parseAtlasGame, type AtlasGame } from "./igdb-data";

export const METADATA_MATCH_PAGE_SIZE = 24;
const MATCH_FIELDS = "name,slug,cover.image_id,artworks.image_id,screenshots.image_id,first_release_date,platforms.name,game_type.type,involved_companies.company.name,involved_companies.developer,involved_companies.supporting,involved_companies.porting,external_games.external_game_source,external_games.uid";

/** Metadata selection includes editions, ports, mods and records without artwork. */
export function metadataMatchQuery(query: string, platform?: number, offset = 0): string | null {
  if (platform !== undefined && (!Number.isSafeInteger(platform) || platform <= 0)) throw Error("Invalid metadata platform");
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10_000 || offset % METADATA_MATCH_PAGE_SIZE) throw Error("Invalid metadata offset");
  const term = query.trim();
  if (!term) return null;
  const exact = /^(?:igdb:)?(\d+)$/i.exec(term);
  if (exact) {
    const id = Number(exact[1]);
    if (!Number.isSafeInteger(id) || id <= 0) throw Error("Invalid metadata ID");
    // An explicitly entered ID is authoritative even when its platform differs.
    return offset ? null : `fields ${MATCH_FIELDS}; where id = ${id}; limit 1;`;
  }
  const search = term.slice(0, 160).replace(/["\\\x00-\x1f\x7f]/g, " ").trim();
  if (!search) return null;
  return `search "${search}"; fields ${MATCH_FIELDS};${platform ? ` where platforms = (${platform});` : ""} limit ${METADATA_MATCH_PAGE_SIZE}; offset ${offset};`;
}

export function metadataMatchPage(rows: unknown[], query: string, offset = 0) {
  const exact = /^(?:igdb:)?(\d+)$/i.exec(query.trim());
  const games = [...new Map(rows.map(value => {
    const game = parseAtlasGame(value);
    const companies = (value as { involved_companies?: { developer?: boolean; supporting?: boolean; porting?: boolean; company?: { id?: number } }[] }).involved_companies ?? [];
    const developers = new Set(companies.filter(company => company.developer && !company.supporting && !company.porting).map(company => company.company?.id));
    return { ...game, developers: game.developers.filter(company => developers.has(company.id)) };
  }).filter(game => !exact || game.igdbId === Number(exact[1])).map(game => [game.igdbId, game])).values()];
  return { games, nextOffset: !exact && rows.length === METADATA_MATCH_PAGE_SIZE && offset + METADATA_MATCH_PAGE_SIZE <= 10_000 ? offset + METADATA_MATCH_PAGE_SIZE : null };
}

/** Never merge distinct editions merely because IGDB associates them with one store app. */
export function mergeMetadataMatches(previous: AtlasGame[], next: AtlasGame[]) {
  return [...new Map([...previous, ...next].map(game => [game.igdbId, game])).values()];
}

export function metadataMatchYear(game: AtlasGame) {
  if (game.release === undefined) return undefined;
  const date = new Date(game.release * 1000);
  return Number.isFinite(date.getTime()) ? date.getUTCFullYear() : undefined;
}

/** New game-type IDs are references, not the deprecated category enum. */
export function metadataMatchType(game: AtlasGame, translate: (key: string) => string) {
  const type = game.gameTypeName;
  if (!type) return undefined;
  const normalized = type.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const key = normalized === "dlc" ? "dlcaddon" : normalized;
  const known = ["maingame", "dlcaddon", "expansion", "bundle", "standaloneexpansion", "mod", "episode", "season", "remake", "remaster", "expandedgame", "port", "fork", "pack", "update"];
  return known.includes(key) ? translate(`games.metadata.type.${key}`) : type;
}
