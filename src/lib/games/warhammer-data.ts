import { ATLAS_SUMMARY_FIELDS, igdbSteamIds, parseAtlasGame, type AtlasGame } from "./igdb-data";
import { savedMetadataAt } from "./metadata-records";

export const WARHAMMER_40K_FRANCHISE = 6;
export const WARHAMMER_SETTING = "https://warhammer40000.com/the-setting/";
export const WARHAMMER_ARMIES = "https://warhammer40000.com/the-armies/";
export const WARHAMMER_FACTIONS = ["marines", "mechanicus", "necrons", "orks", "tyranids", "chaos"] as const;
export type WarhammerFaction = typeof WARHAMMER_FACTIONS[number];
export type WarhammerRole = "play" | "face";
type Connection = { id: number; steamId: number; factions: Partial<Record<WarhammerFaction, WarhammerRole>> };

// Selected connections verified against the publishers' Steam descriptions on
// 2026-10-03. These are entry points, not an exhaustive faction/game encyclopedia.
// Base-game roles only: paid faction packs must never imply base-game access.
export const WARHAMMER_CONNECTIONS: readonly Connection[] = [
  { id: 185252, steamId: 2183900, factions: { marines: "play", tyranids: "face", chaos: "face" } },
  { id: 203258, steamId: 2005010, factions: { marines: "play", chaos: "face" } },
  { id: 143424, steamId: 1295500, factions: { marines: "play", tyranids: "play", chaos: "face" } },
  { id: 88461, steamId: 673880, factions: { mechanicus: "play", necrons: "face" } },
  { id: 302176, steamId: 2532480, factions: { mechanicus: "play", necrons: "play" } },
  { id: 250904, steamId: 2078450, factions: { orks: "play" } },
  { id: 135998, steamId: 1361210, factions: { chaos: "face" } },
  { id: 76410, steamId: 489630, factions: { marines: "play", orks: "play", necrons: "play" } },
  { id: 83844, steamId: 573100, factions: { marines: "play", mechanicus: "play", necrons: "play", chaos: "play", orks: "play", tyranids: "play" } },
  { id: 18980, steamId: 285190, factions: { marines: "play", orks: "play" } },
  { id: 26705, steamId: 502370, factions: { marines: "play", orks: "play" } },
  { id: 86269, steamId: 492230, factions: { marines: "play", tyranids: "play" } },
  { id: 159703, steamId: 1324530, factions: { orks: "play" } },
  { id: 466, steamId: 15620, factions: { marines: "play", orks: "play", tyranids: "play" } },
  { id: 467, steamId: 4580, factions: { necrons: "play" } },
];
export const WARHAMMER_CONNECTION_QUERY = `fields ${ATLAS_SUMMARY_FIELDS},franchises.name; where id = (${WARHAMMER_CONNECTIONS.map(game => game.id).join(",")}); limit 20;`;
export type WarhammerGame = { game: AtlasGame; factions: Connection["factions"]; source: string };
export type WarhammerConnections = { games: WarhammerGame[]; partial: boolean; cachedAt?: number };

export function parseWarhammerConnections(rows: unknown[]): WarhammerConnections {
  if (!Array.isArray(rows) || rows.length > 20) throw Error("Invalid Warhammer game references");
  const games: WarhammerGame[] = [];
  for (const reference of WARHAMMER_CONNECTIONS) {
    const matches = rows.filter(raw => raw && typeof raw === "object" && (raw as { id?: unknown }).id === reference.id);
    if (matches.length !== 1) continue;
    try {
      const raw = matches[0], game = parseAtlasGame(raw);
      // Verify both catalog identities and the universe relation on every load.
      // A same-title remaster or wrong Steam record cannot inherit these edges.
      if (!igdbSteamIds(raw).includes(reference.steamId) || !game.franchises.some(franchise => franchise.id === WARHAMMER_40K_FRANCHISE)) continue;
      games.push({ game: { ...game, id: `steam:${reference.steamId}`, steamId: reference.steamId }, factions: reference.factions, source: `https://store.steampowered.com/app/${reference.steamId}/` });
    } catch { /* Keep valid independent connections when one provider row changes. */ }
  }
  if (!games.length) throw Error("Warhammer game references unavailable");
  return { games, partial: games.length !== WARHAMMER_CONNECTIONS.length, cachedAt: savedMetadataAt(rows) };
}

export function warhammerFactionGames(data: WarhammerConnections, faction: WarhammerFaction, role: "all" | WarhammerRole = "all") {
  return data.games.filter(entry => entry.factions[faction] && (role === "all" || entry.factions[faction] === role));
}

// IGDB currently mislabels Mark of Chaos and three Blood Bowl records as40K.
// Publishers place them in Fantasy/the alternate Blood Bowl setting:
// https://www.gog.com/en/game/warhammer_mark_of_chaos_gold_edition
// https://www.warhammer-community.com/en-gb/articles/j9dhjczu/nearly-40-years-of-fantasy-football-blood-bowl-through-the-ages/
// Correct exact records only; genuine licensed crossovers stay discoverable.
const non40k = new Set([7241, 6058, 5649, 6059]);
export function isKnownWarhammerMisclassification(id: number) { return non40k.has(id); }
// The publisher's Skulls2026 announcement confirms Survivors spans both worlds.
export function isWarhammerCrossover(id: number) { return id === 376145; }
