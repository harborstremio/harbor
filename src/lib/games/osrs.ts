import { safeFetchBytes } from "@/lib/safe-fetch";
import { CompanionRequests } from "./companion-request";
import { retryAfterTime } from "./wow-data";
import { OSRS_API, osrsItemId, osrsHistoryUrl, parseOsrsItems, parseOsrsLatest, parseOsrsHistory, type OsrsRange } from "./osrs-data";

const identity = "HarborGrandExchange/1.0 (+https://harbor.site)";
let cooldown = 0;
const requests = new CompanionRequests(async (url, signal) => {
  if (Date.now() < cooldown) throw Error("Price source rate limited");
  const limit = url.endsWith("/mapping") ? 2 * 1024 * 1024 : 512 * 1024;
  const headers: Record<string, string> = { "Api-User-Agent": identity };
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) headers["User-Agent"] = identity;
  const response = await safeFetchBytes(url, { signal, credentials: "omit", headers }, 12_000, limit);
  if (response.status === 429) cooldown = retryAfterTime(response.headers.get("retry-after"), Date.now());
  if (!response.ok) throw Error(`Price source ${response.status}`);
  const reader = response.body?.getReader(); let body = "", bytes = 0;
  if (reader) { const decoder = new TextDecoder(); try { while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.length; if (bytes > limit) throw Error("Price response too large"); body += decoder.decode(part.value, { stream: true }); } body += decoder.decode(); } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); } }
  else { body = await response.text(); if (new TextEncoder().encode(body).length > limit) throw Error("Price response too large"); }
  return JSON.parse(body) as unknown;
});
export const loadOsrsItems = (signal: AbortSignal) => requests.get(`${OSRS_API}/mapping`, 3_600_000, parseOsrsItems, signal);
export const loadOsrsLatest = (id: number, signal: AbortSignal) => requests.get(`${OSRS_API}/latest?id=${osrsItemId(id)}`, 60_000, raw => parseOsrsLatest(raw, id), signal);
export const loadOsrsHistory = (id: number, range: OsrsRange, signal: AbortSignal, refresh = false) => requests.get(osrsHistoryUrl(id, range), refresh ? 60_000 : 300_000, raw => parseOsrsHistory(raw, id, Date.now(), range), signal);
