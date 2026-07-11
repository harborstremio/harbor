import { safeFetch } from "@/lib/safe-fetch";

import type { ListItem } from "../types";
import { ListResolveError } from "../types";

type JikanAnime = {
  mal_id: number;
  title?: string;
  title_english?: string;
  type?: string;
  year?: number;
  aired?: { from?: string };
  images?: { webp?: { large_image_url?: string }; jpg?: { large_image_url?: string } };
};

type ListRow = { anime?: JikanAnime; node?: JikanAnime };

const SERIES_TYPES = new Set(["TV", "OVA", "ONA", "Special", "Music"]);

function poster(a: JikanAnime): string | undefined {
  return a.images?.webp?.large_image_url ?? a.images?.jpg?.large_image_url;
}

function toItem(a: JikanAnime): ListItem {
  const year = a.year ? String(a.year) : a.aired?.from ? a.aired.from.slice(0, 4) : undefined;
  return {
    id: `mal:${a.mal_id}`,
    type: a.type && !SERIES_TYPES.has(a.type) ? "movie" : "series",
    name: a.title_english || a.title || "",
    poster: poster(a),
    releaseInfo: year,
  };
}

async function fetchSingle(id: string): Promise<ListItem[]> {
  const res = await safeFetch(`https://api.jikan.moe/v4/anime/${id}`);
  if (res.status === 404) throw new ListResolveError("not-found", "mal");
  if (!res.ok) throw new ListResolveError("network", "mal");
  const json = (await res.json().catch(() => null)) as { data?: JikanAnime } | null;
  if (!json?.data) throw new ListResolveError("not-found", "mal");
  return [toItem(json.data)];
}

export async function resolveMal(ref: string): Promise<ListItem[]> {
  if (/^\d+$/.test(ref)) {
    try {
      return await fetchSingle(ref);
    } catch (e) {
      if (e instanceof ListResolveError) throw e;
      throw new ListResolveError("network", "mal");
    }
  }
  let json: { data?: ListRow[] } | null;
  try {
    const res = await safeFetch(`https://api.jikan.moe/v4/users/${encodeURIComponent(ref)}/animelist?page=1`);
    if (res.status === 404) throw new ListResolveError("not-found", "mal");
    if (!res.ok) throw new ListResolveError("network", "mal");
    json = (await res.json().catch(() => null)) as { data?: ListRow[] } | null;
  } catch (e) {
    if (e instanceof ListResolveError) throw e;
    throw new ListResolveError("network", "mal");
  }
  const rows = json?.data ?? [];
  const items: ListItem[] = [];
  for (const row of rows) {
    const a = row.anime ?? row.node;
    if (a?.mal_id) items.push(toItem(a));
  }
  return items;
}
