import { safeFetchBytes } from "@/lib/safe-fetch";
import { CompanionRequests } from "./companion-request";
import { retryAfterTime } from "./wow-data";
import { parseWarframeState, warframeActive, WARFRAME_STALE, WARFRAME_TTL, WARFRAME_URL } from "./warframe-data";
import { parseOfficialWarframeState, parseWarframeMapping, WARFRAME_MAPPING_FILES, WARFRAME_MAPPING_ROOT, WARFRAME_OFFICIAL_URL, type WarframeMappings } from "./warframe-official-data";

const MAX_BYTES = 2 * 1024 * 1024;
const cooldowns = new Map<string, number>();
const requests = new CompanionRequests(async (url, signal) => {
  const host = new URL(url).hostname;
  if (Date.now() < (cooldowns.get(host) ?? 0)) throw Error("Worldstate provider is rate limiting requests");
  const response = await safeFetchBytes(url, { signal, credentials: "omit" }, 15_000, MAX_BYTES);
  if (response.status === 429) cooldowns.set(host, retryAfterTime(response.headers.get("retry-after"), Date.now()));
  if (!response.ok) throw Error(`Worldstate provider ${response.status}`);
  const reader = response.body?.getReader(); let text = "";
  if (reader) {
    let size = 0; const decoder = new TextDecoder();
    try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > MAX_BYTES) throw Error("Worldstate response too large"); text += decoder.decode(part.value, { stream: true }); } text += decoder.decode(); }
    finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  } else { text = await response.text(); if (new TextEncoder().encode(text).length > MAX_BYTES) throw Error("Worldstate response too large"); }
  return JSON.parse(text) as unknown;
});
export async function loadWarframeState(signal: AbortSignal, refresh = false) {
  const ttl = refresh ? 0 : WARFRAME_TTL;
  const primary = await requests.get(WARFRAME_URL, ttl, parseWarframeState, signal).catch(error => { signal.throwIfAborted(); return { error }; });
  const now = Date.now();
  if (!("error" in primary) && now - primary.data.timestamp <= WARFRAME_STALE && !primary.data.partial && primary.data.cycles.length === 6 && primary.data.cycles.every(cycle => warframeActive(cycle, now))) return primary;
  try {
    const raw = await requests.get(WARFRAME_OFFICIAL_URL, ttl, value => value, signal);
    const records = await Promise.all(WARFRAME_MAPPING_FILES.map(async file => [file, (await requests.get(`${WARFRAME_MAPPING_ROOT}${file}.json`, refresh ? 0 : 86400_000, parseWarframeMapping, signal)).data] as const));
    const data = parseOfficialWarframeState(raw.data, Object.fromEntries(records) as WarframeMappings);
    // A successful HTTP response is not proof of freshness. Never replace a
    // newer observation with older official data, or mix independent snapshots.
    if (!("error" in primary) && primary.data.timestamp >= data.timestamp) return primary;
    return { data, at: raw.at };
  } catch (error) {
    signal.throwIfAborted();
    if (!("error" in primary)) return primary;
    throw error;
  }
}
