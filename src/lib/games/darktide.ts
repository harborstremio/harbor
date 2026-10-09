import { safeFetchBytes } from "@/lib/safe-fetch";
import { CompanionRequests } from "./companion-request";
import { DARKTIDE_SOURCE, DARKTIDE_TTL, parseDarktideBoard } from "./darktide-data";
import { retryAfterTime } from "./wow-data";

const MAX_BYTES = 2 * 1024 * 1024;
let retryAt = 0;
const requests = new CompanionRequests(async (url, signal) => {
  if (Date.now() < retryAt) throw Error("Mission provider is rate limiting requests");
  const response = await safeFetchBytes(url, { signal, credentials: "omit" }, 15_000, MAX_BYTES);
  if (response.status === 429) retryAt = Math.max(retryAt, retryAfterTime(response.headers.get("retry-after"), Date.now()));
  if (!response.ok) throw Error(`Mission provider ${response.status}`);
  const reader = response.body?.getReader();
  if (!reader) { const body = await response.text(); if (new TextEncoder().encode(body).length > MAX_BYTES) throw Error("Mission response too large"); return JSON.parse(body) as unknown; }
  let text = "", size = 0; const decoder = new TextDecoder();
  try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > MAX_BYTES) throw Error("Mission response too large"); text += decoder.decode(part.value, { stream: true }); } return JSON.parse(text + decoder.decode()) as unknown; }
  finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
});
export function loadDarktideBoard(signal: AbortSignal, refresh = false) { return requests.get(`${DARKTIDE_SOURCE}raw_missions`, refresh ? 0 : DARKTIDE_TTL, parseDarktideBoard, signal); }
