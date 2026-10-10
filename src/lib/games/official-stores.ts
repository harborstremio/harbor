import type { GameLink } from "./library-links";
import type { GameSummary } from "./types";
export type OfficialStoreOffer = { name: string; url: string; logo: string; price?: GameSummary["price"] };
/** Provider product links only: never infer a storefront from the game's name. */
export function officialStoreOffers(steamId?: number, links: readonly GameLink[] = [], price?: GameSummary["price"]): OfficialStoreOffer[] {
  const offers: OfficialStoreOffer[] = [];
  if (steamId && Number.isSafeInteger(steamId) && steamId > 0 && steamId <= 0xffffffff) offers.push({ name: "Steam", url: `https://store.steampowered.com/app/${steamId}/`, logo: "/games/launchers/steam.svg", price });
  for (const link of links) {
    try {
      const u = new URL(link.url);
      if (u.protocol !== "https:" || u.username || u.password || u.port) continue;
      const host = u.hostname.replace(/^www\./, "");
      const store = host === "store.steampowered.com" && /^\/app\/[1-9]\d*(?:\/|$)/.test(u.pathname) ? ["Steam", "steam.svg"]
        : ["shop.battle.net", "us.shop.battle.net", "eu.shop.battle.net", "kr.shop.battle.net", "tw.shop.battle.net"].includes(host) && /\/product\/[^/]+/.test(u.pathname) ? ["Battle.net", "battlenet.png"]
        : host === "gog.com" && /^\/(?:[a-z]{2}\/)?game\/[^/]+/.test(u.pathname) ? ["GOG", "gog.svg"]
        : host === "store.epicgames.com" && /^\/[a-z]{2}(?:-[A-Z]{2})?\/p\/[^/]+/.test(u.pathname) ? ["Epic Games", "epic.svg"] : null;
      if (store && !offers.some(offer => offer.name === store[0])) offers.push({ name: store[0], logo: `/games/launchers/${store[1]}`, url: u.href });
    } catch { /* Ignore malformed provider links. */ }
  }
  return offers;
}
