import type { MangaSummary, MangaChapter, MangaTag } from "../model";

export type MangaPage = { url: string; headers?: Record<string, string> };

const BAD_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function clamp(s: string | undefined, max: number): string | undefined {
  if (s == null) return undefined;
  return s.length > max ? s.slice(0, max) : s;
}

function isSafeUrl(v: unknown): v is string {
  return typeof v === "string" && /^https?:\/\//i.test(v.trim());
}

function rec(v: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = Object.create(null);
  if (v && typeof v === "object") {
    for (const k of Object.keys(v as Record<string, unknown>)) {
      if (BAD_KEYS.has(k)) continue;
      out[k] = (v as Record<string, unknown>)[k];
    }
  }
  return out;
}

export function toSummary(v: unknown): MangaSummary | null {
  const o = rec(v);
  const id = clamp(str(o.id), 512);
  const title = clamp(str(o.title), 1024);
  if (!id || !title) return null;
  const cover = str(o.cover);
  const year = typeof o.year === "number" && isFinite(o.year) ? Math.trunc(o.year) : undefined;
  return {
    id,
    title,
    altTitle: clamp(str(o.altTitle), 1024),
    cover: isSafeUrl(cover) ? cover.trim() : undefined,
    year,
    status: clamp(str(o.status), 64),
    description: clamp(str(o.description), 8192),
    contentRating: clamp(str(o.contentRating), 64),
    lastChapter: clamp(str(o.lastChapter), 64),
    author: clamp(str(o.author), 256),
  };
}

export function toSummaries(v: unknown): MangaSummary[] {
  return arr(v)
    .map(toSummary)
    .filter((s): s is MangaSummary => s != null)
    .slice(0, 500);
}

export function toChapters(v: unknown): MangaChapter[] {
  const out: MangaChapter[] = [];
  for (const item of arr(v)) {
    if (out.length >= 5_000) break;
    const o = rec(item);
    const id = clamp(str(o.id), 512);
    if (!id) continue;
    const pages = typeof o.pages === "number" && o.pages >= 0 ? Math.trunc(o.pages) : 0;
    out.push({
      id,
      chapter: clamp(str(o.chapter), 64) ?? null,
      title: clamp(str(o.title), 512),
      volume: clamp(str(o.volume), 64) ?? null,
      pages,
      language: clamp(str(o.language), 32) || "en",
      group: clamp(str(o.group), 256),
      publishAt: clamp(str(o.publishAt), 64),
      downloaded: false,
    });
  }
  return out;
}

const ALLOWED_PAGE_HEADERS = new Set(["referer", "origin", "user-agent"]);
const HOST_BOUND_HEADERS = new Set(["referer", "origin"]);
function hasControlChar(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code < 32 || code === 127) return true;
  }
  return false;
}
const PAGE_HEADER_CAP = 6_000;

const pageHeaderStore = new Map<string, Record<string, string>>();

export function pageHeadersFor(url: string): Record<string, string> | undefined {
  return pageHeaderStore.get(url);
}

export function registerServerPageHeaders(url: string, headers: Record<string, string>): void {
  if (!isSafeUrl(url) || Object.keys(headers).length === 0) return;
  recordPageHeaders(url, headers);
}

function recordPageHeaders(url: string, headers: Record<string, string> | undefined): void {
  if (!headers) {
    pageHeaderStore.delete(url);
    return;
  }
  if (pageHeaderStore.size >= PAGE_HEADER_CAP && !pageHeaderStore.has(url)) {
    const oldest = pageHeaderStore.keys().next().value;
    if (oldest !== undefined) pageHeaderStore.delete(oldest);
  }
  pageHeaderStore.set(url, headers);
}

function hostOf(u: string): string | null {
  try {
    return new URL(u).host.toLowerCase();
  } catch {
    return null;
  }
}

function registrableDomain(host: string): string {
  const parts = host.split(".");
  return parts.length <= 2 ? host : parts.slice(-2).join(".");
}

function sameSite(a: string, b: string): boolean {
  return a === b || registrableDomain(a) === registrableDomain(b);
}

function sanitizePageHeaders(url: string, raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const targetHost = hostOf(url);
  if (!targetHost) return undefined;
  const out: Record<string, string> = {};
  for (const key of Object.keys(raw as Record<string, unknown>)) {
    if (BAD_KEYS.has(key)) continue;
    const low = key.toLowerCase();
    if (!ALLOWED_PAGE_HEADERS.has(low)) continue;
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value !== "string" || !value || hasControlChar(value)) continue;
    const clean = value.length > 2048 ? value.slice(0, 2048) : value;
    if (HOST_BOUND_HEADERS.has(low)) {
      const valueHost = hostOf(clean);
      if (!valueHost || !sameSite(valueHost, targetHost)) continue;
    }
    out[low] = clean;
  }
  return Object.keys(out).length ? out : undefined;
}

export function toPages(v: unknown): MangaPage[] {
  const out: MangaPage[] = [];
  for (const item of arr(v)) {
    if (out.length >= 2_000) break;
    let candidate: unknown;
    let rawHeaders: unknown;
    if (typeof item === "string") {
      candidate = item;
    } else if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      candidate = o.url ?? o.imageUrl ?? o.src ?? o.img ?? o.image;
      rawHeaders = o.headers;
    }
    const url = typeof candidate === "string" ? candidate.trim() : "";
    if (!isSafeUrl(url)) continue;
    const headers = sanitizePageHeaders(url, rawHeaders);
    recordPageHeaders(url, headers);
    out.push(headers ? { url, headers } : { url });
  }
  return out;
}

export function toStrings(v: unknown): string[] {
  return toPages(v).map((p) => p.url);
}

export function toTags(v: unknown): MangaTag[] {
  const out: MangaTag[] = [];
  for (const item of arr(v)) {
    if (out.length >= 1_000) break;
    const o = rec(item);
    const id = clamp(str(o.id), 128);
    const name = clamp(str(o.name), 128);
    if (!id || !name) continue;
    out.push({ id, name, group: clamp(str(o.group), 128) || "" });
  }
  return out;
}
