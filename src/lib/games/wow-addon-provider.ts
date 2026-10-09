import { safeFetchBytes } from "@/lib/safe-fetch";
import { GameRequestPool } from "./request-pool";
import { retryAfterTime } from "./wow-data";

// Catalogs and individual artwork share the provider's network budget, but keep
// their independently validated caches. Cancellation also removes queued reads.
const pool = new GameRequestPool(2);
let retryAt = 0;
export function wowAddonJson(url: string, signal: AbortSignal, maxBytes: number): Promise<unknown> {
  return pool.run(async () => {
    if (Date.now() < retryAt) throw Error("Addon provider rate limit");
    const response = await safeFetchBytes(url, { signal }, 15_000, maxBytes);
    if (response.status === 429) retryAt = Math.max(retryAt, retryAfterTime(response.headers.get("retry-after"), Date.now()));
    if (!response.ok) throw Error("Addon provider unavailable");
    const reader = response.body?.getReader();
    if (!reader) {
      const text = await response.text();
      if (new TextEncoder().encode(text).length > maxBytes) throw Error("Addon response too large");
      return JSON.parse(text) as unknown;
    }
    let bytes = 0, text = ""; const decoder = new TextDecoder();
    try {
      while (true) {
        const part = await reader.read(); if (part.done) break;
        bytes += part.value.length; if (bytes > maxBytes) throw Error("Addon response too large");
        text += decoder.decode(part.value, { stream: true });
      }
      return JSON.parse(text + decoder.decode()) as unknown;
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  }, signal);
}
