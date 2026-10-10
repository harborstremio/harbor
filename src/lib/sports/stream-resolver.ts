import { safeFetch } from "@/lib/safe-fetch";
import { dwarn } from "@/lib/debug";

export type StreamKind = "hls" | "dash" | "file";

export type FoundVia = "direct" | "element" | "meta" | "structured" | "config" | "source" | "frame";

export type ResolveError =
  | "bad-url"
  | "unreachable"
  | "http-empty"
  | "empty"
  | "http-no-media"
  | "no-media";

export type ResolveFailure = { code: ResolveError; status: number };

export type StreamCandidate = {
  url: string;
  kind: StreamKind;
  confidence: number;
  via: FoundVia;
  headers?: Record<string, string>;
};

export type ResolveResult = {
  pageUrl: string;
  title: string;
  poster: string;
  candidates: StreamCandidate[];
  failure: ResolveFailure | null;
};

const FETCH_TIMEOUT_MS = 15000;
const MAX_HTML_CHARS = 3_000_000;
const MAX_SCRIPT_CHARS = 400_000;
const MAX_SCRIPTS = 80;
const MAX_FRAMES = 12;
const MAX_FOLLOW = 2;
const MAX_TRACKED = 120;
const MAX_CANDIDATES = 24;

const BASE_SCORE: Record<StreamKind, number> = { hls: 0.72, dash: 0.68, file: 0.6 };

