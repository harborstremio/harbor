import type { ScoredStream } from "@/lib/streams/types";
import { isP2pStream } from "@/lib/streams/cached";
import { qualityTier, sourceGroup } from "./quality-filter";

export type FacetDim = {
  key: string;
  label: string;
  valueOf: (s: ScoredStream) => string | null;
  order: string[];
};

function codecBucket(s: ScoredStream): string | null {
  if (s.codec === "HEVC") return "HEVC";
  if (s.codec === "AV1") return "AV1";
  if (s.codec === "AVC") return "AVC";
  return null;
}

function audioBucket(s: ScoredStream): string | null {
  switch (s.audio?.codec) {
    case "Atmos":
      return "Atmos";
    case "TrueHD":
      return "TrueHD";
    case "DTS-HD MA":
      return "DTS-HD";
    case "DTS":
      return "DTS";
    case "DD+":
      return "DD+";
    default:
      return null;
  }
}

function isCached(s: ScoredStream): boolean {
  return Object.values(s.cached ?? {}).some(Boolean);
}

export const FACET_DIMS: FacetDim[] = [
  {
    key: "resolution",
    label: "Resolution",
    valueOf: (s) => qualityTier(s),
    order: ["4K", "1080p", "720p", "SD"],
  },
  {
    key: "source",
    label: "Source",
    valueOf: (s) => sourceGroup(s),
    order: ["Remux", "BluRay", "WEB-DL", "WEBRip", "HDTV", "CAM"],
  },
  {
    key: "codec",
    label: "Codec",
    valueOf: codecBucket,
    order: ["HEVC", "AV1", "AVC"],
  },
  {
    key: "hdr",
    label: "HDR",
    valueOf: (s) => (s.hdrFormat ? "HDR" : "SDR"),
    order: ["HDR", "SDR"],
  },
  {
    key: "audio",
    label: "Audio",
    valueOf: audioBucket,
    order: ["Atmos", "TrueHD", "DTS-HD", "DTS", "DD+"],
  },
  {
    key: "cached",
    label: "Availability",
    valueOf: (s) => (isP2pStream(s) ? "P2P" : isCached(s) ? "Cached" : "Debrid"),
    order: ["Cached", "Debrid", "P2P"],
  },
];

export type FacetState = Record<string, string>;

export type FacetOption = { key: string; count: number };

export function facetOptions(streams: ScoredStream[], dim: FacetDim): FacetOption[] {
  const counts = new Map<string, number>();
  for (const s of streams) {
    const v = dim.valueOf(s);
    if (v == null) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return dim.order.filter((k) => counts.has(k)).map((k) => ({ key: k, count: counts.get(k) as number }));
}

export function matchesFacets(s: ScoredStream, active: FacetState, except?: string): boolean {
  for (const dim of FACET_DIMS) {
    if (dim.key === except) continue;
    const sel = active[dim.key];
    if (!sel || sel === "all") continue;
    if (dim.valueOf(s) !== sel) return false;
  }
  return true;
}
