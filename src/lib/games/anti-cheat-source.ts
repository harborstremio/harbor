import { CompanionRequests } from "./companion-request";
import { COMMUNITY_ANTI_CHEAT_URL, parseCommunityAntiCheat, parseSteamAntiCheat, UNKNOWN_ANTI_CHEAT, type GameAntiCheat } from "./anti-cheat-data";

type FetchAntiCheat = (url: string, init: RequestInit, timeoutMs: number, maxBytes: number) => Promise<Response>;
const MAX_BYTES = 2 * 1024 * 1024;

export function createGameAntiCheatLoader(fetchBytes: FetchAntiCheat, now = Date.now) {
  const requests = new CompanionRequests(async (url, signal) => {
    const bounded = AbortSignal.any([signal, AbortSignal.timeout(12_000)]);
    const response = await fetchBytes(url, { signal: bounded, credentials: "omit" }, 12_000, MAX_BYTES);
    if (!response.ok) throw Error("Anti-cheat information unavailable");
    if (Number(response.headers.get("content-length")) > MAX_BYTES) throw Error("Anti-cheat response too large");
    const reader = response.body?.getReader();
    if (!reader) {
      const body = await response.text();
      if (new TextEncoder().encode(body).byteLength > MAX_BYTES) throw Error("Anti-cheat response too large");
      return body;
    }
    const decoder = new TextDecoder(); let body = "", bytes = 0;
    try {
      while (true) {
        bounded.throwIfAborted();
        const part = await reader.read(); if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > MAX_BYTES) throw Error("Anti-cheat response too large");
        body += decoder.decode(part.value, { stream: true });
      }
      return body + decoder.decode();
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  }, now);

  return async (appId: number, signal: AbortSignal): Promise<GameAntiCheat> => {
    if (!Number.isSafeInteger(appId) || appId <= 0) throw Error("Invalid game ID");
    signal.throwIfAborted();
    let steam = UNKNOWN_ANTI_CHEAT;
    try {
      steam = (await requests.get(`https://store.steampowered.com/app/${appId}/?l=english&cc=us`, 30 * 60_000, raw => parseSteamAntiCheat(String(raw), appId), signal)).data;
      signal.throwIfAborted();
      if (steam.status === "reported") return steam;
    } catch { signal.throwIfAborted(); }
    try {
      const directory = await requests.get(COMMUNITY_ANTI_CHEAT_URL, 6 * 3600_000, raw => parseCommunityAntiCheat(JSON.parse(String(raw))), signal);
      signal.throwIfAborted();
      return directory.data.get(appId) ?? steam;
    } catch { signal.throwIfAborted(); return steam; }
  };
}
