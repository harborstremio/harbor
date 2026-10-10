import { FINAL_URL_HEADER, safeFetchBytes } from "@/lib/safe-fetch";
import { discoverSourceIcon, sourceArtworkSite } from "./source-artwork";

const cache = new Map<string, { icon?: string; until: number }>();
const pending = new Map<string, Promise<string | undefined>>();
let active = 0;
const waiting: (() => void)[] = [];

export function fetchSourceIcon(site: string): Promise<string | undefined> {
  const origin = sourceArtworkSite(site);
  if (!origin) return Promise.resolve(undefined);
  const saved = cache.get(origin);
  if (saved && saved.until > Date.now()) return Promise.resolve(saved.icon);
  const existing = pending.get(origin);
  if (existing) return existing;
  // Two small lookups at once; repeated release rows share the same result.
  if (pending.size >= 128) return Promise.resolve(undefined);
  const task = (async () => {
    if (active >= 2) await new Promise<void>(resolve => waiting.push(resolve));
    active++;
    let icon: string | undefined;
    try {
      const signal = AbortSignal.timeout(8000);
      const response = await safeFetchBytes(origin, { signal, credentials: "omit", headers: { Accept: "text/html" } }, 8000, 1024 * 1024);
      if (!response.ok) return;
      const reader = response.body?.getReader();
      if (!reader) return;
      let html = "", bytes = 0;
      const decoder = new TextDecoder();
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          bytes += part.value.byteLength;
          if (bytes > 1024 * 1024) break;
          html += decoder.decode(part.value, { stream: true });
          if (/<\/head\s*>/i.test(html)) break;
        }
        html += decoder.decode();
        const final = response.headers.get(FINAL_URL_HEADER) || response.url;
        const base = final && !new URL(final).pathname.startsWith("/api-proxy/") ? final : origin;
        icon = discoverSourceIcon(html, base);
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      return icon;
    } catch { return; }
    finally {
      cache.delete(origin);
      cache.set(origin, { icon, until: Date.now() + (icon ? 60 : 5) * 60_000 });
      while (cache.size > 128) cache.delete(cache.keys().next().value!);
      active--;
      waiting.shift()?.();
      pending.delete(origin);
    }
  })();
  pending.set(origin, task);
  return task;
}
