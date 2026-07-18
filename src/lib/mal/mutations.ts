import { malRequest } from "./client";
import type { MalListStatus } from "./types";
import { kitsuToAnilist } from "@/lib/providers/anime-mapping";

export type SavedEntry = {
  status: MalListStatus;
  numEpisodesWatched: number;
};

export type ListEntryInfo = {
  numEpisodes: number | null;
  entry: { status: MalListStatus; numEpisodesWatched: number } | null;
};

type RawStatus = {
  status: string;
  score: number;
  num_episodes_watched: number;
  is_rewatching: boolean;
  updated_at: string;
};

function leadingInt(value: string): number | null {
  const n = Number(value.split(":")[0]);
  return Number.isFinite(n) ? n : null;
}

async function anilistToMal(anilistId: number): Promise<number | null> {
  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        query: "query ($id: Int) { Media(id: $id, type: ANIME) { idMal } }",
        variables: { id: anilistId },
      }),
    });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    return (json as { data?: { Media?: { idMal: number | null } } })?.data?.Media?.idMal ?? null;
  } catch {
    return null;
  }
}

export async function resolveMalMediaId(harborId: string): Promise<number | null> {
  if (harborId.startsWith("mal:")) return leadingInt(harborId.slice(4));
  if (harborId.startsWith("anilist:")) {
    const id = leadingInt(harborId.slice(8));
    return id != null ? anilistToMal(id) : null;
  }
  if (harborId.startsWith("kitsu:")) {
    const id = leadingInt(harborId.slice(6));
    if (id == null) return null;
    const anilistId = await kitsuToAnilist(id);
    return anilistId != null ? anilistToMal(anilistId) : null;
  }
  return null;
}

export async function fetchListEntry(malId: number): Promise<ListEntryInfo> {
  const data = await malRequest<{
    num_episodes: number | null;
    my_list_status: RawStatus | null;
  }>(`/anime/${malId}?fields=num_episodes,my_list_status`);
  return {
    numEpisodes: data.num_episodes ?? null,
    entry: data.my_list_status
      ? {
          status: data.my_list_status.status as MalListStatus,
          numEpisodesWatched: data.my_list_status.num_episodes_watched,
        }
      : null,
  };
}

export async function saveListEntry(input: {
  malId: number;
  status?: MalListStatus;
  numEpisodesWatched?: number;
}): Promise<SavedEntry> {
  const params = new URLSearchParams();
  if (input.status) params.set("status", input.status);
  if (input.numEpisodesWatched != null)
    params.set("num_watched_episodes", String(input.numEpisodesWatched));
  const data = await malRequest<RawStatus>(`/anime/${input.malId}/my_list_status`, {
    method: "PATCH",
    body: params,
  });
  return {
    status: data.status as MalListStatus,
    numEpisodesWatched: data.num_episodes_watched,
  };
}

export async function deleteListEntry(malId: number): Promise<boolean> {
  try {
    await malRequest(`/anime/${malId}/my_list_status`, { method: "DELETE" });
    return true;
  } catch {
    return false;
  }
}
