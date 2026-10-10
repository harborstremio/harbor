import { assertSafeUrl } from "@/lib/manga/plugins/host-http";
import { sameSiteHost } from "@/lib/same-site-host";
import { infoHashFromSources, parseMagnet } from "@/lib/torrent/magnet";
import type { Stream, StreamSubtitle } from "../types";
import type { BridgeLinkSet } from "./extension/bridge";
import type { PluginStream, StreamPluginRequest } from "./types";

const MAX_STREAMS = 150;
const MAX_TEXT = 400;
const HEADER_DENY = new Set([
  "host",
  "content-length",
  "connection",
  "transfer-encoding",
  "keep-alive",
  "te",
  "upgrade",
]);
const MAX_HEADERS = 24;
const STOP_WORDS = new Set(["the", "and", "of", "a", "an", "to", "in", "on", "for", "vs", "with"]);

export type AdapterContext = {
  req: StreamPluginRequest;
  addonId: string;
  addonName: string;
  addonUrl: string;
  pluginName: string;
  trustHeaders?: boolean;
};

function clean(v: unknown, max = MAX_TEXT): string | undefined {
  if (v == null) return undefined;
  const s = String(v)
    // eslint-disable-next-line no-control-regex -- Strip protocol control characters from plugin text.
    .replace(/[\x00-\x1f\x7f]/g, "")
    .trim();
  if (!s || s.includes("[object")) return undefined;
  return s.slice(0, max);
}

