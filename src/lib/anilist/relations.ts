import { kitsuToAnilist } from "@/lib/providers/anime-mapping";

import { anilistRequest } from "./client";

const RELATIONS_QUERY = `query ($id: Int) {
  Media(id: $id, type: ANIME) {
    relations {
      edges {
        relationType(version: 2)
        node {
          id
          format
          episodes
          status
          averageScore
          seasonYear
          title { english romaji userPreferred }
          coverImage { large }
          bannerImage
          startDate { year month day }
        }
      }
    }
  }
}`;

const FRANCHISE_RELATIONS = new Set(["SEQUEL", "PREQUEL", "PARENT", "SIDE_STORY"]);
const MAX_DEPTH = 6;
const MAX_NODES = 40;

type RawNode = {
  id: number;
  format: string | null;
  episodes: number | null;
  status: string | null;
  averageScore: number | null;
  seasonYear: number | null;
  title: { english: string | null; romaji: string | null; userPreferred: string | null };
  coverImage: { large: string | null } | null;
  bannerImage: string | null;
  startDate: { year: number | null; month: number | null; day: number | null } | null;
};
type RawEdge = { relationType: string | null; node: RawNode | null };
type RelationsResponse = { Media: { relations: { edges: RawEdge[] } | null } | null };

export type AnilistFranchiseNode = {
  id: number;
  name: string;
  type: "movie" | "series";
  poster?: string;
  banner?: string;
  episodes?: number;
  year?: number;
  startDate?: string;
  rating?: string;
  upcoming: boolean;
};

const edgeCache = new Map<number, RawEdge[]>();

async function fetchEdges(anilistId: number): Promise<RawEdge[]> {
  const cached = edgeCache.get(anilistId);
  if (cached) return cached;
  try {
    const data = await anilistRequest<RelationsResponse>(RELATIONS_QUERY, { id: anilistId }, undefined, true);
    const edges = data?.Media?.relations?.edges ?? [];
    edgeCache.set(anilistId, edges);
    return edges;
  } catch {
    edgeCache.set(anilistId, []);
    return [];
  }
}

function fmtDate(d: RawNode["startDate"]): string | undefined {
  if (!d?.year) return undefined;
  const mm = String(d.month ?? 1).padStart(2, "0");
  const dd = String(d.day ?? 1).padStart(2, "0");
  return `${d.year}-${mm}-${dd}`;
}

function toNode(n: RawNode): AnilistFranchiseNode {
  return {
    id: n.id,
    name: (n.title.english ?? n.title.romaji ?? n.title.userPreferred ?? "").trim(),
    type: n.format === "MOVIE" ? "movie" : "series",
    poster: n.coverImage?.large ?? undefined,
    banner: n.bannerImage ?? undefined,
    episodes: n.episodes ?? undefined,
    year: n.seasonYear ?? n.startDate?.year ?? undefined,
    startDate: fmtDate(n.startDate),
    rating: typeof n.averageScore === "number" && n.averageScore > 0 ? (n.averageScore / 10).toFixed(1) : undefined,
    upcoming: n.status === "NOT_YET_RELEASED",
  };
}

export async function anilistFranchise(kitsuId: number): Promise<AnilistFranchiseNode[]> {
  const root = await kitsuToAnilist(kitsuId).catch(() => null);
  if (!root) return [];
  const out = new Map<number, AnilistFranchiseNode>();
  const visited = new Set<number>([root]);
  let frontier: number[] = [root];
  let depth = 0;
  while (frontier.length > 0 && depth < MAX_DEPTH && out.size < MAX_NODES) {
    const batches = await Promise.all(frontier.map((id) => fetchEdges(id)));
    const next: number[] = [];
    for (const edges of batches) {
      for (const e of edges) {
        if (!e.relationType || !FRANCHISE_RELATIONS.has(e.relationType)) continue;
        const n = e.node;
        if (!n || n.id == null || visited.has(n.id)) continue;
        visited.add(n.id);
        const node = toNode(n);
        if (node.name) out.set(n.id, node);
        next.push(n.id);
      }
    }
    frontier = next;
    depth++;
  }
  return [...out.values()];
}
