import { safeFetch } from "@/lib/safe-fetch";
import { kitsuToTvdb } from "./anime-mapping";
import type { CastEntry } from "./tmdb/tmdb-details";
import { HARBOR_TVDB_BASE } from "@/lib/config/endpoints";

const V4 = `${HARBOR_TVDB_BASE}/api/tvdb/v4`;

type TvdbCharacter = {
  name?: string | null;
  personName?: string | null;
  peopleId?: number | null;
  peopleType?: string | null;
  image?: string | null;
  personImgURL?: string | null;
  sort?: number | null;
};

const cache = new Map<string, CastEntry[]>();
const inflight = new Map<string, Promise<CastEntry[]>>();

function img(v: string | null | undefined): string | null {
  if (!v) return null;
  return v.startsWith("http")
    ? v
    : `https://artworks.thetvdb.com${v.startsWith("/") ? "" : "/"}${v}`;
}

type V4Result<T> = { ok: boolean; data: T | null };

// Collapsing every outcome to null made a transient network blip indistinguishable
// from "this title genuinely has no cast", and the caller then cached the empty
// result forever. ok=false means "we do not know", and must never be cached.
async function v4<T>(rel: string): Promise<V4Result<T>> {
  try {
    const res = await safeFetch(`${V4}${rel}`);
    if (!res.ok) return { ok: false, data: null };
    const j = (await res.json()) as { data?: T | null };
    return { ok: true, data: j?.data ?? null };
  } catch {
    return { ok: false, data: null };
  }
}

async function resolveIds(imdb: string): Promise<{ series: number | null; movie: number | null }> {
  const res = await v4<Array<{ series?: { id?: number } | null; movie?: { id?: number } | null }>>(
    `/search/remoteid/${imdb}`,
  );
  const out = { series: null as number | null, movie: null as number | null };
  for (const row of res.data ?? []) {
    const s = Number(row?.series?.id);
    const m = Number(row?.movie?.id);
    if (out.series == null && Number.isFinite(s)) out.series = s;
    if (out.movie == null && Number.isFinite(m)) out.movie = m;
  }
  return out;
}

function toCast(chars: TvdbCharacter[] | null | undefined): CastEntry[] {
  const actors = (chars ?? []).filter((c) => c.peopleType === "Actor" && c.personName);
  actors.sort((a, b) => (a.sort ?? 999) - (b.sort ?? 999));
  const seen = new Set<number | string>();
  const out: CastEntry[] = [];
  for (const c of actors) {
    const key = c.peopleId ?? c.personName!;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: c.peopleId ? -Math.abs(c.peopleId) : -1,
      name: c.personName!,
      character: c.name ?? "",
      profilePath: img(c.personImgURL) ?? img(c.image),
      order: out.length,
    });
    if (out.length >= 40) break;
  }
  return out;
}

export async function fetchTvdbCast(opts: {
  imdb?: string | null;
  kitsuId?: number | null;
  type: "movie" | "series";
}): Promise<CastEntry[]> {
  const key = `${opts.type}:${opts.imdb ?? ""}:${opts.kitsuId ?? ""}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const pending = inflight.get(key);
  if (pending) return pending;
  const p = (async () => {
    let seriesId: number | null = null;
    let movieId: number | null = null;
    if (opts.kitsuId != null) seriesId = await kitsuToTvdb(opts.kitsuId).catch(() => null);
    if (seriesId == null && opts.imdb && opts.imdb.startsWith("tt")) {
      const ids = await resolveIds(opts.imdb);
      seriesId = ids.series;
      movieId = ids.movie;
    }
    const prefer: Array<"movies" | "series"> =
      opts.type === "movie" ? ["movies", "series"] : ["series", "movies"];
    let anyFailed = false;
    for (const kind of prefer) {
      const id = kind === "movies" ? movieId : seriesId;
      if (id == null) continue;
      // "meta" is not a valid parameter here: the v4 spec allows only
      // [translations] for movies and [translations, episodes] for series, and
      // characters come back by default. TVDB tolerates the bogus value today,
      // but if it ever starts rejecting it every series loses cast silently.
      const res = await v4<{ characters?: TvdbCharacter[] }>(`/${kind}/${id}/extended`);
      if (!res.ok) {
        anyFailed = true;
        continue;
      }
      const cast = toCast(res.data?.characters);
      if (cast.length > 0) {
        cache.set(key, cast);
        return cast;
      }
    }
    // Only remember "no cast" when every source actually answered. Caching a
    // transient failure killed cast for that title for the rest of the session.
    if (!anyFailed) cache.set(key, []);
    return [];
  })().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, p);
  return p;
}
