import { safeFetchBytes } from "@/lib/safe-fetch";
import { CompanionRequests } from "./companion-request";
import { retryAfterTime } from "./wow-data";
import { parseTftCatalog, tftLocale, tftVersion } from "./tft-data";

const cooldown = new Map<string, number>();
const requests = new CompanionRequests(async (url, signal) => {
  const origin = new URL(url).origin;
  if ((cooldown.get(origin) ?? 0) > Date.now()) throw Error("TFT source rate limited");
  const response = await safeFetchBytes(url, { signal, credentials: "omit" }, 12000, 2 * 1024 * 1024);
  if (response.status === 429) cooldown.set(origin, retryAfterTime(response.headers.get("retry-after"), Date.now()));
  if (!response.ok) throw Error(`TFT source ${response.status}`);
  const reader = response.body?.getReader(); let body = "", size = 0;
  if (reader) { const decoder = new TextDecoder(); try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 2 * 1024 * 1024) throw Error("TFT response too large"); body += decoder.decode(part.value, { stream: true }); } body += decoder.decode(); } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); } }
  else { body = await response.text(); if (new TextEncoder().encode(body).length > 2 * 1024 * 1024) throw Error("TFT response too large"); }
  return JSON.parse(body) as unknown;
});
export async function loadTftCatalog(language: string, signal: AbortSignal, refresh = false) {
  const ttl = refresh ? 30000 : 60 * 60_000;
  const version = await requests.get("https://ddragon.leagueoflegends.com/api/versions.json", ttl, tftVersion, signal), locale = tftLocale(language);
  const base = `https://raw.communitydragon.org/${version.data}/plugins/rcp-be-lol-game-data/global/${locale}/v1/`;
  const results = await Promise.all(["tftsets", "tftchampions-teamplanner", "tfttraits"].map(file => requests.get(`${base}${file}.json`, ttl, raw => raw, signal)));
  signal.throwIfAborted();
  return { data: parseTftCatalog(results[0].data, results[1].data, results[2].data, version.data, locale), at: Math.min(...results.map(r => r.at)) };
}
