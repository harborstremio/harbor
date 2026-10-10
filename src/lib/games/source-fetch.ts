import { FINAL_URL_HEADER, safeFetchBytes } from "@/lib/safe-fetch";
import { sourceError, sourceResponseError, sourceUrl, SOURCE_MAX_BYTES, type SourceManifest, type SourceWebsite } from "./sources";
import { parseSourceAsync } from "./source-processing";
import { discoverSourceLinks, sourceInputUrl, type SourceCandidate } from "./source-discovery";
import { discoverWebsiteApi, websiteApiInfo, websitePostsUrl, parseWebsitePosts, type WebsitePage } from "./source-website";
import { discoverSourceIcon, inheritSourceArtwork } from "./source-artwork";
import { fetchVerifiedSource } from "./source-verification";
import { createSourceWorkQueue } from "./source-work-queue";
import { fetchNativeSource } from "./source-http";

export type SourceInspection = { kind: "catalog"; url: string; manifest: SourceManifest; website?: string } | { kind: "choices"; website: string; icon?: string; candidates: SourceCandidate[] };

const sourceReads = createSourceWorkQueue();
function readCatalog<T>(signal: AbortSignal, read: () => Promise<T>, interactive = false) {
  // Keep one downloaded body through parsing. Visible reads pass waiting refreshes;
  // canceled requests leave the queue immediately without starting HTTP work.
  return sourceReads.run(() => { signal.throwIfAborted(); return read(); }, interactive, signal);
}

async function fetchSourceDocument(url: string, signal: AbortSignal, maxBytes = SOURCE_MAX_BYTES, allowPageEnd = false, profile?: string) {
  const timeout = AbortSignal.timeout(20_000);
  const bounded = AbortSignal.any([signal, timeout]);
  const response = await fetchNativeSource(profile, url, bounded, maxBytes)
    ?? await fetchVerifiedSource(profile, url, bounded, maxBytes)
    ?? await safeFetchBytes(url, { signal: bounded, credentials: "omit", headers: { Accept: "application/json, text/html;q=0.8" } }, 20_000, maxBytes);
  const rejected = !response.ok && !(allowPageEnd && response.status === 400)
    ? sourceResponseError(response.status) : Number(response.headers.get("content-length")) > maxBytes ? "source_limit" : undefined;
  if (rejected) {
    // A failed status or oversized header must not leave its body downloading
    // after this operation releases the serial queue.
    await response.body?.cancel().catch(() => {});
    throw Error(rejected);
  }
  const responseUrl = sourceUrl(response.url);
  const finalUrl = sourceUrl(response.headers.get(FINAL_URL_HEADER)) || (responseUrl && !new URL(responseUrl).pathname.startsWith("/api-proxy/") ? responseUrl : url);
  if (!response.body) {
    const body = await response.text();
    if (new TextEncoder().encode(body).byteLength > maxBytes) throw Error("source_limit");
    return { body, url: finalUrl, headers: response.headers, status: response.status };
  }
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let bytes = 0, body = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) throw Error("source_limit");
      body += decoder.decode(chunk.value, { stream: true });
    }
    body += decoder.decode();
    return { body, url: finalUrl, headers: response.headers, status: response.status };
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

async function fetchWebsiteDocument(url: string, signal: AbortSignal, allowPageEnd = false, profile?: string) {
  try { return await fetchSourceDocument(url, signal, 4 * 1024 * 1024, allowPageEnd, profile); }
  catch (error) {
    if (sourceError(error) === "games.sources.source_limit") throw Error("source_website_limit");
    throw error;
  }
}

export async function fetchGameSource(input: string, signal: AbortSignal, website?: SourceWebsite, name?: string, profile?: string, interactive = false): Promise<SourceManifest> {
  const url = sourceUrl(input);
  if (!url) throw Error("source_url");
  return readCatalog(signal, async () => website ? { name: name || new URL(website.site).hostname, homepage: website.site, format: "website", website, entries: (await readWebsitePage(website, "", 1, signal, profile)).entries, skipped: 0 } : parseSourceAsync((await fetchSourceDocument(url, signal, SOURCE_MAX_BYTES, false, profile)).body, signal), interactive);
}

