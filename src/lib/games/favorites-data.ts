import type { GameHighlight } from "./catalog";
import { DEFAULT_CATALOG_FILTERS, type CatalogFilters } from "./catalog-filters";

export const GAME_FAVORITE_FILTERS = ["all", "aaa", "indie", "free"] as const;
export type GameFavoriteFilter = typeof GAME_FAVORITE_FILTERS[number];
export const FAVORITE_REVIEW_COUNTS = [0, 1_000, 10_000, 100_000] as const;
export const FAVORITE_POSITIVE_SCORES = [0, 70, 80, 90, 95] as const;
export type FavoriteReviewFilters = { minCount: number; minPositive: number };
export const DEFAULT_FAVORITE_REVIEWS: FavoriteReviewFilters = { minCount: 0, minPositive: 0 };
export function matchesFavoriteReviews(game: GameHighlight, filters: FavoriteReviewFilters): boolean {
  if (!filters.minCount && !filters.minPositive) return true;
  const reviews = game.reviews;
  return !!reviews && reviews.count >= filters.minCount && reviews.positive >= filters.minPositive;
}
export function favoriteCatalogFilters(filter: GameFavoriteFilter): CatalogFilters {
  return { ...DEFAULT_CATALOG_FILTERS, sort: "Reviews_DESC", tags: filter === "indie" ? [492] : [], price: filter === "free" ? "free" : "all" };
}

// An editorial selection, not an inferred budget classification or a list of
// every non-Indie game. Identities checked against Steam's store on 2026-10-01.
export const AAA_FAVORITE_IDS: readonly number[] = [
  1174180, // Red Dead Redemption 2
  12210, // Grand Theft Auto IV: The Complete Edition
  292030, // The Witcher 3: Wild Hunt — Remastered
  1091500, // Cyberpunk 2077
  1245620, // ELDEN RING
  374320, // DARK SOULS™ III
  814380, // Sekiro™: Shadows Die Twice - GOTY Edition
  570940, // DARK SOULS™: REMASTERED
  1888160, // ARMORED CORE™ VI FIRES OF RUBICON™
  1086940, // Baldur's Gate 3
  990080, // Hogwarts Legacy
  1593500, // God of War
  2322010, // God of War Ragnarök
  2420110, // Horizon Forbidden West™ Complete Edition
  1817070, // Marvel’s Spider-Man Remastered
  1817190, // Marvel’s Spider-Man: Miles Morales
  1888930, // The Last of Us™ Part I
  2215430, // Ghost of Tsushima DIRECTOR'S CUT
  1259420, // Days Gone
  1222140, // Detroit: Become Human
  1850570, // DEATH STRANDING DIRECTOR'S CUT
  1659420, // UNCHARTED™: Legacy of Thieves Collection
  1895880, // Ratchet & Clank: Rift Apart
  1649240, // Returnal™
  379720, // DOOM
  782330, // DOOM Eternal
  201810, // Wolfenstein: The New Order
  612880, // Wolfenstein II: The New Colossus
  489830, // The Elder Scrolls V: Skyrim Special Edition
  377160, // Fallout 4
  22380, // Fallout: New Vegas
  1716740, // Starfield
  205100, // Dishonored
  403640, // Dishonored 2
  480490, // Prey
  976730, // Halo: The Master Chief Collection
  1240440, // Halo Infinite
  1097840, // Gears 5
  1551360, // Forza Horizon 5
  418370, // Resident Evil 7 Biohazard
  1196590, // Resident Evil Village
  883710, // Resident Evil 2
  2050650, // Resident Evil 4
  582010, // Monster Hunter: World
  1446780, // MONSTER HUNTER RISE
  2246340, // Monster Hunter Wilds
  601150, // Devil May Cry 5
  2054970, // Dragon's Dogma 2
  1364780, // Street Fighter™ 6
  1778820, // TEKKEN 8
  976310, // Mortal Kombat 11
  1172380, // STAR WARS Jedi: Fallen Order™
  1774580, // STAR WARS Jedi: Survivor™
  1238840, // Battlefield™ 1
  1237970, // Titanfall® 2
  1328670, // Mass Effect™ Legendary Edition
  1693980, // Dead Space
  1426210, // It Takes Two
  582160, // Assassin's Creed® Origins
  812140, // Assassin's Creed® Odyssey
  2208920, // Assassin's Creed Valhalla
  552520, // Far Cry® 5
  2369390, // Far Cry® 6
  447040, // Watch_Dogs® 2
  460930, // Tom Clancy's Ghost Recon® Wildlands
  1462040, // FINAL FANTASY VII REMAKE INTERGRADE
  637650, // FINAL FANTASY XV WINDOWS EDITION
  2515020, // FINAL FANTASY XVI
  750920, // Shadow of the Tomb Raider: Definitive Edition
  391220, // Rise of the Tomb Raider™
  203160, // Tomb Raider Game of the Year
  1659040, // HITMAN World of Assassination
  870780, // CONTROL Ultimate Edition
  208650, // Batman™: Arkham Knight
  200260, // Batman: Arkham City - Game of the Year Edition
  356190, // Middle-earth™: Shadow of War™
  638970, // Yakuza 0
  1235140, // Yakuza: Like a Dragon
  2072450, // Like a Dragon: Infinite Wealth
  1687950, // Persona 5 Royal
  2679460, // Metaphor: ReFantazio
  2183900, // Warhammer 40,000: Space Marine 2
  1142710, // Total War: WARHAMMER III
  289070, // Sid Meier’s Civilization® VI
  268500, // XCOM® 2
  1466860, // Age of Empires IV: Anniversary Edition
  916440, // Anno 1800
];

export function rankAAAFavorites(games: readonly GameHighlight[]): GameHighlight[] {
  const allowed = new Set(AAA_FAVORITE_IDS), seen = new Set<string>();
  return games.filter(game => {
    if (!game.steamId || !allowed.has(game.steamId) || seen.has(game.id) || game.comingSoon || !game.reviews || game.reviews.count <= 0) return false;
    seen.add(game.id); return true;
  }).sort((a, b) => b.reviews!.positive - a.reviews!.positive || b.reviews!.count - a.reviews!.count || a.steamId! - b.steamId!);
}