function safeHttp(url: unknown): string | undefined {
  const s = clean(url, 4000);
  if (!s || !/^https?:\/\//i.test(s)) return undefined;
  try {
    return assertSafeUrl(s);
  } catch {
    return undefined;
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function headerName(key: string): string {
  return key.replace(/(^|-)([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

function pickHeaders(
  raw: unknown,
  url: string | undefined,
  trust = false,
): Record<string, string> | null {
  if (!raw || typeof raw !== "object") return null;
  const out: Record<string, string> = {};
  const host = url ? hostOf(url) : "";
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = k.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(key) || HEADER_DENY.has(key) || key.startsWith("x-harbor")) continue;
    // eslint-disable-next-line no-control-regex -- Header values must not retain CR, LF, NUL or DEL.
    const value = typeof v === "string" ? v.replace(/[\x00-\x1f\x7f]/g, "").trim() : "";
    if (!value || value.includes(",")) continue;
    if (!trust && (key === "referer" || key === "origin") && !sameSiteHost(hostOf(value), host))
      continue;
    out[headerName(key)] = value.slice(0, 2000);
    if (Object.keys(out).length >= MAX_HEADERS) break;
  }
  return Object.keys(out).length ? out : null;
}

export function parseSizeBytes(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return Math.round(v);
  if (typeof v !== "string") return undefined;
  const m = /([\d.,]+)\s*(tb|gb|mb|kb|b)\b/i.exec(v);
  if (!m) return undefined;
  const n = parseFloat(m[1].replace(",", "."));
  if (!Number.isFinite(n)) return undefined;
  const unit = m[2].toLowerCase();
  const mult =
    unit === "tb"
      ? 1024 ** 4
      : unit === "gb"
        ? 1024 ** 3
        : unit === "mb"
          ? 1024 ** 2
          : unit === "kb"
            ? 1024
            : 1;
  return Math.round(n * mult);
}

function titleTokens(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}

function mentionsTitle(haystack: string, title: string): boolean {
  const tokens = titleTokens(title);
  if (!tokens.length) return true;
  const hay = haystack.toLowerCase();
  const hits = tokens.filter((t) => hay.includes(t)).length;
  return hits >= Math.ceil(tokens.length * 0.6);
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function syntheticFilename(
  req: StreamPluginRequest,
  quality?: string,
  language?: string,
): string {
  const parts = [req.title.replace(/[/\\]/g, " ").trim()];
  if (req.type === "movie" && req.year) parts.push(`(${req.year})`);
  if (req.type === "series" && req.season != null && req.episode != null) {
    parts.push(`S${pad(req.season)}E${pad(req.episode)}`);
  } else if (req.type === "series" && req.absoluteEpisode != null) {
    parts.push(`E${pad(req.absoluteEpisode)}`);
  }
  if (quality) parts.push(quality);
  if (language) parts.push(language);
  return parts.join(" ");
}

function qualityToken(v: unknown): string | undefined {
  const s = clean(v, 40);
  if (!s) return undefined;
  const m = /(2160p|4k|1440p|1080p|720p|480p|360p)/i.exec(s);
  if (m) return m[1].toLowerCase() === "4k" ? "2160p" : m[1];
  if (/\b(hd|fhd|full\s*hd)\b/i.test(s)) return "1080p";
  return undefined;
}

function languageTokens(v: unknown): string | undefined {
  const list = Array.isArray(v) ? v : v == null ? [] : [v];
  const out = list.map((x) => clean(x, 24)).filter((x): x is string => !!x);
  return out.length ? out.slice(0, 4).join(" ") : undefined;
}

function subtitlesOf(raw: unknown): StreamSubtitle[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: StreamSubtitle[] = [];
  for (const s of raw.slice(0, 40)) {
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    const url = safeHttp(o.url);
    if (!url) continue;
    const lang = clean(o.lang ?? o.language, 24);
    out.push({ url, lang, id: clean(o.id, 80) });
  }
  return out.length ? out : undefined;
}

function oneStream(item: unknown, ctx: AdapterContext): Stream | null {
  if (!item || typeof item !== "object") return null;
  const o = item as PluginStream & Record<string, unknown>;
  let url = safeHttp(o.url);
  let infoHash =
    typeof o.infoHash === "string" && /^[0-9a-f]{40}$/i.test(o.infoHash)
      ? o.infoHash.toLowerCase()
      : undefined;
  const fileIdx =
    typeof o.fileIdx === "number" && Number.isInteger(o.fileIdx) && o.fileIdx >= 0
      ? o.fileIdx
      : undefined;
  const rawUrl = typeof o.url === "string" ? o.url.trim() : "";
  let magnetSources: string[] = [];
  if (!url && /^magnet:/i.test(rawUrl)) {
    const parsed = parseMagnet(rawUrl);
    if (parsed) {
      infoHash = parsed.infoHash;
      magnetSources = parsed.trackers.map((tr) => `tracker:${tr}`);
    }
  }
  const listed = Array.isArray(o.sources)
    ? o.sources.filter((s): s is string => typeof s === "string" && s.length < 500)
    : [];
  const sources = [...listed, ...magnetSources].slice(0, 40);
  if (!infoHash && sources.length) infoHash = infoHashFromSources(sources) ?? undefined;
  if (infoHash && !sources.some((s) => s.startsWith("dht:"))) sources.push(`dht:${infoHash}`);
  const externalUrl = safeHttp(o.externalUrl);
  const ytId = clean(o.ytId, 20);
  if (!url && !infoHash && !externalUrl && !ytId) return null;
  if (url && infoHash) url = undefined;

  const quality = qualityToken(o.quality);
  const language = languageTokens(o.language);
  const provider = clean(o.provider, 80);
  const name = clean(o.name, 120) ?? provider ?? ctx.pluginName;
  const title = clean(o.title, MAX_TEXT) ?? clean(o.filename, MAX_TEXT) ?? name;
  const description = clean(o.description, MAX_TEXT);
  const filename = clean(o.filename, 300);
  const size = parseSizeBytes(o.size);
  const seeders =
    typeof o.seeders === "number" && Number.isFinite(o.seeders)
      ? Math.max(0, Math.round(o.seeders))
      : undefined;
  const headers = pickHeaders(o.headers, url, ctx.trustHeaders === true);
  const bingeGroup = clean(o.bingeGroup, 120);
  const expiresAt =
    typeof o.expiresAt === "number" && Number.isFinite(o.expiresAt) ? o.expiresAt : undefined;

  const haystack = `${name} ${title} ${filename ?? ""} ${description ?? ""}`;
  const line =
    filename && mentionsTitle(filename, ctx.req.title)
      ? filename
      : mentionsTitle(haystack, ctx.req.title) &&
          /\b(19|20)\d{2}\b|\bS\d{1,2}E\d{1,3}\b|\d{3,4}p/i.test(haystack)
        ? undefined
        : syntheticFilename(ctx.req, quality, language);

  const sizeText = size ? ` ${(size / 1024 ** 3).toFixed(2)} GB` : "";
  const extraLine = [quality, language, provider].filter(Boolean).join(" ");
  const descriptionLine = description ?? (extraLine ? `${extraLine}${sizeText}`.trim() : undefined);

  const behaviorHints: NonNullable<Stream["behaviorHints"]> = {};
  if (line ?? filename) behaviorHints.filename = line ?? filename;
  if (size) behaviorHints.videoSize = size;
  if (bingeGroup) behaviorHints.bingeGroup = bingeGroup;
  if (headers) {
    behaviorHints.proxyHeaders = { request: headers };
    behaviorHints.notWebReady = true;
  }
  if (expiresAt) behaviorHints.pluginExpiresAt = expiresAt;

  const stream: Stream = {
    name,
    title,
    description: descriptionLine,
    url,
    infoHash,
    fileIdx,
    sources: sources.length ? sources : undefined,
    externalUrl,
    ytId,
    subtitles: subtitlesOf(o.subtitles),
    behaviorHints,
    addonId: ctx.addonId,
    addonName: ctx.addonName,
    addonUrl: ctx.addonUrl,
  };
  if (seeders != null) stream.title = `${stream.title}\n👤 ${seeders}`;
  return stream;
}

export function toStreams(raw: unknown, ctx: AdapterContext): Stream[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { streams?: unknown }).streams)
      ? (raw as { streams: unknown[] }).streams
      : [];
  const out: Stream[] = [];
  for (const item of list) {
    if (out.length >= MAX_STREAMS) break;
    const s = oneStream(item, ctx);
    if (s) out.push(s);
  }
  return out;
}

function qualityLabel(value: unknown): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  return `${Math.round(value)}p`;
}

function withReferer(link: { headers?: Record<string, string>; referer?: string }) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(link.headers ?? {})) {
    if (typeof v === "string") out[k] = v;
  }
  const hasReferer = Object.keys(out).some((k) => k.toLowerCase() === "referer");
  if (!hasReferer && link.referer) out.Referer = link.referer;
  return Object.keys(out).length ? out : undefined;
}

export function extensionPluginStreams(
  set: BridgeLinkSet,
  label: { media: string; track: string; group: string },
): PluginStream[] {
  const subtitles = (set.subtitles ?? [])
    .filter((s) => s && typeof s.url === "string" && s.url.length > 0)
    .slice(0, 40)
    .map((s) => ({ url: s.url, lang: clean(s.lang, 24) }));
  const title = [clean(label.media, MAX_TEXT), clean(label.track, 40)].filter(Boolean).join(" ");
  const out: PluginStream[] = [];
  for (const link of set.links ?? []) {
    if (!link || typeof link.url !== "string" || !link.url) continue;
    const quality = qualityLabel(link.quality);
    out.push({
      url: link.url,
      name: clean(link.name, 120) ?? clean(link.source, 120),
      title: title || undefined,
      provider: clean(link.source, 80),
      quality,
      headers: withReferer(link),
      subtitles: subtitles.length ? subtitles : undefined,
      bingeGroup: `${label.group}|${link.source}|${quality ?? link.type}`.slice(0, 120),
    });
  }
  return out;
}
