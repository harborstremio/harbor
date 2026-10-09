import type { GameSummary } from "./types";
import { launcherCatalogArtwork } from "./launcher-discovery";
import { wowClassicEdition } from "./wow-classic";
import { wowClassicArt } from "./wow-art";

export type GameLauncher = "battlenet" | "ea" | "ubisoft" | "epic" | "gog" | "riot" | "rockstar" | "rsi" | "bsg" | "itch";
export type LauncherGame = {
  id: string;
  launcher: GameLauncher;
  productId: string;
  name: string;
  installPath: string;
  state: "installed" | "missing" | "incomplete" | "ambiguous" | "notInstalled" | "unknown";
  accountOwned?: boolean;
  launchMode: "play" | "client" | "direct";
  /** Exact native uninstall registration; independent of mutable EA launch aliases. */
  installKey?: string;
  /** Exact product artwork observed in the launcher's public local catalog. */
  artwork?: { capsule?: string; hero?: string; logo?: string };
  catalogSteamId?: number;
  /** Per-profile native observation; never inferred from successful client dispatch. */
  activity?: { seconds?: number; lastPlayed?: number; state?: "waiting" | "running" | "unconfirmed" | "notStarted" };
};
export type LauncherScan = {
  supported: boolean;
  clients: { launcher: GameLauncher; installed: boolean }[];
  games: LauncherGame[];
  warnings: string[];
};
export const LAUNCHER_NAMES: Record<GameLauncher, string> = {
  battlenet: "Battle.net", ea: "EA app", ubisoft: "Ubisoft Connect", epic: "Epic Games",
  gog: "GOG GALAXY", riot: "Riot Games", rockstar: "Rockstar Games", rsi: "RSI Launcher", bsg: "Battlestate Games",
  itch: "itch.io",
};

/** Persistence validation only; native dispatch still requires a freshly observed install. */
export function isLauncherGameId(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 9000) return false;
  if (value.startsWith("battlenet:")) return /^[a-z0-9._:-]{1,128}$/.test(value.slice(10));
  if (value.startsWith("ubisoft:")) {
    const product = value.slice(8);
    return /^[1-9][0-9]{0,9}$/.test(product) && Number(product) <= 0xffff_ffff;
  }
  if (value.startsWith("ea:")) {
    const ids = value.slice(3).split(",");
    return ids.length <= 64 && ids.every((id, index) => /^[A-Za-z0-9._:-]{1,128}$/.test(id) && (index === 0 || ids[index - 1]! < id));
  }
  if (value.startsWith("epic:")) return /^[A-Za-z0-9._-]{1,128}:[A-Za-z0-9._-]{1,128}:[A-Za-z0-9._-]{1,128}$/.test(value.slice(5));
  if (value.startsWith("gog:")) return /^[1-9][0-9]{0,19}$/.test(value.slice(4));
  if (value.startsWith("riot:")) return /^(league_of_legends|valorant|bacon|lion):(live|pbe)$/.test(value.slice(5));
  if (value.startsWith("rockstar:")) return /^(gta5|gta5_gen9|gta4|rdr|rdr2|lanoire|lanoirevr|mp3|gtasa|gta3|gtavc|bully|gta3unreal|gtavcunreal|gtasaunreal)$/.test(value.slice(9));
  if (value.startsWith("rsi:")) return /^star-citizen:(live|ptu|eptu|tech-preview)$/.test(value.slice(4));
  if (value.startsWith("bsg:")) return /^(eft|arena)$/.test(value.slice(4));
  if (value.startsWith("itch:")) {
    const match = /^itch:([1-9][0-9]{0,15}):[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.exec(value);
    return !!match && Number.isSafeInteger(Number(match[1]));
  }
  return false;
}

