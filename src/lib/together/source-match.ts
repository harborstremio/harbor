import type { ScoredStream } from "@/lib/streams/types";

import type { SourceDescriptor } from "./protocol";
import { normalizeResolution } from "./source-descriptor";

export const MATCH_SAME_FILE = 1000;
export const MATCH_CLOSE = 300;

function tokenize(s: string): Set<string> {
  const out = new Set<string>();
  for (const m of s.toLowerCase().matchAll(/[a-z0-9]+/g)) out.add(m[0]);
  return out;
}

export function scoreSourceMatch(c: ScoredStream, host: SourceDescriptor): number {
  let score = 0;
  if (host.infoHash && c.infoHash && c.infoHash.toLowerCase() === host.infoHash) {
    score += 1000;
    if (host.fileIdx != null && c.fileIdx != null && c.fileIdx === host.fileIdx) score += 50;
  }
  const hostRes = normalizeResolution(host.resolution);
  const candRes = normalizeResolution(c.resolution);
  if (hostRes && candRes && hostRes === candRes) score += 200;
  if (host.sizeBytes && host.sizeBytes > 0 && c.size && c.size > 0) {
    const drift = Math.abs(c.size - host.sizeBytes) / (host.sizeBytes * 0.35);
    score += 150 * Math.max(0, 1 - drift);
  }
  if (host.title) {
    const ht = tokenize(host.title);
    const ct = tokenize(c.parsedTitle || c.title || "");
    if (ht.size > 0 && ct.size > 0) {
      let shared = 0;
      for (const t of ct) if (ht.has(t)) shared += 1;
      const union = ht.size + ct.size - shared;
      if (union > 0) score += 120 * (shared / union);
    }
    const group = (c.releaseGroupNormalized || c.releaseGroup || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (group && ht.has(group)) score += 40;
  }
  return score;
}

export function buildMatchScores(streams: ScoredStream[], host: SourceDescriptor): Map<ScoredStream, number> {
  const m = new Map<ScoredStream, number>();
  for (const s of streams) m.set(s, scoreSourceMatch(s, host));
  return m;
}

export function sortByHostMatch(
  streams: ScoredStream[],
  host: SourceDescriptor,
): { sorted: ScoredStream[]; scores: Map<ScoredStream, number> } {
  const scores = buildMatchScores(streams, host);
  const sorted = streams.slice().sort((a, b) => (scores.get(b) ?? 0) - (scores.get(a) ?? 0));
  return { sorted, scores };
}

export function matchBadge(score: number | undefined): "same" | "close" | null {
  if (score == null) return null;
  if (score >= MATCH_SAME_FILE) return "same";
  if (score >= MATCH_CLOSE) return "close";
  return null;
}
