import type { Meta } from "@/lib/cinemeta";
import { anilistRequest } from "./client";
import { cleanShowName, dedupeAnimeFranchises } from "./franchise-dedupe";
import { anilistMediaToMeta } from "./to-meta";
import type { AnilistMedia } from "./types";

const REL_QUERY = `query ($ids: [Int]) {
  Page(perPage: 25) {
    media(id_in: $ids, type: ANIME) {
      id
      idMal
      format
      seasonYear
      title { english romaji userPreferred }
      coverImage { extraLarge large }
      relations { edges { relationType node { id type format } } }
    }
  }
}`;

const MAIN_FORMATS = new Set(["TV", "TV_SHORT", "ONA"]);
const SEQUEL_MARK = /\b(season|cour|part)\b|\b\d+(st|nd|rd|th)\b|\bfinal\b/i;

function needsRoot(m: AnilistMedia): boolean {
  if (m.format != null && !MAIN_FORMATS.has(m.format)) return true;
  return SEQUEL_MARK.test(m.title.romaji || m.title.english || m.title.userPreferred || "");
}

type RelNode = {
  id: number;
  idMal: number | null;
  format: string | null;
  seasonYear: number | null;
  title: { english: string | null; romaji: string | null; userPreferred: string | null };
  coverImage: { extraLarge: string | null; large: string | null } | null;
  relations: {
    edges: Array<{
      relationType: string | null;
      node: { id: number; type: string | null; format: string | null } | null;
    }>;
  };
};

const MAX_DEPTH = 6;

export type RootMedia = { id: number; idMal: number | null; name: string; poster?: string; format?: string };

function toRoot(m: RelNode): RootMedia {
  return {
    id: m.id,
    idMal: m.idMal,
    name: (m.title.english || m.title.userPreferred || m.title.romaji || "").trim(),
    poster: m.coverImage?.large ?? m.coverImage?.extraLarge ?? undefined,
    format: m.format ?? undefined,
  };
}

async function fetchBatch(ids: number[]): Promise<RelNode[]> {
  if (ids.length === 0) return [];
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += 25) chunks.push(ids.slice(i, i + 25));
  const results = await Promise.all(
    chunks.map((c) =>
      anilistRequest<{ Page: { media: RelNode[] } | null }>(REL_QUERY, { ids: c }, undefined, true)
        .then((d) => d?.Page?.media ?? [])
        .catch(() => []),
    ),
  );
  return results.flat();
}

export async function resolveFranchiseRoots(seeds: AnilistMedia[]): Promise<Map<number, RootMedia>> {
  const targets = seeds.filter(needsRoot);
  if (targets.length === 0) return new Map();
  const nodes = new Map<number, RelNode>();
  const prequel = new Map<number, number>();
  const visited = new Set<number>();
  let frontier = targets.map((s) => s.id);
  for (let d = 0; d < MAX_DEPTH && frontier.length > 0; d++) {
    const fresh = frontier.filter((id) => !visited.has(id));
    fresh.forEach((id) => visited.add(id));
    if (fresh.length === 0) break;
    const media = await fetchBatch(fresh);
    const next: number[] = [];
    for (const m of media) {
      nodes.set(m.id, m);
      const pre = (m.relations?.edges ?? [])
        .filter(
          (e) =>
            e.relationType === "PREQUEL" &&
            e.node?.type === "ANIME" &&
            e.node.format != null &&
            MAIN_FORMATS.has(e.node.format),
        )
        .map((e) => e.node!.id);
      if (pre.length > 0) {
        prequel.set(m.id, pre[0]);
        next.push(...pre);
      }
    }
    frontier = next;
  }
  const rootId = (id: number): number => {
    let cur = id;
    const seen = new Set<number>();
    while (prequel.has(cur) && !seen.has(cur)) {
      seen.add(cur);
      cur = prequel.get(cur)!;
    }
    return cur;
  };
  const out = new Map<number, RootMedia>();
  for (const s of targets) {
    const rn = nodes.get(rootId(s.id));
    if (rn) out.set(s.id, toRoot(rn));
  }
  return out;
}

export async function buildAnimeRowMetas(rawOrdered: AnilistMedia[]): Promise<Meta[]> {
  const out: Meta[] = [];
  const seen = new Set<string>();
  for (const m of dedupeAnimeFranchises(rawOrdered)) {
    const meta = anilistMediaToMeta(m);
    if (!meta || seen.has(meta.id)) continue;
    seen.add(meta.id);
    out.push({ ...meta, name: cleanShowName(meta.name) });
  }
  return out;
}

void resolveFranchiseRoots;
