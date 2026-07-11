import { simklRequest } from "./client";

export type SimklPremiere = {
  simklId: number;
  title: string;
  date: string;
  poster: string | null;
  isAnime: boolean;
};

export type SimklResolvedIds = {
  imdb?: string;
  tmdb?: number;
  mal?: number;
  kitsu?: number;
  anilist?: number;
};

type RawPremiere = { title?: string; date?: string; poster?: string; ids?: { simkl_id?: number } };
type RawSummary = {
  ids?: {
    imdb?: string;
    tmdb?: number | string;
    mal?: number | string;
    kitsu?: number | string;
    anilist?: number | string;
  };
};

function num(v: number | string | undefined): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function mapPremieres(raw: RawPremiere[], isAnime: boolean): SimklPremiere[] {
  const out: SimklPremiere[] = [];
  for (const r of raw) {
    const simklId = r.ids?.simkl_id;
    if (!simklId || !r.date) continue;
    out.push({
      simklId,
      title: r.title ?? "",
      date: r.date.slice(0, 10),
      poster: r.poster ? `https://simkl.in/posters/${r.poster}_m.jpg` : null,
      isAnime,
    });
  }
  return out;
}

export async function fetchSimklPremieres(year: number): Promise<SimklPremiere[]> {
  const list = (path: string) => simklRequest<RawPremiere[]>(path, { authed: false }).catch(() => [] as RawPremiere[]);
  const [tv, anime] = await Promise.all([list(`/tv/premieres/${year}`), list(`/anime/premieres/${year}`)]);
  return [...mapPremieres(tv, false), ...mapPremieres(anime, true)];
}

const idsCache = new Map<number, Promise<SimklResolvedIds | null>>();

export function resolveSimklIds(simklId: number, isAnime: boolean): Promise<SimklResolvedIds | null> {
  const cached = idsCache.get(simklId);
  if (cached) return cached;
  const kind = isAnime ? "anime" : "tv";
  const p = simklRequest<RawSummary>(`/${kind}/${simklId}?extended=full`, { authed: false })
    .then((s) => ({
      imdb: s.ids?.imdb,
      tmdb: num(s.ids?.tmdb),
      mal: num(s.ids?.mal),
      kitsu: num(s.ids?.kitsu),
      anilist: num(s.ids?.anilist),
    }))
    .catch(() => null);
  idsCache.set(simklId, p);
  return p;
}
