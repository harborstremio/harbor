import { get } from "./tmdb-client";

export type StoryArc = {
  id: string;
  name: string;
  order: number;
  episodes: Array<{ season: number; episode: number }>;
};

type GroupsList = {
  results?: Array<{
    id: string;
    name: string;
    type: number;
    group_count: number;
    episode_count: number;
  }>;
};

type GroupDetail = {
  groups?: Array<{
    id: string;
    name: string;
    order: number;
    episodes?: Array<{ season_number: number; episode_number: number }>;
  }>;
};

const groupIdCache = new Map<number, { id: string; name: string } | null>();
const arcsCache = new Map<string, StoryArc[]>();

export async function tmdbEpisodeGroups(key: string, tvId: number): Promise<{ id: string; name: string } | null> {
  if (groupIdCache.has(tvId)) return groupIdCache.get(tvId) ?? null;
  const data = await get<GroupsList>(key, `tv/${tvId}/episode_groups`);
  const arcs = (data?.results ?? []).filter((r) => r.type === 5);
  const pick = arcs.sort((a, b) => (b.group_count ?? 0) - (a.group_count ?? 0))[0] ?? null;
  const out = pick ? { id: pick.id, name: pick.name } : null;
  groupIdCache.set(tvId, out);
  return out;
}

export async function tmdbEpisodeGroup(key: string, groupId: string): Promise<StoryArc[]> {
  const cached = arcsCache.get(groupId);
  if (cached) return cached;
  const data = await get<GroupDetail>(key, `tv/episode_group/${groupId}`);
  const arcs: StoryArc[] = (data?.groups ?? [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((g) => ({
      id: g.id,
      name: g.name,
      order: g.order ?? 0,
      episodes: (g.episodes ?? [])
        .map((e) => ({ season: e.season_number, episode: e.episode_number }))
        .filter((e) => Number.isInteger(e.season) && Number.isInteger(e.episode)),
    }))
    .filter((g) => g.episodes.length > 0);
  arcsCache.set(groupId, arcs);
  return arcs;
}
