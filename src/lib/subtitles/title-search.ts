import { searchCinemeta } from "@/lib/search";
import { stripFranchiseSuffix } from "@/lib/providers/jikan";
import type { Meta } from "@/lib/cinemeta";

export type TitleCandidate = {
  imdbId: string;
  type: "movie" | "series";
  name: string;
  year?: string;
  poster?: string;
};

export type ParsedQuery = {
  title: string;
  year?: string;
  season?: number;
  episode?: number;
};

const EP_SXE = /\bS(\d{1,2})\s*[.\s-]?\s*E(\d{1,3})\b/i;
const EP_XFORM = /\b(\d{1,2})x(\d{1,3})\b/i;
const YEAR_RX = /\(?\b(19\d{2}|20\d{2})\b\)?/;

export function parseTitleQuery(raw: string): ParsedQuery {
  let s = ` ${raw.trim()} `;
  let season: number | undefined;
  let episode: number | undefined;
  const mSxe = s.match(EP_SXE);
  const mX = s.match(EP_XFORM);
  if (mSxe) {
    season = Number(mSxe[1]);
    episode = Number(mSxe[2]);
    s = s.replace(EP_SXE, " ");
  } else if (mX) {
    season = Number(mX[1]);
    episode = Number(mX[2]);
    s = s.replace(EP_XFORM, " ");
  }
  let year: string | undefined;
  const y = s.match(YEAR_RX);
  if (y) {
    year = y[1];
    s = s.replace(YEAR_RX, " ");
  }
  const title = s
    .replace(/[()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { title, year, season, episode };
}

function metaYear(m: Meta): string | undefined {
  const info = m.releaseInfo ?? "";
  const match = info.match(/\d{4}/);
  return match ? match[0] : undefined;
}

function toCandidate(m: Meta): TitleCandidate | null {
  if (!m.id || !m.id.startsWith("tt")) return null;
  return {
    imdbId: m.id,
    type: m.type === "series" ? "series" : "movie",
    name: m.name,
    year: metaYear(m),
    poster: m.poster,
  };
}

const cache = new Map<string, TitleCandidate[]>();

export async function searchTitleCandidates(
  query: string,
  preferImdbId?: string | null,
): Promise<TitleCandidate[]> {
  const parsed = parseTitleQuery(query);
  const key = parsed.title.toLowerCase();
  if (key.length < 2) return [];
  const cached = cache.get(key);
  if (cached) return rankCandidates(cached, parsed, preferImdbId);
  // Franchise suffixes ("… World- Season 2 Part 2") pollute the catalog
  // search and can rank re-edits/side entries above the actual series.
  const { movies, series } = await searchCinemeta(
    stripFranchiseSuffix(parsed.title) || parsed.title,
  );
  const seen = new Set<string>();
  const list: TitleCandidate[] = [];
  for (const m of [...series, ...movies]) {
    const c = toCandidate(m);
    if (!c || seen.has(c.imdbId)) continue;
    seen.add(c.imdbId);
    list.push(c);
  }
  cache.set(key, list);
  return rankCandidates(list, parsed, preferImdbId);
}

function scoreCandidate(
  c: TitleCandidate,
  parsed: ParsedQuery,
  wantSeries: boolean,
  titleLc: string,
  preferImdbId?: string | null,
): number {
  let s = 0;
  // Prefer the playing entry on junk-title searches, but stay below the
  // name-match floor (+100) so an explicitly typed title still wins.
  if (preferImdbId && c.imdbId === preferImdbId) s += 90;
  const nameLc = c.name.toLowerCase();
  if (nameLc === titleLc) s += 100;
  else if (nameLc.startsWith(titleLc)) s += 50;
  else if (nameLc.includes(titleLc)) s += 20;
  if (wantSeries && c.type === "series") s += 40;
  if (!wantSeries && c.type === "movie") s += 10;
  if (parsed.year && c.year === parsed.year) s += 60;
  return s;
}

export function rankCandidates(
  list: TitleCandidate[],
  parsed: ParsedQuery,
  preferImdbId?: string | null,
): TitleCandidate[] {
  const wantSeries = parsed.season != null;
  const titleLc = parsed.title.toLowerCase();
  return [...list].sort(
    (a, b) =>
      scoreCandidate(b, parsed, wantSeries, titleLc, preferImdbId) -
      scoreCandidate(a, parsed, wantSeries, titleLc, preferImdbId),
  );
}

export function bestCandidate(
  list: TitleCandidate[],
  parsed: ParsedQuery,
  preferImdbId?: string | null,
): TitleCandidate | null {
  return rankCandidates(list, parsed, preferImdbId)[0] ?? null;
}
