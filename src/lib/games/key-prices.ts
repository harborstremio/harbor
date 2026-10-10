import { safeFetchBytes } from "@/lib/safe-fetch";
import { GameRequestPool } from "./request-pool";
import { parsePriceOffers, parsePriceStores, reportedSteamDeals, validatePriceAppId, type GamePriceComparison } from "./key-price-data";

const pool = new GameRequestPool(2), cache = new Map<string, { at: number; data: unknown; partial: boolean }>();
const LIMIT = 512 * 1024, TTL = 15 * 60_000;
let retryAt = 0;

async function request(path: string, signal: AbortSignal, ttl = TTL) {
  signal.throwIfAborted();
  const held = cache.get(path);
  if (held && Date.now() - held.at < ttl) return held;
  return pool.run(async () => {
    if (Date.now() < retryAt) throw Error("Price service rate limited");
    const response = await safeFetchBytes(`https://www.cheapshark.com/api/1.0/${path}`, {
      headers: { "User-Agent": "HarborGames/1.0 (+https://harbor.site)" },
      signal: AbortSignal.any([signal, AbortSignal.timeout(12_000)]),
    }, 12_000, LIMIT);
    if (response.status === 429) {
      const header = response.headers.get("Retry-After"), seconds = Number(header);
      const delay = header && Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : Math.max(0, Date.parse(header ?? "") - Date.now());
      retryAt = Date.now() + (Number.isFinite(delay) ? Math.max(60_000, delay) : 5 * 60_000);
    }
    if (!response.ok) throw Error(`Price service ${response.status}`);
    const reader = response.body?.getReader(), decoder = new TextDecoder(); let body = "", size = 0;
    if (reader) {
      try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > LIMIT) throw Error("Price response too large"); body += decoder.decode(part.value, { stream: true }); } body += decoder.decode(); }
      finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    } else { body = await response.text(); if (body.length > LIMIT) throw Error("Price response too large"); }
    const value = { at: Date.now(), data: JSON.parse(body) as unknown, partial: Number(response.headers.get("X-Total-Page-Count") ?? 1) > 1 };
    signal.throwIfAborted(); cache.delete(path); cache.set(path, value);
    if (cache.size > 100) cache.delete(cache.keys().next().value!);
    return value;
  }, signal);
}

export async function loadKeyPrices(appId: number, signal: AbortSignal, refresh = false): Promise<GamePriceComparison> {
  validatePriceAppId(appId);
  const query = `deals?steamAppID=${appId}&sortBy=Price&pageSize=60&pageNumber=0`;
  const [stores, offers, steam] = await Promise.allSettled([
    request("stores", signal, 24 * 60 * 60_000), request(query, signal, refresh ? 30_000 : TTL), request(`${query}&steamworks=1`, signal, refresh ? 30_000 : TTL),
  ]);
  signal.throwIfAborted();
  if (stores.status === "rejected") throw stores.reason;
  if (offers.status === "rejected") throw offers.reason;
  // Steamworks is the provider's best guess, not a guarantee of activation or region.
  const reported = steam.status === "fulfilled" ? reportedSteamDeals(steam.value.data, appId) : new Set<string>();
  return { appId, offers: parsePriceOffers(offers.value.data, appId, parsePriceStores(stores.value.data), reported), checkedAt: offers.value.at, partial: offers.value.partial || steam.status === "rejected" || steam.value.partial };
}
