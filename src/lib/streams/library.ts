import { parse } from "parse-torrent-title";
import type { DebridSlug, DebridStore, LibraryEntry } from "@/lib/debrid/types";
import { withTimeout } from "@/lib/progressive-rows";
import type { Stream } from "./types";

const LIBRARY_SEARCH_TIMEOUT_MS = 15_000;

export type LibraryQuery = {
  type: "movie" | "series";
  imdbId: string;
  title: string;
  year?: number;
  season?: number;
  episode?: number;
};

export async function fetchLibraryStreams(
  clients: DebridStore[],
  query: LibraryQuery,
  signal: AbortSignal,
): Promise<Stream[]> {
  if (clients.length === 0) return [];
  const settled = await Promise.allSettled(
    clients.map((client) => withTimeout(client.listLibrary(signal), LIBRARY_SEARCH_TIMEOUT_MS)),
  );
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
  return checkText(entry.name, query, undefined);
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
    .replace(/[\s.\-_(\)[\]:;,!?'"‘’“”–—]+/g, "");
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
