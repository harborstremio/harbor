import { isOriginRelease } from './source-origin';
import type { GameSummary } from "./types";
import { normalizeMagnet } from "./magnet";
import { downloadFilename, downloadName } from "./transfers";
import { sourcePlatformMatches } from "./source-platform";
import { sourceDownloadTitle, sourceTitleKey } from "./source-title";
import { uniqueSourceFiles } from "./source-files";
import { sourceByteSize } from './source-byte-size';
import { validSourceHttpHost } from './source-host';

export const SOURCE_SCHEMA = "harbor.games.sources.v1";
export const SOURCE_METADATA_VERSION = 1;
export const SOURCE_MAX_BYTES = 64 * 1024 * 1024;
export const SOURCE_MAX_ENTRIES = 150_000;
export const SOURCE_MAX_SUBSCRIPTIONS = 128;
export const SOURCE_CATALOG_MAX_BYTES = 512 * 1024 * 1024;
export const SOURCE_STORE_MAX_BYTES = 2 * 1024 * 1024 * 1024;
export type SourceFile = { name: string; url: string; kind: "direct" | "page" | "magnet"; sizeBytes?: number; sha256?: string };
export type SourceRelease = { id: string; title: string; sourcePage?: string; steamId?: number; igdbId?: number; platform?: string; version?: string; date?: string; size?: string; kind: "game" | "patch" | "mod" | "extra"; files: SourceFile[] };
/** Ranking metadata only; download records are read from this immutable catalog row when selected. */
export type SourceRecentPreview = Pick<SourceRelease, 'id' | 'title' | 'steamId' | 'igdbId' | 'platform' | 'date' | 'kind'> & { row: number };
export type SourceWebsite = { kind: "wordpress"; api: string; site: string };
export type SourceManifest = { name: string; metadataVersion?: number; homepage?: string; icon?: string; format: "harbor" | "community" | "website"; website?: SourceWebsite; entries: SourceRelease[]; skipped: number };
/** A validated immutable disk snapshot; records are loaded only for the current query. */
export type SourceCatalogReference = { profile: string; version: string; parts: number; layout: { bytes: number; ends: number[] }; storedEnds: number[]; recent: SourceRecentPreview[]; recentAt: number; recentUntil: number };
/** Transient unreadable snapshot, retained verbatim on disk until refresh/removal. */
export type SourceCatalogIssue = { profile: string; version: string; parts: number; error: string };
export type GameSource = SourceManifest & { id: string; url: string; enabled: boolean; checkedAt: number; error?: string; catalog?: SourceCatalogReference; catalogIssue?: SourceCatalogIssue };
export const sourceEntryCount = (source: GameSource) => source.catalog ? source.catalog.storedEnds.at(-1) ?? 0 : source.entries.length;
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown, max = 500) => typeof value === "string" && value.trim().length <= max ? value.trim().replace(/[\u0000-\u001f\u007f]/g, " ") : "";
const positive = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined;

