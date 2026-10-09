import { safeFetch } from "@/lib/safe-fetch";
import { applySteamSaleCardPolicy, currentSteamSale, enrichSteamSaleEvent, parseSteamSaleSchedule, STEAM_SALE_CARDS_FAQ, STEAM_SALE_SCHEDULE, type SteamSaleEvent } from "./steam-events-data";
export { currentSteamSale, steamSaleDays, steamSalePhase, type SteamSaleEvent } from "./steam-events-data";
const TTL = 6 * 60 * 60_000;
let cached: { at: number; events: SteamSaleEvent[] } | undefined;
let pending: Promise<SteamSaleEvent[]> | undefined;
async function request(url: string) {
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await safeFetch(url, { signal: controller.signal });
    if (!response.ok || Number(response.headers.get("content-length")) > 2_000_000) throw Error("Steam sale schedule unavailable");
    const text = await response.text(); if (text.length > 2_000_000) throw Error("Steam sale schedule is too large"); return text;
  } finally { clearTimeout(timeout); }
}
async function load() {
  const at = Date.now();
  const policy = request(STEAM_SALE_CARDS_FAQ).catch(() => null);
  let events = parseSteamSaleSchedule(await request(STEAM_SALE_SCHEDULE), at);
  const next = currentSteamSale(events, at);
  if (next && next.sourceUrl !== STEAM_SALE_SCHEDULE) {
    try { const index = events.indexOf(next); events[index] = enrichSteamSaleEvent(next, await request(next.sourceUrl)); } catch { /* Published day-only dates are still useful. */ }
  }
  const faq = await policy;
  if (faq) events = applySteamSaleCardPolicy(events, faq, at);
  cached = { at, events }; return events;
}
/** Public schedule only; failures never invent a recurring sale or reuse an old countdown. */
export async function loadSteamSaleEvents(signal?: AbortSignal): Promise<SteamSaleEvent[]> {
  signal?.throwIfAborted();
  if (cached && Date.now() >= cached.at && Date.now() - cached.at < TTL) return cached.events;
  const task = pending ?? (pending = load().finally(() => { pending = undefined; }));
  if (!signal) return task;
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    task.then(value => { if (!signal.aborted) resolve(value); }, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}
