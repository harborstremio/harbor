import { ATLAS_DETAIL_FIELDS, parseAtlasGame, type AtlasGame } from "./igdb-data";
import { savedMetadataAt } from "./metadata-records";

// A small editorial welcome, not the ROM catalog. Bulk shelves remain live
// provider queries. Originals and remakes never share an artwork identity.
export const ROM_SPOTLIGHT_IDS = [1070, 1517, 1029, 1074] as const;
const artwork: Readonly<Record<number, { logo: string; source: string; monochrome?: boolean }>> = {
  1070: { logo: "/games/roms/super-mario-world.svg", source: "https://commons.wikimedia.org/wiki/File:Super_Mario_World_game_logo.svg" },
  1517: { logo: "/games/roms/pokemon-emerald.png", source: "https://archives.bulbagarden.net/wiki/File:Pokemon_Emerald_Logo_EN.png" },
  1029: { logo: "/games/roms/ocarina-of-time.svg", source: "https://commons.wikimedia.org/wiki/File:The_Legend_of_Zelda_Ocarina_of_Time.svg" },
  1074: { logo: "/games/roms/super-mario-64.png", source: "https://commons.wikimedia.org/wiki/File:Super_Mario_64_logo.png" },
  // Exact original-game identities where the retro directory has no wordmark.
  // Full provenance: public/games/roms/HERO-ARTWORK.md. Never reuse these for remakes or hacks.
  375: { logo: "/games/roms/metal-gear-solid.png", source: "https://commons.wikimedia.org/wiki/File:Metal_Gear_Solid_logo.png" },
  427: { logo: "/games/roms/final-fantasy-vii.png", source: "https://store.steampowered.com/app/39140/" },
  421: { logo: "/games/roms/final-fantasy-ix.png", source: "https://store.steampowered.com/app/377840/" },
  1128: { logo: "/games/roms/symphony-of-the-night.png", source: "https://commons.wikimedia.org/wiki/File:Castlevania_Symphony_of_the_Night_logo.png" },
  1185: { logo: "/games/roms/crash-bandicoot.png", source: "https://commons.wikimedia.org/wiki/File:Crash_bandicoot_logo.png" },
  125: { logo: "/games/roms/diablo.svg", source: "https://commons.wikimedia.org/wiki/File:Diablo_(Computerspiel)_Logo.svg", monochrome: true },
  358: { logo: "/games/roms/super-mario-bros.svg", source: "https://commons.wikimedia.org/wiki/File:Super_Mario_Bros._Logo.svg" },
  1068: { logo: "/games/roms/super-mario-bros-3.svg", source: "https://commons.wikimedia.org/wiki/File:Super_Mario_Bros._3_text_logo.svg" },
  4438: { logo: "/games/roms/sonic-the-hedgehog-2.png", source: "https://commons.wikimedia.org/wiki/File:Sonic_the_Hedgehog_2_logo.png" },
};
export function romGameArtwork(igdbId: number | undefined) { return igdbId === undefined ? undefined : artwork[igdbId]; }
export function romSpotlightGames(games: readonly AtlasGame[], platform?: number): AtlasGame[] {
  return ROM_SPOTLIGHT_IDS.flatMap(id => {
    const game = games.find(game => game.igdbId === id && game.gameType !== undefined && [0, 8, 9, 10, 11].includes(game.gameType) && (platform === undefined || game.platformLinks.some(item => item.id === platform)));
    return game ? [{ ...game, id: `igdb:${id}` }] : [];
  });
}
export const romSpotlightQuery = () => `fields ${ATLAS_DETAIL_FIELDS}; where id = (${ROM_SPOTLIGHT_IDS.join(",")}); limit ${ROM_SPOTLIGHT_IDS.length};`;
export type RomSpotlight = { games: AtlasGame[]; cachedAt?: number };
type Sources = { query: (query: string, signal?: AbortSignal) => Promise<unknown[]>; snapshot: (query: string) => Promise<unknown[] | null> };
export function createRomSpotlight(sources: Sources) {
  const page = (rows: unknown[]): RomSpotlight => ({ games: romSpotlightGames(rows.map(parseAtlasGame)), cachedAt: savedMetadataAt(rows) });
  return {
    async load(signal?: AbortSignal) {
      signal?.throwIfAborted(); const rows = await sources.query(romSpotlightQuery(), signal); signal?.throwIfAborted(); return page(rows);
    },
    async snapshot() {
      try { const rows = await sources.snapshot(romSpotlightQuery()); return rows ? page(rows) : null; } catch { return null; }
    },
  };
}
const spotlight = createRomSpotlight({
  query: (...args) => import("./atlas").then(module => module.queryIgdb(...args)),
  snapshot: (...args) => import("./atlas").then(module => module.readIgdbSnapshot(...args)),
});
export const loadRomSpotlight = spotlight.load;
export const readRomSpotlightSnapshot = spotlight.snapshot;
