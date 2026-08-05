import { getAnimeCwId } from "@/lib/anime-cw-ids";
import { registerCache } from "@/lib/memory-profiler";
import { externalToKitsu, imdbToKitsu } from "./anime-mapping";
import { kitsuRelated, parseKitsuId } from "./kitsu";

const MAX_WALK = 8;
const rootCache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

registerCache("anime:franchise-root", () => rootCache.size);

function extService(id: string): string | null {
  if (id.startsWith("mal:")) return "myanimelist";
  if (id.startsWith("anilist:")) return "anilist";
  if (id.startsWith("anidb:")) return "anidb";
  return null;
}

async function normalizeToKitsu(id: string): Promise<number | null> {
  const direct = parseKitsuId(id);
  if (direct != null) return direct;
  if (id.startsWith("tt")) {
    const mapped = parseKitsuId(getAnimeCwId(id) ?? "");
    if (mapped != null) return mapped;
    return imdbToKitsu(id).catch(() => null);
  }
  const service = extService(id);
  if (!service) return null;
  const n = Number(id.slice(id.indexOf(":") + 1));
  if (!Number.isFinite(n)) return null;
  return externalToKitsu(service, n).catch(() => null);
}

type Ancestor = { id: number; year: number; series: boolean };

async function walkUp(startKitsu: number): Promise<number[]> {
  const chain: number[] = [startKitsu];
  const visited = new Set<number>([startKitsu]);
  let current = startKitsu;
  for (let i = 0; i < MAX_WALK; i++) {
    const related = await kitsuRelated(current).catch(() => []);
    const ancestors: Ancestor[] = [];
    for (const r of related) {
      const role = r.role.toLowerCase();
      if (role !== "prequel") continue;
      const kid = parseKitsuId(r.meta.id);
      if (kid == null || visited.has(kid)) continue;
      ancestors.push({
        id: kid,
        year: parseInt(r.meta.releaseInfo ?? "", 10) || 9999,
        series: r.meta.type !== "movie",
      });
    }
    if (ancestors.length === 0) break;
    ancestors.sort((a, b) =>
      a.series !== b.series ? (a.series ? -1 : 1) : a.year !== b.year ? a.year - b.year : a.id - b.id,
    );
    current = ancestors[0].id;
    visited.add(current);
    chain.push(current);
  }
  return chain;
}

export async function franchiseRoot(id: string): Promise<string> {
  const cached = rootCache.get(id);
  if (cached) return cached;
  const existing = inflight.get(id);
  if (existing) return existing;
  const p = (async () => {
    const kitsuId = await normalizeToKitsu(id);
    if (kitsuId == null) {
      rootCache.set(id, id);
      return id;
    }
    const chain = await walkUp(kitsuId);
    const rootStr = `kitsu:${chain[chain.length - 1]}`;
    for (const node of chain) rootCache.set(`kitsu:${node}`, rootStr);
    rootCache.set(id, rootStr);
    rootCache.set(rootStr, rootStr);
    return rootStr;
  })().finally(() => {
    inflight.delete(id);
  });
  inflight.set(id, p);
  return p;
}

export function franchiseRootSync(id: string): string | null {
  return rootCache.get(id) ?? null;
}

export function prefetchFranchiseRoot(id: string): void {
  if (rootCache.has(id) || inflight.has(id)) return;
  void franchiseRoot(id).catch(() => {});
}
