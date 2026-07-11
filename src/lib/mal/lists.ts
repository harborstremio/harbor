import { malRequest } from "./client";
import type { MalListEntry, MalListGroup, MalListStatus } from "./types";

const CACHE_KEY = "harbor.mal.list.v1";
let memValue: MalListGroup[] | null = null;

type RawNode = {
  id: number;
  title: string;
  main_picture: { medium: string; large: string } | null;
  alternative_titles: { synonyms: string[]; en: string; ja: string } | null;
  num_episodes: number | null;
  mean: number | null;
  media_type: string | null;
  my_list_status: {
    status: string;
    score: number;
    num_episodes_watched: number;
    is_rewatching: boolean;
    updated_at: string;
  };
};

type RawEntry = { node: RawNode };
type ListResponse = { data: RawEntry[]; paging: { next?: string } | null };

function parseNode(n: RawNode): MalListEntry | null {
  if (!n.my_list_status) return null;
  return {
    status: n.my_list_status.status as MalListStatus,
    score: n.my_list_status.score,
    numEpisodesWatched: n.my_list_status.num_episodes_watched,
    isRewatching: n.my_list_status.is_rewatching,
    updatedAt: n.my_list_status.updated_at,
    anime: {
      id: n.id,
      title: n.title,
      mainPicture: n.main_picture?.large ?? n.main_picture?.medium ?? null,
      numEpisodes: n.num_episodes,
      mean: n.mean,
      mediaType: n.media_type ?? undefined,
    },
  };
}

export function readCachedMalList(): MalListGroup[] | null {
  if (memValue) return memValue;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MalListGroup[];
    if (!Array.isArray(parsed)) return null;
    memValue = parsed;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(groups: MalListGroup[]): void {
  memValue = groups;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(groups));
  } catch {}
}

export async function fetchMalList(): Promise<MalListGroup[]> {
  const all: MalListEntry[] = [];
  let cursor: string | null =
    `/users/@me/animelist?fields=my_list_status,num_episodes,mean,main_picture,alternative_titles,media_type&nsfw=true&limit=1000`;
  while (cursor) {
    const data: ListResponse = await malRequest(cursor);
    for (const entry of data.data) {
      const parsed = parseNode(entry.node);
      if (parsed) all.push(parsed);
    }
    cursor = data.paging?.next ?? null;
  }

  const byStatus = new Map<MalListStatus, MalListEntry[]>();
  const seen = new Set<number>();
  for (const entry of all) {
    if (seen.has(entry.anime.id)) continue;
    seen.add(entry.anime.id);
    const bucket = byStatus.get(entry.status) ?? [];
    bucket.push(entry);
    byStatus.set(entry.status, bucket);
  }

  const order: MalListStatus[] = ["watching", "completed", "on_hold", "dropped", "plan_to_watch"];
  const groups = order.filter((s) => byStatus.has(s)).map((status) => ({ status, entries: byStatus.get(status)! }));
  writeCache(groups);
  return groups;
}
