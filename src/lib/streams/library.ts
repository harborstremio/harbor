import { parse } from "parse-torrent-title";
import type { DebridResult, DebridSlug, DebridStore, LibraryEntry } from "@/lib/debrid/types";
import type { Stream } from "./types";

export type LibraryQuery = {
  type: "movie" | "series";
  imdbId: string;
  title: string;
  year?: number;
  season?: number;
  episode?: number;
};

/** One `listLibrary` sweep per provider, shared between the library-stream matcher
 *  and the cache cross-check so the provider is only asked once. */
export type LibraryListings = Promise<Array<PromiseSettledResult<DebridResult<LibraryEntry[]>>>>;

export async function fetchLibraryStreams(
  clients: DebridStore[],
  query: LibraryQuery,
  signal: AbortSignal,
  sharedListings?: LibraryListings,
): Promise<Stream[]> {
  if (clients.length === 0) return [];
  const settled = sharedListings
    ? await sharedListings
    : await Promise.allSettled(clients.map((c) => c.listLibrary(signal)));
  const out: Stream[] = [];
  for (let i = 0; i < clients.length; i++) {
    const r = settled[i];
    if (r.status !== "fulfilled" || !r.value.ok) continue;
    const slug = clients[i].slug;
    for (const entry of r.value.data) {
      if (!entry.hash) continue;
      const matched = matchEntry(entry, query);
      if (!matched) continue;
      out.push(buildLibraryStream(slug, entry, matched));
    }
  }
  return out;
}

function matchEntry(entry: LibraryEntry, query: LibraryQuery): MatchInfo | null {
  if (entry.files && entry.files.length > 0) {
    for (let idx = 0; idx < entry.files.length; idx++) {
      const f = entry.files[idx];
      const m = checkText(f.name, query, idx);
      if (m) return m;
    }
  }
  const nameMatch = checkText(entry.name, query, undefined);
  if (nameMatch) return nameMatch;
  return positionalMatch(entry, query);
}

const VIDEO_EXT_RE = /\.(mkv|mp4|avi|mov|m4v|webm|ts|flv|wmv|m2ts|mpg|mpeg|ogv|3gp)(\?|#|$)/i;
const NON_EPISODE_RE =
  /(?:^|[^a-z0-9])(?:ncop|nced|creditless|opening|ending|preview|trailer|extra|special|sample|menu|bonus|interview|making|scan|booklet|ost)(?:[^a-z0-9]|$)/i;

function titleMatchesEntry(entry: LibraryEntry, query: LibraryQuery): boolean {
  const a = normalize(query.title);
  if (a.length < 2) return false;
  const texts = [entry.name, ...(entry.files ?? []).map((f) => f.name)];
  return texts.some((t) => {
    const b = normalize(parse(t).title ?? t);
    return b.length >= 2 && (b.includes(a) || a.includes(b));
  });
}

function positionalMatch(entry: LibraryEntry, query: LibraryQuery): MatchInfo | null {
  if (query.type !== "series" || query.episode == null) return null;
  if (!entry.files || entry.files.length < 2) return null;
  if (!titleMatchesEntry(entry, query)) return null;
  const vids = entry.files
    .map((f, idx) => ({ name: f.name, idx }))
    .filter((f) => VIDEO_EXT_RE.test(f.name) && !NON_EPISODE_RE.test(f.name));
  if (vids.length < 2) return null;
  vids.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
  const pos = query.episode - 1;
  if (pos < 0 || pos >= vids.length) return null;
  const chosen = vids[pos];
  const p = parse(chosen.name);
  return { fileIdx: chosen.idx, parsedTitle: p.title ?? chosen.name, resolution: p.resolution, codec: p.codec };
}

function checkText(
  text: string,
  query: LibraryQuery,
  fileIdx: number | undefined,
): MatchInfo | null {
  const ptt = parse(text);
  if (
    query.type === "movie" &&
    query.year != null &&
    ptt.year != null &&
    Math.abs(ptt.year - query.year) > 1
  ) {
    return null;
  }
  if (query.season != null && ptt.season != null && ptt.season !== query.season) return null;
  if (query.episode != null && ptt.episode != null && ptt.episode !== query.episode) return null;
  if (query.type === "series" && (query.season != null || query.episode != null)) {
    if (ptt.season == null && ptt.episode == null) return null;
  }
  const a = normalize(query.title);
  const b = normalize(ptt.title ?? text);
  if (a.length < 2 || b.length < 2) return null;
  if (!b.includes(a) && !a.includes(b)) return null;
  return {
    fileIdx,
    parsedTitle: ptt.title ?? text,
    resolution: ptt.resolution,
    codec: ptt.codec,
  };
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\s\.\-_\(\)\[\]:;,!?'"‘’“”–—]+/g, "");
}

function buildLibraryStream(slug: DebridSlug, entry: LibraryEntry, m: MatchInfo): Stream {
  const filename = entry.files?.[m.fileIdx ?? 0]?.name ?? entry.name;
  const cacheTag = `[${slug.toUpperCase()}+]`;
  return {
    name: filename,
    title: `${cacheTag} ${displayName(slug)} Library`,
    infoHash: entry.hash,
    fileIdx: m.fileIdx,
    addonId: `${slug}-library`,
    addonName: `${displayName(slug)} Library`,
  };
}

function displayName(slug: DebridSlug): string {
  if (slug === "rd") return "Real-Debrid";
  if (slug === "tb") return "TorBox";
  if (slug === "ad") return "AllDebrid";
  if (slug === "pm") return "Premiumize";
  return "Debrid-Link";
}

type MatchInfo = {
  fileIdx: number | undefined;
  parsedTitle: string;
  resolution?: string;
  codec?: string;
};
