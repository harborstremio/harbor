import { safeFetchBytes } from "@/lib/safe-fetch";
import { CompanionRequests } from "./companion-request";
import { GameRequestPool } from "./request-pool";
import { metadataStore } from "./metadata-store";
import { retryAfterTime } from "./wow-data";
import { FORTNITE_API, FORTNITE_MEDIA_API, FORTNITE_TTL, fortniteCode, fortniteRankingsUrl, parseFortniteActivity, parseFortniteIsland, parseFortniteIslandBasics, parseFortniteRankings } from "./fortnite-data";

const MAX_BYTES = 256 * 1024;
const cooldown = new Map<string, number>();
const mediaPool = new GameRequestPool(1);
async function responseText(response: Response, limit: number): Promise<string> {
  const reader = response.body?.getReader(); let body = "";
  if (reader) {
    let bytes = 0; const decoder = new TextDecoder();
    try { while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.length; if (bytes > limit) throw Error("Island response too large"); body += decoder.decode(part.value, { stream: true }); } body += decoder.decode(); }
    finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  } else { body = await response.text(); if (new TextEncoder().encode(body).length > limit) throw Error("Island response too large"); }
  return body;
}
function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}
async function fetchResource(url: string, signal: AbortSignal) {
  const origin = new URL(url).origin;
  const delay = (cooldown.get(origin) ?? 0) - Date.now();
  if (delay > 12_000) throw Error("Fortnite provider rate limited");
  if (delay > 0) await wait(delay, signal);
  let response = await safeFetchBytes(url, { signal, credentials: "omit" }, 15_000, MAX_BYTES);
  if (response.status !== 429) return response;
  // FN Api also supplies a ten-second cooldown in its JSON error. Its CORS
  // policy does not expose Retry-After to browsers, so read that bounded body.
  const body = await responseText(response, 2048);
  const seconds = /retry in (\d{1,4})s/i.exec(body)?.[1];
  const until = retryAfterTime(response.headers.get("retry-after") ?? seconds ?? null, Date.now()) + 250;
  cooldown.set(origin, until);
  if (until - Date.now() > 11_000) throw Error("Fortnite provider rate limited");
  await wait(until - Date.now(), signal);
  response = await safeFetchBytes(url, { signal, credentials: "omit" }, 15_000, MAX_BYTES);
  if (response.status === 429) cooldown.set(origin, retryAfterTime(response.headers.get("retry-after"), Date.now()));
  return response;
}
const requests = new CompanionRequests(async (url, signal) => {
  const response = await fetchResource(url, signal);
  if (!response.ok) throw Error(`Fortnite provider ${response.status}`);
  const raw: unknown = JSON.parse(await responseText(response, MAX_BYTES));
  if (url.startsWith(`${FORTNITE_MEDIA_API}/`)) {
    const code = url.slice(FORTNITE_MEDIA_API.length + 1); parseFortniteIsland(raw, code);
    // Public artwork survives app restarts; the shared store enforces its size/LRU budget.
    void metadataStore.write(`fortnite:media:v1:${code}`, { at: Date.now(), data: raw }).catch(() => {});
  }
  return raw;
});
export function loadFortniteRankings(genre: string, signal: AbortSignal, page?: { cursor: string; before?: boolean; snapshot: string }, refresh = false) {
  return requests.get(fortniteRankingsUrl(genre, page), refresh ? 0 : FORTNITE_TTL, parseFortniteRankings, signal);
}
export function loadFortniteIslandBasics(code: string, signal: AbortSignal, refresh = false) {
  if (!fortniteCode(code)) throw Error("Invalid island code");
  return requests.get(`${FORTNITE_API}/islands/${code}`, refresh ? 0 : 60 * 60_000, value => parseFortniteIslandBasics(value, code), signal);
}
export async function loadFortniteIsland(code: string, signal: AbortSignal, refresh = false) {
  if (!fortniteCode(code)) throw Error("Invalid island code");
  signal.throwIfAborted();
  if (!refresh) {
    const held = await metadataStore.read(`fortnite:media:v1:${code}`).catch(() => null);
    signal.throwIfAborted();
    if (held && Number.isFinite(held.at) && held.at <= Date.now() && Date.now() - held.at < 60 * 60_000) {
      try { return { data: parseFortniteIsland(held.data, code), at: held.at }; } catch { /* Invalid snapshots cannot supply another island's media. */ }
    }
  }
  return mediaPool.run(() => requests.get(`${FORTNITE_MEDIA_API}/${code}`, refresh ? 0 : 60 * 60_000, value => parseFortniteIsland(value, code), signal), signal);
}
export function loadFortniteActivity(code: string, signal: AbortSignal, refresh = false) {
  if (!fortniteCode(code)) throw Error("Invalid island code");
  // The date boundary is part of the key so yesterday is not retained after UTC midnight.
  const date = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  return requests.get(`${FORTNITE_API}/islands/${code}/metrics?from=${date}T00%3A00%3A00Z&to=${date}T23%3A59%3A59Z`, refresh ? 0 : FORTNITE_TTL, parseFortniteActivity, signal);
}
