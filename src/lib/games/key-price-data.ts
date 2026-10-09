const row = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown, limit = 200) => typeof value === "string" ? value.trim().slice(0, limit) : "";
const positiveId = (value: unknown) => typeof value === "string" && /^[1-9]\d{0,9}$/.test(value) ? value : "";

export type PriceStore = { id: string; name: string; logo: string };
export type GamePriceOffer = { id: string; appId: number; title: string; store: PriceStore; amount: number; regular: number | null; currency: "USD"; activation: "steam" | "reported-steam" | "unknown"; region: "unknown"; url: string };
export type GamePriceComparison = { appId: number; offers: GamePriceOffer[]; checkedAt: number; partial: boolean };

export function validatePriceAppId(appId: number): void {
  if (!Number.isSafeInteger(appId) || appId <= 0 || appId > 4_294_967_295) throw Error("Invalid price game identity");
}

export function parsePriceStores(value: unknown): PriceStore[] {
  if (!Array.isArray(value) || value.length > 200) throw Error("Invalid price stores");
  const seen = new Set<string>();
  return value.flatMap(item => {
    const v = row(item), id = positiveId(v.storeID), name = text(v.storeName, 80), icon = text(row(v.images).icon);
    if (!id || !name || v.isActive !== 1 || seen.has(id)) return [];
    seen.add(id);
    return [{ id, name, logo: /^\/img\/stores\/icons\/\d+\.png$/.test(icon) ? `https://www.cheapshark.com${icon}` : "" }];
  });
}

function cents(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{1,6}(?:\.\d{1,2})?$/.test(value)) return null;
  return Math.round(Number(value) * 100);
}

function dealId(value: unknown): string {
  try {
    const decoded = decodeURIComponent(text(value, 180));
    return /^[A-Za-z0-9+/=_-]{16,120}$/.test(decoded) ? decoded : "";
  } catch { return ""; }
}

export function parsePriceOffers(value: unknown, appId: number, stores: PriceStore[], reportedSteam: ReadonlySet<string> = new Set()): GamePriceOffer[] {
  validatePriceAppId(appId);
  if (!Array.isArray(value) || value.length > 60) throw Error("Invalid price offers");
  const seen = new Set<string>();
  return value.flatMap(item => {
    const v = row(item), id = dealId(v.dealID), store = stores.find(s => s.id === positiveId(v.storeID));
    const amount = cents(v.salePrice), regular = cents(v.normalPrice), title = text(v.title);
    // The Steam identity is necessary even when the service ignored a query filter.
    if (v.steamAppID !== String(appId) || !id || !store || !title || amount === null || seen.has(id)) return [];
    seen.add(id);
    return [{ id, appId, title, store, amount, regular, currency: "USD" as const,
      activation: store.id === "1" ? "steam" as const : reportedSteam.has(id) ? "reported-steam" as const : "unknown" as const,
      region: "unknown" as const, url: `https://www.cheapshark.com/redirect?dealID=${encodeURIComponent(id)}` }];
  }).sort((a, b) => a.amount - b.amount || a.store.name.localeCompare(b.store.name));
}

export function reportedSteamDeals(value: unknown, appId: number): Set<string> {
  if (!Array.isArray(value) || value.length > 60) throw Error("Invalid Steam offer filter");
  return new Set(value.flatMap(item => { const v = row(item), id = dealId(v.dealID); return v.steamAppID === String(appId) && id ? [id] : []; }));
}

export function filterPriceOffers(offers: GamePriceOffer[], store: string, activation: "steam" | "all") {
  return offers.filter(offer => (store === "all" || offer.store.id === store) && (activation === "all" || offer.activation !== "unknown"));
}

export function priceLabel(cents: number, language?: string): string {
  return new Intl.NumberFormat(language, { style: "currency", currency: "USD" }).format(cents / 100);
}

export function externalKeyComparison(appId: number) {
  validatePriceAppId(appId);
  return `https://gg.deals/steam/app/${appId}/`;
}
