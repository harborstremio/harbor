import type { GameSummary } from "./types";
import type { WowClassicEdition, WowRealmRegion } from "./wow-realm-data";

/** Native product IDs take precedence over catalog metadata, including old saved entries. */
export function wowClassicEdition(game: Pick<GameSummary, "id" | "igdbId" | "steamId">): WowClassicEdition | null {
  if (game.id.startsWith("battlenet:")) {
    if (game.id === "battlenet:wow_classic") return "classic";
    if (game.id === "battlenet:wow_classic_era") return "classic1x";
    if (game.id === "battlenet:wow_classic_anniversary") return "classicann";
    return null;
  }
  // The original Classic catalog identity. Historical expansion records are not
  // aliases for the installed progression client and its changing realm content.
  return !game.steamId && game.igdbId === 75379 ? "classic1x" : null;
}

export const wowClassicStorageKey = (profile: string, edition: WowClassicEdition, region: WowRealmRegion) => `harbor.games.wow.realms:${profile}:${edition}:${region}`;
export function parsePinnedWowRealms(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string" && item.length <= 100 && /^[\p{L}\p{M}\p{N}-]+$/u.test(item)))].slice(0, 100) : [];
}