const HLS_RE = /\.m3u8?(?:[?#]|$)/i;
const DASH_RE = /\.mpd(?:[?#]|$)/i;
const FILE_RE = /\.(?:mp4|m4v|webm|mkv|mov|ts|flv|ogv)(?:[?#]|$)/i;
const NOISE_RE =
  /(?:\/ads?[/_-]|advert|preroll|midroll|postroll|\/sprite|thumbnail|\/thumbs?\/|\/preview\/|sample\.|\/seg(?:ment)?[-_]?\d|\d{3,}\.ts\b|\.vtt|\.srt|\.jpe?g|\.png|\.webp|\.gif|\.svg|\.ico|\.css|\.woff)/i;

const ABS_URL_RE = /https?:\/\/[^\s"'`<>\\)\]}]{4,600}/g;
const MEDIA_HINT_RE = /\.(?:m3u8?|mpd|mp4|m4v|webm|mkv|mov|ts|flv|ogv)\b/i;
const NESTED_URL_RE = /https?%3A%2F%2F[^\s"'`<>\\)\]}&]{4,600}/gi;
const REL_MEDIA_RE =
  /(?:^|["'(\s=])(\/[^\s"'`<>\\)\]}]{2,240}\.(?:m3u8?|mpd|mp4|m4v|webm|mkv|ts)(?:\?[^\s"'`<>\\)\]}]{0,240})?)/gi;
const CONFIG_KEY_RE =
  /["'`]?\b(?:file|src|source|url|hls|hlsUrl|dash|dashUrl|manifest|manifestUrl|playlist|playlistUrl|stream|streamUrl|videoUrl|contentUrl|mediaUrl|playbackUrl)\b["'`]?\s*[:=]\s*["'`]([^"'`\s]{4,600})["'`]/gi;

type Entry = {
  url: string;
  kind: StreamKind;
  score: number;
  via: FoundVia;
  referer: string;
  hits: number;
};

type Sink = Map<string, Entry>;

type Ctx = { sink: Sink; base: string; referer: string; override: FoundVia | null };

function clamp(n: number): number {
  return Math.max(0.05, Math.min(0.98, n));
}

export function normalizePageUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value || value.length > 2000) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (!parsed.hostname.includes(".") && !/^localhost$/i.test(parsed.hostname)) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return url;
  }
}

export function fileNameOf(url: string): string {
  try {
    const path = new URL(url).pathname;
    const tail = path.split("/").filter(Boolean).pop();
    return tail ? decodeURIComponent(tail) : hostOf(url);
  } catch {
    return url;
  }
}

function kindOf(url: string): StreamKind | null {
  const clean = url.split("#")[0];
  if (HLS_RE.test(clean)) return "hls";
  if (DASH_RE.test(clean)) return "dash";
  if (FILE_RE.test(clean)) return "file";
  return null;
}

function absolute(raw: string, base: string): string | null {
  const trimmed = raw.trim().replace(/[),.;:!\]}]+$/, "");
  if (!trimmed || trimmed.length > 800) return null;
  if (/^(?:data|blob|javascript|about|mailto|tel):/i.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed, base);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    parsed.hash = "";
    return parsed.href;
  } catch {
    return null;
  }
}

function shapeBonus(url: string): number {
  const lower = url.toLowerCase();
  let bonus = 0;
  if (/master\.m3u8|\/master[/?]|playlist\.m3u8/.test(lower)) bonus += 0.06;
  if (/index\.m3u8|chunklist|\/manifest/.test(lower)) bonus += 0.02;
  if (/\/live[/_-]|\/stream[/_-]/.test(lower)) bonus += 0.02;
  return bonus;
}

function add(ctx: Ctx, raw: string, via: FoundVia, boost: number, forced?: StreamKind): void {
  const url = absolute(raw, ctx.base);
  if (!url) return;
  const kind = forced ?? kindOf(url);
  if (!kind) return;
  if (NOISE_RE.test(url)) return;
  const key = url.toLowerCase();
  const score = clamp(BASE_SCORE[kind] + boost + shapeBonus(url));
  const applied = ctx.override ?? via;
  const prev = ctx.sink.get(key);
  if (prev) {
    prev.hits += 1;
    if (score > prev.score) {
      prev.score = score;
      prev.via = applied;
    }
    return;
  }
  if (ctx.sink.size >= MAX_TRACKED) return;
  ctx.sink.set(key, { url, kind, score, via: applied, referer: ctx.referer, hits: 1 });
}

function unescapeForScan(text: string): string {
  return text
    .replace(/\\u002f|\\\/|&#x2f;/gi, "/")
    .replace(/\\u003a/gi, ":")
    .replace(/&amp;/gi, "&");
}

function decodeNested(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function walkJson(node: unknown, depth: number, hit: (key: string, value: string) => void): void {
  if (depth > 8 || node == null || typeof node !== "object") return;
  const pairs = Array.isArray(node)
    ? node.slice(0, 200).map((item, i) => [String(i), item] as const)
    : Object.entries(node as Record<string, unknown>);
  for (const [key, value] of pairs) {
    if (typeof value === "string") hit(key, value);
    else walkJson(value, depth + 1, hit);
  }
}

const MEDIA_ATTRS = ["src", "data-src", "data-url", "data-file", "data-hls", "data-stream"];

function fromElements(doc: Document, ctx: Ctx): void {
  const nodes = doc.querySelectorAll("video, video source, audio source, source[type]");
  for (const el of Array.from(nodes))
    for (const attr of MEDIA_ATTRS) {
      const value = el.getAttribute(attr);
      if (value) add(ctx, value, "element", 0.2);
    }
}

const META_SELECTOR =
  'meta[property="og:video"], meta[property="og:video:url"], meta[property="og:video:secure_url"], meta[name="twitter:player:stream"], meta[itemprop="contentURL"]';

function fromMeta(doc: Document, ctx: Ctx): void {
  for (const el of Array.from(doc.querySelectorAll(META_SELECTOR))) {
    const value = el.getAttribute("content");
    if (value) add(ctx, value, "meta", 0.15);
  }
}

function fromStructured(doc: Document, ctx: Ctx): void {
  for (const el of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    let data: unknown;
    try {
      data = JSON.parse(el.textContent ?? "");
    } catch {
      continue;
    }
    walkJson(data, 0, (key, value) => {
      if (key === "contentUrl" || key === "embedUrl" || key === "url")
        add(ctx, value, "structured", 0.2);
    });
  }
}

function fromScripts(doc: Document, ctx: Ctx): void {
  const scripts = Array.from(doc.querySelectorAll("script:not([src])")).slice(0, MAX_SCRIPTS);
  for (const el of scripts) {
    const text = el.textContent ?? "";
    if (!text || text.length > MAX_SCRIPT_CHARS) continue;
    const scan = unescapeForScan(text);
    for (const match of scan.matchAll(CONFIG_KEY_RE)) add(ctx, match[1], "config", 0.15);
  }
}

function fromSweep(text: string, ctx: Ctx): void {
  const scan = unescapeForScan(text);
  for (const match of scan.matchAll(ABS_URL_RE))
    if (MEDIA_HINT_RE.test(match[0])) add(ctx, match[0], "source", 0);
  for (const match of scan.matchAll(REL_MEDIA_RE)) add(ctx, match[1], "source", 0);
  for (const match of scan.matchAll(NESTED_URL_RE))
    add(ctx, decodeNested(match[0]), "source", 0.05);
}

function fromFrames(doc: Document, base: string, out: string[]): void {
  const found = doc.querySelectorAll("iframe[src], iframe[data-src]");
  for (const el of Array.from(found).slice(0, MAX_FRAMES)) {
    const raw = el.getAttribute("src") || el.getAttribute("data-src") || "";
    const url = absolute(raw, base);
    if (url && !out.includes(url)) out.push(url);
  }
}

function collect(doc: Document, text: string, ctx: Ctx, frames: string[]): void {
  fromElements(doc, ctx);
  fromMeta(doc, ctx);
  fromStructured(doc, ctx);
  fromScripts(doc, ctx);
  fromSweep(text, ctx);
  fromFrames(doc, ctx.base, frames);
}

function rank(sink: Sink): StreamCandidate[] {
  return Array.from(sink.values())
    .map((entry) => ({
      url: entry.url,
      kind: entry.kind,
      confidence: clamp(entry.score + Math.min(entry.hits - 1, 3) * 0.02),
      via: entry.via,
      headers: entry.referer ? { Referer: entry.referer } : undefined,
    }))
    .sort((a, b) => b.confidence - a.confidence || a.url.localeCompare(b.url))
    .slice(0, MAX_CANDIDATES);
}

type PageBody = { status: number; type: string; body: string };

async function fetchPage(url: string, signal?: AbortSignal): Promise<PageBody | null> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, FETCH_TIMEOUT_MS);
  signal?.addEventListener("abort", abort);
  try {
    const res = await safeFetch(url, {
      signal: controller.signal,
      headers: { Accept: "text/html,application/xhtml+xml,*/*" },
    });
    const raw = await res.text();
    const type = res.headers.get("content-type") ?? "";
    return { status: res.status, type, body: raw.slice(0, MAX_HTML_CHARS) };
  } catch (e) {
    dwarn("[stream-resolver] fetch failed", url, e);
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

function mediaResponseKind(type: string, body: string): StreamKind | null {
  const lower = type.toLowerCase();
  if (lower.includes("mpegurl")) return "hls";
  if (lower.includes("dash+xml")) return "dash";
  if (lower.startsWith("video/")) return "file";
  const head = body.slice(0, 400).trimStart();
  if (head.startsWith("#EXTM3U")) return "hls";
  if (/^(?:<\?xml[^>]*>\s*)?<MPD\b/i.test(head)) return "dash";
  return null;
}

function parseDoc(html: string): Document | null {
  try {
    return new DOMParser().parseFromString(html, "text/html");
  } catch {
    return null;
  }
}

function titleOf(doc: Document | null, url: string): string {
  const og = doc?.querySelector('meta[property="og:title"]')?.getAttribute("content");
  const text = og?.trim() || doc?.querySelector("title")?.textContent?.trim();
  if (!text) return hostOf(url);
  return text.replace(/\s+/g, " ").slice(0, 140);
}

function posterOf(doc: Document | null, base: string): string {
  const raw =
    doc?.querySelector("video[poster]")?.getAttribute("poster") ||
    doc?.querySelector('meta[property="og:image"]')?.getAttribute("content") ||
    "";
  return raw ? (absolute(raw, base) ?? "") : "";
}

function fail(pageUrl: string, code: ResolveError, status = 0, title = ""): ResolveResult {
  const failure = { code, status };
  return { pageUrl, title: title || hostOf(pageUrl), poster: "", candidates: [], failure };
}

function single(pageUrl: string, kind: StreamKind): ResolveResult {
  const candidates: StreamCandidate[] = [{ url: pageUrl, kind, confidence: 0.95, via: "direct" }];
  return { pageUrl, title: fileNameOf(pageUrl), poster: "", candidates, failure: null };
}

async function followFrames(frames: string[], sink: Sink, signal?: AbortSignal): Promise<void> {
  for (const url of frames.slice(0, MAX_FOLLOW)) {
    const page = await fetchPage(url, signal);
    if (!page || !page.body.trim()) continue;
    const ctx: Ctx = { sink, base: url, referer: url, override: "frame" };
    const asMedia = mediaResponseKind(page.type, page.body);
    if (asMedia) {
      add(ctx, url, "frame", 0.2, asMedia);
      continue;
    }
    const doc = parseDoc(page.body);
    if (!doc) continue;
    collect(doc, page.body, ctx, []);
  }
}

export async function resolvePageStreams(
  raw: string,
  opts?: { signal?: AbortSignal },
): Promise<ResolveResult> {
  const pageUrl = normalizePageUrl(raw);
  if (!pageUrl) return fail(raw.trim(), "bad-url");

  const direct = kindOf(pageUrl);
  if (direct) return single(pageUrl, direct);

  const page = await fetchPage(pageUrl, opts?.signal);
  if (!page) return fail(pageUrl, "unreachable");
  if (!page.body.trim())
    return fail(pageUrl, page.status >= 400 ? "http-empty" : "empty", page.status);

  const asMedia = mediaResponseKind(page.type, page.body);
  if (asMedia) return single(pageUrl, asMedia);

  const doc = parseDoc(page.body);
  const title = titleOf(doc, pageUrl);
  const sink: Sink = new Map();
  const frames: string[] = [];
  if (doc) {
    const ctx: Ctx = { sink, base: pageUrl, referer: pageUrl, override: null };
    collect(doc, page.body, ctx, frames);
  }

  const hasManifest = Array.from(sink.values()).some((entry) => entry.kind !== "file");
  if (!hasManifest && frames.length > 0) await followFrames(frames, sink, opts?.signal);

  const candidates = rank(sink);
  if (candidates.length === 0)
    return fail(pageUrl, page.status >= 400 ? "http-no-media" : "no-media", page.status, title);

  return { pageUrl, title, poster: posterOf(doc, pageUrl), candidates, failure: null };
}
