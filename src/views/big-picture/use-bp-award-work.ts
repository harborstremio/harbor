import { get } from "@/lib/providers/tmdb/tmdb-client";

export type BpAwardHit = { id: number; type: "movie" | "tv" };

type RawResult = {
  id?: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
};

function normTitle(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function searchType(
  key: string,
  title: string,
  type: "movie" | "tv",
): Promise<Array<{ id: number; title: string; year: number | null }>> {
  const data = await get<{ results?: RawResult[] }>(key, `search/${type}`, {
    query: title,
    include_adult: "false",
  });
  return (data?.results ?? [])
    .map((r) => ({
      id: Number(r.id),
      title: r.title ?? r.name ?? "",
      year: Number((r.release_date ?? r.first_air_date ?? "").slice(0, 4)) || null,
    }))
    .filter((r) => Number.isFinite(r.id) && r.id > 0);
}

// Bundled history rows carry no imdb id for older ceremonies, so the work has to
// be scored back out of TMDB by title, year proximity and the category's medium.
export async function resolveBpAwardWork(
  key: string,
  title: string,
  year: number,
  preferTv: boolean,
): Promise<BpAwardHit | null> {
  const [movies, tvs] = await Promise.all([
    searchType(key, title, "movie"),
    searchType(key, title, "tv"),
  ]);
  const want = normTitle(title);
  const candidates = [
    ...tvs.map((r) => ({ ...r, type: "tv" as const })),
    ...movies.map((r) => ({ ...r, type: "movie" as const })),
  ];

  let best: (typeof candidates)[number] | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    const nt = normTitle(c.title);
    if (!nt) continue;
    let score = 0;
    if (nt === want) score += 100;
    else if (nt.includes(want) || want.includes(nt)) score += 45;
    else continue;
    if (c.year != null) score += Math.max(0, 18 - Math.abs(c.year - year) * 3);
    if (preferTv ? c.type === "tv" : c.type === "movie") score += 25;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best ? { id: best.id, type: best.type } : null;
}
