import { safeFetchBytes } from "@/lib/safe-fetch";
import { CompanionRequests } from "./companion-request";
import { parseCurseForge, parseMinecraftServers, type ServerSource } from "./minecraft-discovery";

const requests = new CompanionRequests(async (url, signal) => {
  const response = await safeFetchBytes(url, { signal }, 14_000, 5 * 1024 * 1024);
  if (!response.ok) throw Error(response.status === 403 ? "minecraft_source_blocked" : "minecraft_source_unavailable");
  const reader = response.body?.getReader();
  if (!reader) throw Error("minecraft_source_unavailable");
  let bytes = 0, html = ""; const decoder = new TextDecoder();
  try {
    while (true) { signal.throwIfAborted(); const chunk = await reader.read(); if (chunk.done) break; bytes += chunk.value.length; if (bytes > 5 * 1024 * 1024) throw Error("minecraft_source_size"); html += decoder.decode(chunk.value, { stream: true }); }
    return html + decoder.decode();
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
});
export const loadCurseForge = (url: string, signal: AbortSignal, refresh = false) => requests.get(url, refresh ? 0 : 5 * 60_000, raw => parseCurseForge(String(raw), url), signal);
export const loadMinecraftServers = (source: ServerSource, url: string, signal: AbortSignal, refresh = false) => requests.get(url, refresh ? 0 : 2 * 60_000, raw => parseMinecraftServers(String(raw), source, url), signal);
