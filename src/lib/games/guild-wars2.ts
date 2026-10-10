import { safeFetchBytes } from "@/lib/safe-fetch";
import { CompanionRequests } from "./companion-request";
import { retryAfterTime } from "./wow-data";
import { GW2_VAULT_TTL, gw2Language, joinGw2Rewards, parseGw2Items, parseGw2Listings, parseGw2Season, type Gw2Vault } from "./guild-wars2-data";

const BASE = "https://api.guildwars2.com/v2", MAX_BYTES = 2 * 1024 * 1024;
let retryAt = 0;
const requests = new CompanionRequests(async (url, signal) => {
  if (Date.now() < retryAt) throw Error("ArenaNet rate limit");
  const response = await safeFetchBytes(url, { signal, credentials: "omit" }, 15_000, MAX_BYTES);
  if (response.status === 429) retryAt = Math.max(retryAt, retryAfterTime(response.headers.get("retry-after"), Date.now()));
  if (!response.ok) throw Error(`ArenaNet ${response.status}`);
  const reader = response.body?.getReader(); let text = "";
  if (reader) {
    let size = 0; const decoder = new TextDecoder();
    try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > MAX_BYTES) throw Error("ArenaNet response too large"); text += decoder.decode(part.value, { stream: true }); } text += decoder.decode(); }
    finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  } else { text = await response.text(); if (new TextEncoder().encode(text).length > MAX_BYTES) throw Error("ArenaNet response too large"); }
  return JSON.parse(text) as unknown;
});
const batches = (ids: number[]) => Array.from({ length: Math.ceil(ids.length / 200) }, (_, index) => ids.slice(index * 200, (index + 1) * 200));
export async function loadGw2Vault(language: string, signal: AbortSignal, refresh = false): Promise<Gw2Vault> {
  const ttl = refresh ? 0 : GW2_VAULT_TTL, locale = gw2Language(language);
  const observed = await requests.get(`${BASE}/wizardsvault`, ttl, parseGw2Season, signal);
  const season = observed.data;
  const offers = await Promise.all(batches(season.listings).map(ids => requests.get(`${BASE}/wizardsvault/listings?ids=${ids.join(",")}`, ttl, parseGw2Listings, signal)));
  signal.throwIfAborted();
  const listings = offers.flatMap(value => value.data).filter(value => season.listings.includes(value.id));
  // Reject a partial offer set before loading item art or computing any plan.
  joinGw2Rewards(season, listings, []);
  const ids = [...new Set(listings.map(value => value.itemId))].sort((a, b) => a - b);
  const itemResults = await Promise.allSettled(batches(ids).map(batch => requests.get(`${BASE}/items?ids=${batch.join(",")}&lang=${locale}`, refresh ? 0 : 6 * 3600_000, parseGw2Items, signal)));
  signal.throwIfAborted();
  const items = itemResults.flatMap(value => value.status === "fulfilled" ? value.value.data : []);
  if (ids.length && !items.length) throw Error("Guild Wars2 items unavailable");
  const rewards = joinGw2Rewards(season, listings, items);
  return { season, rewards, partial: rewards.some(value => !value.item), at: Math.min(observed.at, ...offers.map(value => value.at)), language: locale };
}
