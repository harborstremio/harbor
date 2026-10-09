import { sourceOrigin } from './source-origin';
import type { GameSummary } from "./types";
import { gameImage, steamSummary } from "./steam-data";
import { isIgdbImage } from "./igdb-data";
import { isLauncherGameId, launcherProductImage } from "./launchers";
import { collectionGame } from "./personal-collections";
import { detailEditionTarget } from "./detail-edition";
import { sourceListingGame } from "./source-listing";

const key = (profile: string) => `harbor.games.saved.v1:${profile}`;

export function readSavedGames(profile: string): GameSummary[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key(profile)) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.flatMap(item => {
      if (!item || typeof item !== "object") return [];
      if (typeof item.id === "string" && item.id.startsWith("source:")) { const game = sourceListingGame(item); return game ? [game] : []; }
      if (isLauncherGameId(item.id)) { const game = collectionGame(item); return game ? [game] : []; }
      const platforms = Array.isArray(item.platforms) ? item.platforms : [];
      if (Number.isSafeInteger(item.igdbId) && item.igdbId > 0 && typeof item.name === "string" && item.name.trim()) {
        const steamId = item.id !== `igdb:${item.igdbId}` && Number.isSafeInteger(item.steamId) && item.steamId > 0 ? item.steamId : undefined;
        return [{ ...(sourceOrigin(item.sourceOrigin) ? {sourceOrigin:sourceOrigin(item.sourceOrigin)} : {}), id: steamId ? `steam:${steamId}` : `igdb:${item.igdbId}`, igdbId: item.igdbId, ...(steamId ? { steamId } : {}), name: item.name.slice(0, 500), capsule: isIgdbImage(item.capsule) ? item.capsule : gameImage(item.capsule), portrait: isIgdbImage(item.portrait) ? item.portrait : undefined, platforms: platforms.filter((p: unknown): p is string => typeof p === "string").slice(0, 30), ...(typeof item.price?.amount === "number" && Number.isFinite(item.price.amount) && item.price.amount >= 0 && /^[A-Z]{3}$/.test(item.price.currency ?? "") ? { price: { amount: item.price.amount, currency: item.price.currency, discount: Math.max(0, Math.min(100, Number(item.price.discount) || 0)) } } : {}) }];
      }
      const normalized = steamSummary({ ...item, id: item.steamId, header_image: item.capsule,
        windows_available: platforms.includes("Windows"), mac_available: platforms.includes("macOS"), linux_available: platforms.includes("Linux"),
        final_price: item.price?.amount, currency: item.price?.currency, discount_percent: item.price?.discount });
      return normalized ? [{...normalized, ...(sourceOrigin(item.sourceOrigin) ? {sourceOrigin:sourceOrigin(item.sourceOrigin)} : {})}] : [];
    });
  } catch { return []; }
}

export function writeSavedGames(profile: string, games: GameSummary[]) {
  // Write before updating the view: a full disk must not look like a successful save.
  // Device-local artwork is reconciled from the library, never persisted as a portable store URL.
  const summaries = games.map(detailEditionTarget).map(game => {
    if (game.sourceListing) return sourceListingGame(game);
    const { id, steamId, igdbId, catalogSteamId, name, capsule, portrait, platforms, price } = game;
    return { ...(sourceOrigin(game.sourceOrigin) ? {sourceOrigin:sourceOrigin(game.sourceOrigin)} : {}), id, steamId, igdbId, catalogSteamId, name, capsule: gameImage(capsule) || launcherProductImage(id,capsule) || (isIgdbImage(capsule) ? capsule : steamId ? `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${steamId}/header.jpg` : ""), portrait: isIgdbImage(portrait) ? portrait : undefined, platforms, ...(price ? { price } : {}) };
  }).filter(Boolean);
  localStorage.setItem(key(profile), JSON.stringify(summaries));
}
