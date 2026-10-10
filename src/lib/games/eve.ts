import { safeFetchBytes } from "@/lib/safe-fetch";
import { CompanionRequests } from "./companion-request";
import { retryAfterTime } from "./wow-data";
import { EVE_COMPATIBILITY, EVE_UNIVERSE, evePlan, parseEveIncursions, parseEveKills, parseEveRoute, parseEveStatus, parseEveUniverse, type EvePlan } from "./eve-data";

export type EveSnapshot<T> = { data: T; at: number | null; receivedAt: number };
type RawSnapshot = { data: unknown; at: number | null; receivedAt: number; expiresAt: number; status: number; etag?: string };
const base = "https://esi.evetech.net", identity = "HarborEveCompanion/1.0 (+https://harbor.site)";
let cooldown = 0;
const snapshots = new Map<string, RawSnapshot>();
function cacheUntil(response: Response, now: number, fallback: number) {
  const expires = Date.parse(response.headers.get("expires") ?? ""), maxAge = /(?:^|,)\s*max-age=(\d+)/.exec(response.headers.get("cache-control") ?? "");
  const until = Number.isFinite(expires) ? expires : now + (maxAge ? Number(maxAge[1]) * 1000 : fallback);
  return Math.max(now + 1000, Math.min(now + 86_400_000, until));
}
async function json(response: Response, limit: number): Promise<unknown> {
  const reader = response.body?.getReader(); let body = "", count = 0;
  if (reader) { const decoder = new TextDecoder(); try { while (true) { const part = await reader.read(); if (part.done) break; count += part.value.length; if (count > limit) throw Error("EVE response too large"); body += decoder.decode(part.value, { stream: true }); } body += decoder.decode(); } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); } }
  else { body = await response.text(); if (new TextEncoder().encode(body).length > limit) throw Error("EVE response too large"); }
  return JSON.parse(body) as unknown;
}
const requests = new CompanionRequests(async (key, signal) => {
  const previous = snapshots.get(key);
  if (previous && Date.now() < previous.expiresAt) return previous;
  if (key === EVE_UNIVERSE) { const response = await fetch(key, { signal }); if (!response.ok) throw Error("Universe unavailable"); return { data: await json(response, 1024 * 1024), at: null, receivedAt: Date.now(), expiresAt: Date.now() + 86_400_000, status: 200 }; }
  if (Date.now() < cooldown) throw Error("EVE source cooling down");
  const url = new URL(key), headers: Record<string, string> = { "X-Compatibility-Date": EVE_COMPATIBILITY, "X-User-Agent": identity };
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) headers["User-Agent"] = identity;
  if (previous?.etag) headers["If-None-Match"] = previous.etag;
  const route = /^\/route\/(\d+)\/(\d+)$/.exec(url.pathname);
  let body: string | undefined;
  if (route) { const plan = evePlan({ origin: Number(route[1]), destination: Number(route[2]), preference: url.searchParams.get("preference"), avoid: url.searchParams.getAll("avoid").map(Number) }); body = JSON.stringify({ preference: plan.preference, avoid_systems: plan.avoid }); headers["Content-Type"] = "application/json"; url.search = ""; }
  const response = await safeFetchBytes(url.href, { signal, headers, credentials: "omit", ...(body ? { method: "POST", body } : {}) }, 12_000, 1024 * 1024);
  const now = Date.now();
  if (response.status === 420 || response.status === 429) cooldown = retryAfterTime(response.headers.get("retry-after") ?? response.headers.get("x-esi-error-limit-reset"), now);
  const remain = response.headers.get("x-esi-error-limit-remain"), tokens = response.headers.get("x-ratelimit-remaining");
  if ((remain !== null && Number(remain) < 5) || (tokens !== null && Number(tokens) < 5)) cooldown = Math.max(cooldown, retryAfterTime(response.headers.get("x-esi-error-limit-reset"), now));
  const fallback = route ? 60_000 : url.pathname === "/status" ? 30_000 : url.pathname === "/incursions" ? 300_000 : 3_600_000;
  const expiresAt = cacheUntil(response, now, fallback);
  if (response.status === 304 && previous) return { ...previous, receivedAt: now, expiresAt };
  if (!response.ok && !(route && response.status === 404)) throw Error(`EVE source ${response.status}`);
  const modified = Date.parse(response.headers.get("last-modified") ?? "");
  if (response.status === 404) await response.body?.cancel().catch(() => {});
  return { data: response.status === 404 ? null : await json(response, 1024 * 1024), at: Number.isFinite(modified) && modified <= now + 300_000 ? modified : null, receivedAt: now, expiresAt, status: response.status, etag: response.headers.get("etag") ?? undefined };
});
async function load<T>(url: string, parse: (body: unknown, status: number) => T, signal: AbortSignal): Promise<EveSnapshot<T>> {
  const value = await requests.get(url, 0, raw => {
    const v = raw as RawSnapshot, data = parse(v.data, v.status);
    // Only validated responses receive conditional-cache authority. ESI's Expires
    // boundary determines refresh eligibility, including for a manual refresh.
    snapshots.delete(url); snapshots.set(url, v); while (snapshots.size > 40) snapshots.delete(snapshots.keys().next().value!);
    return { data, at: v.at, receivedAt: v.receivedAt };
  }, signal);
  return value.data;
}
export const loadEveUniverse = (signal: AbortSignal) => load(EVE_UNIVERSE, parseEveUniverse, signal);
export const loadEveStatus = (signal: AbortSignal) => load(`${base}/status`, parseEveStatus, signal);
export const loadEveKills = (signal: AbortSignal) => load(`${base}/universe/system_kills`, parseEveKills, signal);
export const loadEveIncursions = (signal: AbortSignal) => load(`${base}/incursions`, parseEveIncursions, signal);
export function loadEveRoute(value: EvePlan, signal: AbortSignal) {
  const plan = evePlan(value), params = new URLSearchParams({ preference: plan.preference });
  plan.avoid.forEach(id => params.append("avoid", String(id)));
  return load(`${base}/route/${plan.origin}/${plan.destination}?${params}`, (raw, status) => status === 404 ? null : parseEveRoute(raw, plan), signal);
}
