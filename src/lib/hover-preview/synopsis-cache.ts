import { lruSet } from "../cache";
import { meta as cinemetaMeta, narrowMediaType, type Meta, type MetaType } from "../cinemeta";
import { registerCache } from "../memory-profiler";

export type PreviewMeta = {
  description?: string;
  background?: string;
  runtime?: string;
  genres?: string[];
  releaseInfo?: string;
  seasonCount?: number;
};

const CAP = 200;
const TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { v: PreviewMeta | null; t: number }>();
const inflight = new Map<string, Promise<PreviewMeta | null>>();
let chain: Promise<unknown> = Promise.resolve();

registerCache("hover-preview:synopsis", () => cache.size);

function seasonsOf(full: Meta): number | undefined {
  if (full.type !== "series" || !full.videos?.length) return undefined;
  const seasons = new Set<number>();
  for (const v of full.videos) {
    if (typeof v.season === "number" && v.season >= 1) seasons.add(v.season);
  }
  return seasons.size || undefined;
}

function prune(full: Meta): PreviewMeta {
  return {
    description: full.description,
    background: full.background,
    runtime: full.runtime,
    genres: full.genres?.slice(0, 3),
    releaseInfo: full.releaseInfo,
    seasonCount: seasonsOf(full),
  };
}

export function previewMetaCached(id: string): PreviewMeta | null | undefined {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.t < TTL_MS) return hit.v;
  return undefined;
}

export function previewMeta(type: MetaType | undefined, id: string): Promise<PreviewMeta | null> {
  if (!id.startsWith("tt")) return Promise.resolve(null);
  const hit = previewMetaCached(id);
  if (hit !== undefined) return Promise.resolve(hit);
  const existing = inflight.get(id);
  if (existing) return existing;
  const p = chain
    .then(() => cinemetaMeta(narrowMediaType(type), id))
    .then((full) => {
      const v = full ? prune(full) : null;
      lruSet(cache, id, { v, t: Date.now() }, CAP);
      return v;
    })
    .catch(() => null)
    .finally(() => inflight.delete(id));
  chain = p;
  inflight.set(id, p);
  return p;
}