export async function inspectGameSource(input: string, signal: AbortSignal, profile?: string): Promise<SourceInspection> {
  const url = sourceInputUrl(input);
  if (!url) throw Error("source_url");
  return readCatalog(signal, () => inspectSourceUrl(url, signal, profile), true);
}

async function inspectSourceUrl(url: string, signal: AbortSignal, profile?: string): Promise<SourceInspection> {
  const document = await fetchSourceDocument(url, signal, SOURCE_MAX_BYTES, false, profile);
  if (!/^\s*(?:\uFEFF)?\s*</.test(document.body)) return { kind: "catalog", url: document.url, manifest: await parseSourceAsync(document.body, signal) };
  const api = discoverWebsiteApi(document.body, document.url, document.headers.get("link"));
  const icon = discoverSourceIcon(document.body, document.url);
  const candidates = discoverSourceLinks(document.body, document.url, api);
  if (!candidates.length) {
    if (!api) throw Error("source_no_catalog");
    const info = await fetchWebsiteDocument(api, signal, false, profile);
    let root: unknown; try { root = JSON.parse(info.body); } catch { throw Error("source_format"); }
    const { name, website } = websiteApiInfo(root, info.url, document.url);
    const page = await readWebsitePage(website, "", 1, signal, profile);
    if (!page.entries.length) throw Error("source_no_catalog");
    return { kind: "catalog", url: website.site, manifest: { name, homepage: website.site, icon, format: "website", website, entries: page.entries, skipped: 0 } };
  }
  if (candidates.length > 1) return { kind: "choices", website: document.url, icon, candidates };
  // One published catalog is unambiguous. Follow it once, never recursively crawl.
  signal.throwIfAborted();
  const catalog = await fetchSourceDocument(candidates[0].url, signal, SOURCE_MAX_BYTES, false, profile);
  const manifest = await parseSourceAsync(catalog.body, signal);
  return { kind: "catalog", website: document.url, url: catalog.url, manifest: inheritSourceArtwork(manifest, document.url, icon) };
}

const websiteCache = new Map<string, { value: WebsitePage; until: number; bytes: number }>();
async function readWebsitePage(website: SourceWebsite, query: string, page: number, signal: AbortSignal, profile?: string): Promise<WebsitePage> {
  const url = websitePostsUrl(website, query, page);
  const document = await fetchWebsiteDocument(url, signal, page > 1, profile);
  let value: unknown; try { value = JSON.parse(document.body); } catch { throw Error("source_format"); }
  if (document.status === 400) {
    if (page > 1 && value && typeof value === "object" && "code" in value && value.code === "rest_post_invalid_page_number") return { entries: [], next: null };
    throw Error("source_network");
  }
  const result = parseWebsitePosts(value, website, page, document.headers.get("x-wp-totalpages"));
  signal.throwIfAborted();
  const bytes = new TextEncoder().encode(JSON.stringify(result)).byteLength;
  websiteCache.set(JSON.stringify([profile, website.site, url]), { value: result, until: Date.now() + 5 * 60_000, bytes });
  let total = [...websiteCache.values()].reduce((sum, entry) => sum + entry.bytes, 0);
  while (websiteCache.size > 40 || total > 4 * 1024 * 1024) { const first = websiteCache.keys().next().value!; total -= websiteCache.get(first)!.bytes; websiteCache.delete(first); }
  return result;
}

export async function fetchWebsiteSource(website: SourceWebsite, query: string, page: number, signal: AbortSignal, refresh = false, profile?: string, interactive = true): Promise<WebsitePage> {
  signal.throwIfAborted();
  const url = websitePostsUrl(website, query, page), cached = websiteCache.get(JSON.stringify([profile, website.site, url]));
  if (!refresh && cached && cached.until > Date.now()) return cached.value;
  return readCatalog(signal, () => readWebsitePage(website, query, page, signal, profile), interactive);
}