// Verified IGDB identity, independent of a translated install title. Classic editions
// must never borrow Retail metadata or its Mythic+ companion.
export const WOW_IGDB_ID = 123;
// Confirmed catalog IDs; preview channels and remastered/enhanced editions stay distinct.
const CATALOG_IDENTITIES: Readonly<Record<string, number>> = {
  "battlenet:wow": WOW_IGDB_ID,
  "battlenet:classic:d2": 126,
  "battlenet:classic:d2x": 246,
  "battlenet:classic:w3": 132,
  "battlenet:classic:w3x": 133,
  // Exact retail product codes and PC records, verified October 2, 2026.
  // Shared StarCraft II / Call of Duty clients and test channels are not editions.
  "battlenet:diablo3": 120,
  "battlenet:s1": 25683,
  "battlenet:hs_beta": 1279,
  "battlenet:heroes": 7313,
  "battlenet:prometheus": 125174,
  "battlenet:viper": 83727,
  "battlenet:odin": 119177,
  "battlenet:w3": 111650,
  "battlenet:lazarus": 95062,
  "battlenet:zeus": 137001,
  "battlenet:wlby": 135254,
  "battlenet:osi": 142803,
  "battlenet:rtro": 143737,
  "battlenet:fore": 165067,
  "battlenet:anbs": 111651,
  "battlenet:fen": 125165,
  "battlenet:d1": 125,
  "battlenet:w1r": 322108,
  "battlenet:w2r": 322109,
  "battlenet:gryphon": 199925,
  "battlenet:aris": 302704,
  "battlenet:scorpio": 11137,
  "battlenet:arkansas": 152246,
  "battlenet:libra": 334243,
  "battlenet:aqua": 135994,
  "rsi:star-citizen:live": 1595,
  "bsg:eft": 15536,
  "bsg:arena": 203610,
  "riot:league_of_legends:live": 115,
  "riot:valorant:live": 126459,
  "rockstar:gta5": 1020,
  "rockstar:rdr2": 25076,
  // Observed Epic installation tuple; the store offer ID is a different identity.
  "epic:fn:4fe75bbc5a674f4f9b356b5c90567da5:Fortnite": 1905,
  // EA's public legacy offers confirm these Windows content IDs (October 2, 2026).
  // Offer IDs, trial suffixes and shared standard/deluxe IDs are not interchangeable.
  "ea:alice2_dd": 1040, // Alice: Madness Returns
  "ea:194908": 114795, // Apex Legends
  "ea:16273025": 112104, // Command & Conquer Remastered Collection
  "ea:deadspace_eu2": 37, // Dead Space (2008), not the remake
  "ea:1009228": 37,
  "ea:deadspace2_dd": 38,
  "ea:71762": 1216, // Dead Space 3
  "ea:16050355": 135243, // It Takes Two, not Friend's Pass
  "ea:198188": 119285, // Lost in Random
  "ea:198196": 140839, // Mass Effect Legendary Edition
  "ea:198300": 201156, // Star Wars Jedi: Survivor
  "ea:196485": 74701, // Star Wars Jedi: Fallen Order
  "ea:1014457": 45113, // The Sims 2: Ultimate Collection, not Legacy Collection
  "ea:sims3_dd": 260,
  "ea:1011164": 3212, // The Sims 4
};

