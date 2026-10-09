import { safeFetchBytes } from "@/lib/safe-fetch";
import { CompanionRequests } from "./companion-request";
import { retryAfterTime } from "./wow-data";
import { parseWowRealmDirectory, wowRealmRequest, WOW_REALM_TTL, type WowRealmRegion, type WowRealmEdition } from "./wow-realm-data";

// Include the locale so Blizzard does not redirect the proxy outside its prefix.
const ENDPOINT = "https://worldofwarcraft.blizzard.com/en-us/graphql", MAX_BYTES = 1024 * 1024;
let retryAt = 0;
const requests = new CompanionRequests(async (key, signal) => {
  if (Date.now() < retryAt) throw Error("Realm provider is rate limiting requests");
  const region = new URL(key).searchParams.get("region") as WowRealmRegion;
  const edition = new URL(key).searchParams.get("edition") as WowRealmEdition;
  const response = await safeFetchBytes(ENDPOINT, { method: "POST", signal, credentials: "omit", headers: { "content-type": "application/json", "accept-language": "en-US", "x-static": "false" }, body: JSON.stringify(wowRealmRequest(region, edition)) }, 15_000, MAX_BYTES);
  if (response.status === 429) retryAt = Math.max(retryAt, retryAfterTime(response.headers.get("retry-after"), Date.now()));
  if (!response.ok) throw Error(`Realm provider ${response.status}`);
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    if (new TextEncoder().encode(text).length > MAX_BYTES) throw Error("Realm response too large");
    return JSON.parse(text) as unknown;
  }
  let text = "", size = 0; const decoder = new TextDecoder();
  try {
    while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > MAX_BYTES) throw Error("Realm response too large"); text += decoder.decode(part.value, { stream: true }); }
    return JSON.parse(text + decoder.decode()) as unknown;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
});

export function loadWowRealmDirectory(region: WowRealmRegion, edition: WowRealmEdition, signal: AbortSignal) {
  wowRealmRequest(region, edition);
  return requests.get(`${ENDPOINT}?region=${region}&edition=${edition}`, WOW_REALM_TTL, raw => parseWowRealmDirectory(raw, edition), signal);
}
export async function loadWowRealms(region: WowRealmRegion, signal: AbortSignal) {
  const observation = await loadWowRealmDirectory(region, "retail", signal);
  return { data: observation.data.realms, at: observation.at };
}
