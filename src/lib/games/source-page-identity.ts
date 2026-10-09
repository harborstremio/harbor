import { FINAL_URL_HEADER, safeFetchBytes } from "@/lib/safe-fetch";
import type { GameSource, SourceRelease } from "./sources";
import { sourcePageUrl } from './source-page-url';
import { uniqueLinkedSteamId } from "./source-display";
import { sourcePageArtwork, type SourcePageData } from "./source-page-data";
import { sourcePageSnapshot } from "./source-page-snapshots";

/** One bounded read of the connected source's release page to verify catalog identity. */
export async function loadSourcePageSteamId(source: GameSource, release: SourceRelease, signal: AbortSignal): Promise<number | undefined> {
  return (await loadSourcePageData(source, release, signal))?.steamId;
}

export async function loadSourcePageData(source: GameSource, release: SourceRelease, signal: AbortSignal): Promise<(SourcePageData & { page: string }) | undefined> {
  const url = sourcePageUrl(source, release);
  if (!url) return;
  const origin = new URL(url).origin, limit = 1024 * 1024;
  const snapshot = sourcePageSnapshot(url, release.title);
  const fallback = snapshot ? { ...snapshot, page: url } : undefined;
  try {
    const response = await safeFetchBytes(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]), credentials: "omit", headers: { Accept: "text/html" } }, 8000, limit);
    if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) return fallback;
    const final = response.headers.get(FINAL_URL_HEADER) || response.url;
    if (final && !new URL(final).pathname.startsWith("/api-proxy/") && new URL(final).origin !== origin) return;
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > limit) return;
    const charset = /charset\s*=\s*["']?(windows-1251|utf-8)/i.exec(response.headers.get("content-type") || "")?.[1] || "utf-8";
    const html = new TextDecoder(charset).decode(bytes);
    const template = document.createElement("template");
    template.innerHTML = html;
    template.content.querySelectorAll("script,style,nav,footer").forEach(node => node.remove());
    // Store links often live in the release's facts sidebar (e.g. GameBounty).
    // Keep that content; multiple different app links still fail closed.
    const content = template.content.querySelector("main") || template.content;
    return { page: url, steamId: uniqueLinkedSteamId([...content.querySelectorAll("a[href]")].map(node => node.getAttribute("href") || "")), ...sourcePageArtwork(template.content, url, release.title) };
  } catch {
    signal.throwIfAborted();
    return fallback;
  }
}
