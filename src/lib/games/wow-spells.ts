import { safeFetchBytes } from "@/lib/safe-fetch";
import { CompanionRequests } from "./companion-request";
import { retryAfterTime } from "./wow-data";
import { parseWowSpellDescription, wowSpellLocale, wowSpellUrl } from "./wow-talents";

let retryAt = 0;
const MAX_BYTES = 128 * 1024;
// Independent provider budget: a Wowhead outage must not block character data.
const requests = new CompanionRequests(async (url, signal) => {
  if (Date.now() < retryAt) throw Error("Spell reference rate limited");
  const response = await safeFetchBytes(url, { signal }, 15_000, MAX_BYTES);
  if (response.status === 429) retryAt = Math.max(retryAt, retryAfterTime(response.headers.get("retry-after"), Date.now()));
  if (!response.ok) throw Error("Spell reference unavailable");
  const reader = response.body?.getReader();
  if (!reader) { const text = await response.text(); if (new TextEncoder().encode(text).length > MAX_BYTES) throw Error("Spell reference too large"); return JSON.parse(text) as unknown; }
  let size = 0, text = ""; const decoder = new TextDecoder();
  try {
    while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > MAX_BYTES) throw Error("Spell reference too large"); text += decoder.decode(part.value, { stream: true }); }
    return JSON.parse(text + decoder.decode()) as unknown;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
});
export function loadWowSpell(id: number, language: string, signal: AbortSignal) {
  wowSpellUrl(id);
  return requests.get(`https://nether.wowhead.com/tooltip/spell/${id}?dataEnv=1&locale=${wowSpellLocale(language)}`, 30 * 60_000, raw => parseWowSpellDescription(raw, id, language), signal);
}