function launcherCatalogIdentity(id: string): number | undefined {
  if (!isLauncherGameId(id)) return undefined;
  const ids = id.startsWith("ea:") ? id.slice(3).split(",").map(alias => `ea:${alias}`) : [id];
  const matches = ids.map(key => Object.hasOwn(CATALOG_IDENTITIES, key) ? CATALOG_IDENTITIES[key] : undefined);
  // Every observed EA alias must identify the same edition. Unknown/mixed aliases
  // stay unresolved; a familiar title or one matching alias is insufficient.
  return matches.every(value => value !== undefined && value === matches[0]) ? matches[0] : undefined;
}
/** Also enrich older saved/collection entries without changing their native identity. */
export function launcherCatalogGame(game: GameSummary): GameSummary {
  const igdbId = launcherCatalogIdentity(game.id);
  const catalogSteamId = launcherCatalogSteamId(game.id, game.catalogSteamId);
  return igdbId ? { ...game, igdbId, catalogSteamId, steamId: undefined }
    : isLauncherGameId(game.id) || game.catalogSteamId !== catalogSteamId ? { ...game, catalogSteamId, ...(isLauncherGameId(game.id) ? { steamId: undefined } : {}) } : game;
}
export function launcherCatalogSteamId(id: unknown, value: unknown): number | undefined {
  return isLauncherGameId(id) && id.startsWith("ubisoft:") && typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 0xffff_ffff ? value : undefined;
}
export function launcherGameSummary(game: LauncherGame): GameSummary {
  const igdbId = launcherCatalogIdentity(launcherDispatchId(game));
  const catalogSteamId = launcherCatalogSteamId(game.id, game.catalogSteamId);
  const catalog = launcherCatalogArtwork(igdbId) ?? classicCatalogArtwork(igdbId);
  const classic = wowClassicEdition({ id: launcherDispatchId(game) });
  // Progression clients retain their native identity; a Classic image is not a Retail catalog join.
  const classicArt = classic ? wowClassicArt(classic, game.name) : undefined;
  const capsule = game.artwork?.capsule || game.artwork?.hero || catalog?.capsule || classicArt?.backdrop || "";
  const portrait = game.artwork?.capsule || catalog?.portrait;
  return { id: game.id, name: game.name, platforms: ["Windows"], capsule,
    ...(portrait ? { portrait } : {}),
    ...(igdbId ? { igdbId } : {}), ...(catalogSteamId ? { catalogSteamId } : {}) };
}
// Exact original-edition assets from IGDB's October 3, 2026 catalog response.
// Keep landscape screenshots separate from portrait covers and remaster identities.
function classicCatalogArtwork(id: number | undefined) {
  const assets: Record<number, readonly [string, string]> = {
    126: ["scjgji", "co3gfq"],
    246: ["scjgjp", "co3gfn"],
    132: ["fkl6jtwogmphqkudqguz", "co1xuq"],
    133: ["sc6vmp", "co1xxv"],
  };
  const entry = id === undefined ? undefined : assets[id];
  return entry ? {
    capsule: `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${entry[0]}.jpg`,
    portrait: `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${entry[1]}.jpg`,
  } : undefined;
}
/** Only known public publisher assets belong in portable native-game snapshots. */
export function launcherProductImage(id: unknown, value: unknown): string {
  if (isLauncherGameId(id) && id.startsWith("itch:") && typeof value === "string" && value.length <= 8192 && !/[\s\x00-\x1f\x7f]/.test(value)) {
    try {
      const url = new URL(value);
      if (url.protocol === "https:" && url.hostname === "img.itch.zone" && !url.username && !url.password && !url.port && !url.search && !url.hash && url.pathname.length > 1) return value;
    } catch { /* Only the publisher's public artwork can be persisted. */ }
    return "";
  }
  return isLauncherGameId(id) && id.startsWith("ubisoft:") && typeof value === "string"
    && /^https:\/\/ubistatic3-a\.akamaihd\.net\/orbit\/uplay_launcher_3_0\/assets\/[a-f0-9]{32}\.(?:jpg|jpeg|png|webp)$/i.test(value) ? value : "";
}
/** Exact provider identity wins. Catalog joins are only for catalog entries, never other storefront copies. */
export function findLauncherInstall(game: Pick<GameSummary, "id" | "igdbId" | "steamId">, scan?: LauncherScan | null): LauncherGame | undefined {
  if (!scan?.supported) return undefined;
  const exact = scan.games.find(install => install.id === game.id);
  if (exact) return exact;
  if (!game.id.startsWith("igdb:") || game.steamId || !game.igdbId) return undefined;
  const matches = scan.games.filter(install => launcherGameSummary(install).igdbId === game.igdbId && install.state === "installed");
  // Multiple providers/installations require an explicit source choice.
  return matches.length === 1 ? matches[0] : undefined;
}
export function isRetailWow(game: Pick<GameSummary, "id" | "igdbId" | "steamId">): boolean {
  if (game.id.startsWith("battlenet:")) return game.id === "battlenet:wow";
  return !game.steamId && game.igdbId === WOW_IGDB_ID;
}
export function canLaunchGame(game: LauncherGame, scan: LauncherScan): boolean {
  const classic = game.launcher === "battlenet" && game.launchMode === "direct"
    && ["classic:d2", "classic:d2x", "classic:w3", "classic:w3x"].includes(game.productId);
  return scan.supported && game.state === "installed" && (classic || scan.clients.some(client => client.launcher === game.launcher && client.installed));
}

/** Library IDs can survive EA manifest changes; only current product IDs go to native dispatch. */
export function launcherDispatchId(game: LauncherGame): string {
  return `${game.launcher}:${game.productId}`;
}