function normalizedUrl(value: unknown, magnet: boolean, preserveFragment: boolean): string | undefined {
  if (magnet && typeof value === "string" && /^magnet:/i.test(value.trim())) return normalizeMagnet(value.trim());
  if (typeof value !== "string" || value.length > 8192) return;
  try {
    const url = new URL(value);
    if (url.username || url.password) return;
    if (!["https:", "http:"].includes(url.protocol) || !validSourceHttpHost(url.hostname)) return;
    if (!preserveFragment) url.hash = "";
    return url.href;
  } catch { return; }
}
export function sourceUrl(value: unknown, magnet = false): string | undefined {
  return normalizedUrl(value, magnet, false);
}
export function sourceIconUrl(value: unknown, base?: string): string | undefined {
  if (typeof value !== "string" || !value || value.length > 8192 || /[\u0000-\u0020\u007f]/.test(value)) return;
  try { return sourceUrl(base ? new URL(value, base).href : value); } catch { return; }
}
// Release fragments can contain decryption keys or select a file inside a folder.
export function sourceFileUrl(value: unknown): string | undefined {
  return normalizedUrl(value, true, true);
}
export function sourceFilename(file: SourceFile): string {
  // A missing source name is rendered as its host, which is not a file name.
  return file.name !== new URL(file.url).hostname ? downloadName(file.name) : downloadFilename(file.url);
}
export function sourceWebsite(value: unknown): SourceWebsite | undefined {
  const item = record(value), api = sourceUrl(item.api), site = sourceUrl(item.site);
  return item.kind === "wordpress" && api && site ? { kind: "wordpress", api, site } : undefined;
}
function file(value: unknown): SourceFile | undefined {
  const item = record(value), url = sourceFileUrl(item.url);
  if (!url) return;
  const kind = url.startsWith("magnet:") ? "magnet" : item.kind === "direct" ? "direct" : "page";
  const name = text(item.name, 240) || (kind === "magnet" ? "BitTorrent" : new URL(url).hostname);
  if (item.sizeBytes !== undefined && !positive(item.sizeBytes)) return;
  if (item.sha256 !== undefined && (typeof item.sha256 !== "string" || !/^[a-f\d]{64}$/i.test(item.sha256))) return;
  return { name, url, kind, sizeBytes: positive(item.sizeBytes), sha256: typeof item.sha256 === "string" ? item.sha256.toLowerCase() : undefined };
}
/** Community feeds publish the release page as one inert anchor, separate from file hosts. */
function descriptionPage(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 8192) return;
  const anchor = value.match(/^\s*<a\s+([^<>]+)>[^<>]*<\/a>\s*$/i);
  const hrefs = anchor?.[1].matchAll(/(?:^|\s)href\s*=\s*(["'])(.*?)\1/gi);
  const links = hrefs ? [...hrefs] : [];
  if (links.length !== 1) return;
  return sourceUrl(links[0][2].replace(/&amp;|&#38;|&#x26;/gi, "&"));
}

export function sourceNeedsMetadataRefresh(source: GameSource): boolean {
  return source.enabled && source.format === "community" && (source.metadataVersion ?? 0) < SOURCE_METADATA_VERSION;
}

function release(value: unknown, community: boolean, index: number, stored: boolean): SourceRelease | undefined {
  const item = record(value), identity = stored ? item : record(item.game);
  const title = text(item.title), id = community ? `release-${index}` : text(item.id, 200);
  if (!title || !id) return;
  const candidates = community && Array.isArray(item.uris) ? item.uris.map(url => ({ url, kind: "page" })) : item.files;
  if (!Array.isArray(candidates) || candidates.length > 64) return;
  const files = uniqueSourceFiles(candidates.map(file).filter((f): f is SourceFile => !!f));
  if (!files.length) return;
  // Invalid identity must not fall back to a looser title match.
  if (!community && ((identity.steamId !== undefined && !positive(identity.steamId)) || (identity.igdbId !== undefined && !positive(identity.igdbId)))) return;
  const date = text(community ? item.uploadDate : item.date, 40);
  // Community classic-game catalogs declare platform on the entry; retain existing nested precedence.
  const platform = text(identity.platform, 100) || (community ? text(item.platform, 100) : "");
  return { id, title, sourcePage: community ? descriptionPage(item.descriptionHtml) : sourceUrl(item.sourcePage), steamId: community ? undefined : positive(identity.steamId), igdbId: community ? undefined : positive(identity.igdbId), platform: platform || undefined, version: text(item.version, 120) || undefined, date: date && Number.isFinite(Date.parse(date)) ? date : undefined, size: text(stored ? item.size : item.fileSize, 80) || undefined, kind: ["patch", "mod", "extra"].includes(String(item.kind)) ? item.kind as SourceRelease["kind"] : "game", files: [...new Map(files.map(f => [f.url, f])).values()] };
}
function sourceManifest(value: unknown, stored: boolean): SourceManifest {
  const root = record(value), name = text(root.name, 120);
  const community = !stored && root.schema === undefined && Array.isArray(root.downloads);
  if (!name || (!stored && !community && root.schema !== SOURCE_SCHEMA)) throw Error("source_format");
  const raw = stored ? root.entries : community ? root.downloads : root.items;
  if (!Array.isArray(raw)) throw Error("source_format");
  if (raw.length > SOURCE_MAX_ENTRIES) throw Error("source_limit");
  const entries: SourceRelease[] = [], ids = new Set<string>();
  for (let index = 0; index < raw.length; index++) {
    const item = release(raw[index], community, index, stored);
    if (!item || ids.has(item.id)) continue;
    entries.push(item); ids.add(item.id);
  }
  if (raw.length && !entries.length) throw Error("source_no_valid_entries");
  return { name, metadataVersion: SOURCE_METADATA_VERSION, homepage: sourceUrl(root.homepage), icon: sourceIconUrl(root.icon, sourceUrl(root.homepage)), format: community ? "community" : "harbor", entries, skipped: raw.length - entries.length };
}
export function parseSourceManifest(value: unknown): SourceManifest { return sourceManifest(value, false); }
/** Stored fields share every manifest check without allocating a second adapted catalog. */
export function parseStoredSourceManifest(value: unknown): SourceManifest { return sourceManifest(value, true); }
export function parseSourceText(value: string): SourceManifest {
  if (sourceByteSize(value, SOURCE_MAX_BYTES) > SOURCE_MAX_BYTES) throw Error("source_limit");
  let json: unknown;
  try { json = JSON.parse(value.replace(/^\uFEFF/, "")); } catch { throw Error("source_format"); }
  return parseSourceManifest(json);
}
const normalizedTitle = sourceTitleKey;
type SourceGameReference = Pick<GameSummary, "steamId" | "igdbId" | "name"> & Partial<Pick<GameSummary, "id" | "platforms" | "sourceOrigin">>;
export function sourceMatch(release: SourceRelease, game: SourceGameReference): "identity" | "title" | null {
  if (release.steamId && game.steamId && release.steamId !== game.steamId || release.igdbId && game.igdbId && release.igdbId !== game.igdbId) return null;
  if (release.steamId && release.steamId === game.steamId || release.igdbId && release.igdbId === game.igdbId) return "identity";
  if (release.steamId || release.igdbId) return null;
  if (!sourcePlatformMatches(release.platform, game)) return null;
  const name = normalizedTitle(game.name), title = normalizedTitle(release.title);
  if (name.length < 3) return name === title ? "title" : null;
  if (name === title) return "title";
  // Only release/version suffixes qualify; a sequel or similarly named game does not.
  const base = sourceDownloadTitle(release.title);
  return normalizedTitle(base) === name ? "title" : null;
}
export function matchingReleases(sources: GameSource[], game: SourceGameReference) {
  return sources.filter(s => s.enabled).flatMap(source => source.entries.flatMap(release => {
    const match = sourceMatch(release, game) ?? (isOriginRelease(source, release, game.sourceOrigin) ? 'title' as const : null);
    return match ? [{ source, release, match }] : [];
  })).sort((a, b) => Number(b.match === "identity") - Number(a.match === "identity") || (Date.parse(b.release.date || "") || 0) - (Date.parse(a.release.date || "") || 0));
}
export function sourceError(error: unknown) {
  const code = error instanceof Error ? error.message : String(error);
  if (code.includes("response size limit exceeded")) return "games.sources.source_limit";
  return `games.sources.${/^source_[a-z_]+$/.test(code) ? code : "source_network"}`;
}
export function sourceResponseError(status: number) {
  return status === 404 ? 'source_missing' : status === 403 ? 'source_blocked' : status === 451 ? 'source_restricted' : 'source_network';
}
