import { safeFetchBytes } from "@/lib/safe-fetch";
import { CompanionRequests } from "./companion-request";
import { retryAfterTime } from "./wow-data";
import { parseTarkovSeasons, parseTarkovWipes, TARKOV_SEASONS, TARKOV_WIPES } from "./tarkov-data";

let cooldown = 0;
const requests = new CompanionRequests(async (url, signal) => {
  if (Date.now() < cooldown) throw Error("Tarkov source rate limited");
  const response = await safeFetchBytes(url, { signal, credentials: "omit" }, 12000, 128 * 1024);
  if (response.status === 429) cooldown = retryAfterTime(response.headers.get("retry-after"), Date.now());
  if (!response.ok) throw Error(`Tarkov source ${response.status}`);
  const reader = response.body?.getReader(); let body = "", size = 0;
  if (reader) {
    const decoder = new TextDecoder();
    try { for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 128 * 1024) throw Error("Tarkov response too large"); body += decoder.decode(part.value, { stream: true }); } body += decoder.decode(); }
    finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  } else { body = await response.text(); if (new TextEncoder().encode(body).length > 128 * 1024) throw Error("Tarkov response too large"); }
  return JSON.parse(body) as unknown;
});
export const loadTarkovSeasons = (signal: AbortSignal, refresh = false) => requests.get(TARKOV_SEASONS, refresh ? 30000 : 3600000, parseTarkovSeasons, signal);
export const loadTarkovWipes = (signal: AbortSignal, refresh = false) => requests.get(TARKOV_WIPES, refresh ? 30000 : 3600000, parseTarkovWipes, signal);
