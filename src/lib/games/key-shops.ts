import { externalKeyComparison } from "./key-price-data";

export type KeyShopKind = "keys" | "marketplace" | "retailer" | "comparison";
export type KeyShop = { id: string; name: string; alias?: string; kind: KeyShopKind; products: "keys" | "accounts" | "mixed" | "compare"; url: string; logo?: string };

// Navigation only: membership is not a price, availability or seller-quality claim.
// Sources and original site marks: docs/games/KEY-SHOPS.md.
export const KEY_SHOPS: readonly KeyShop[] = [
  { id: "eneba", name: "Eneba", kind: "keys", products: "keys", url: "https://www.eneba.com/", logo: "eneba.png" },
  { id: "kinguin", name: "Kinguin", kind: "keys", products: "mixed", url: "https://www.kinguin.net/", logo: "kinguin.png" },
  { id: "g2a", name: "G2A", kind: "keys", products: "mixed", url: "https://www.g2a.com/" },
  { id: "gamivo", name: "GAMIVO", kind: "keys", products: "keys", url: "https://www.gamivo.com/" },
  { id: "instant", name: "Instant Gaming", kind: "keys", products: "keys", url: "https://www.instant-gaming.com/en/", logo: "instant.png" },
  { id: "loaded", name: "Loaded", alias: "CDKeys", kind: "keys", products: "keys", url: "https://www.loaded.com/" },
  { id: "g2g", name: "G2G", kind: "marketplace", products: "mixed", url: "https://www.g2g.com/", logo: "g2g.png" },
  { id: "eldorado", name: "Eldorado.gg", kind: "marketplace", products: "mixed", url: "https://www.eldorado.gg/cd-keys/v/283", logo: "eldorado.png" },
  { id: "lzt", name: "LZT Market", alias: "lztmarket Lolzteam", kind: "marketplace", products: "accounts", url: "https://lzt.market/" },
  { id: "fanatical", name: "Fanatical", kind: "retailer", products: "keys", url: "https://www.fanatical.com/", logo: "fanatical.png" },
  { id: "humble", name: "Humble Store", kind: "retailer", products: "keys", url: "https://www.humblebundle.com/store", logo: "humble.png" },
  { id: "gmg", name: "Green Man Gaming", kind: "retailer", products: "keys", url: "https://www.greenmangaming.com/", logo: "gmg.ico" },
  { id: "gamesplanet", name: "Gamesplanet", kind: "retailer", products: "keys", url: "https://us.gamesplanet.com/", logo: "gamesplanet.svg" },
  { id: "allkeyshop", name: "AllKeyShop", kind: "comparison", products: "compare", url: "https://www.allkeyshop.com/blog/", logo: "allkeyshop.png" },
  { id: "gg", name: "GG.deals", kind: "comparison", products: "compare", url: "https://gg.deals/" },
  { id: "itad", name: "IsThereAnyDeal", kind: "comparison", products: "compare", url: "https://isthereanydeal.com/", logo: "itad.png" },
];

export function filterKeyShops(query: string, kind: KeyShopKind | "all") {
  const term = query.trim().toLocaleLowerCase();
  return KEY_SHOPS.filter(shop => (kind === "all" || shop.kind === kind) && `${shop.name} ${shop.alias ?? ""} ${new URL(shop.url).hostname}`.toLocaleLowerCase().includes(term));
}
export function keyShopUrl(shop: KeyShop, appId: number) {
  return shop.id === "gg" ? externalKeyComparison(appId) : shop.url;
}
