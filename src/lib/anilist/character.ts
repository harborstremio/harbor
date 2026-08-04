import { anilistRequest } from "./client";

export type CharacterMediaRef = {
  anilistId: number;
  malId: number | null;
  type: "anime" | "manga";
  format: string | null;
  name: string;
  poster: string | null;
  background: string | null;
  year: string | null;
  score: number;
  overview: string;
  role: string | null;
};

export type CharacterHit = {
  id: number;
  name: string;
  native: string | null;
  image: string | null;
  anime: CharacterMediaRef[];
  manga: CharacterMediaRef[];
};

type RawTitle = { romaji: string | null; english: string | null } | null;
type RawNode = {
  id: number | null;
  idMal: number | null;
  type: "ANIME" | "MANGA" | null;
  format: string | null;
  title: RawTitle;
  coverImage: { extraLarge: string | null; large: string | null } | null;
  bannerImage?: string | null;
  startDate: { year: number | null } | null;
  averageScore: number | null;
  description: string | null;
  isAdult: boolean | null;
};
type RawCharName = {
  name: { full: string | null; native: string | null } | null;
  image: { large: string | null } | null;
};
type RawTitleMedia = RawNode & {
  characters: { nodes: RawCharName[] } | null;
  relations: { edges: Array<{ relationType: string | null; node: RawNode | null }> } | null;
};
type RawChar = RawCharName & { media: { edges: Array<{ node: RawNode | null }> } | null };
type Resp = { m: { media: RawTitleMedia[] } | null; c: { characters: RawChar[] } | null };

const NODE_FIELDS = `id idMal type format title { romaji english } coverImage { extraLarge large } startDate { year } averageScore description isAdult`;

const QUERY = `query ($q: String) {
  m: Page(perPage: 1) {
    media(search: $q, type: ANIME, sort: SEARCH_MATCH, isAdult: false) {
      ${NODE_FIELDS}
      bannerImage
      characters(role: MAIN, sort: FAVOURITES_DESC, perPage: 1) { nodes { name { full native } image { large } } }
      relations { edges { relationType node { ${NODE_FIELDS} } } }
    }
  }
  c: Page(perPage: 1) {
    characters(search: $q, sort: SEARCH_MATCH) {
      name { full native }
      image { large }
      media(sort: POPULARITY_DESC, perPage: 14) { edges { node { ${NODE_FIELDS} } } }
    }
  }
}`;

const ANIME_CANON = new Set(["TV", "TV_SHORT", "ONA"]);
const MANGA_CANON = new Set(["MANGA"]);
const TITLE_FORMATS = new Set(["TV", "TV_SHORT", "MOVIE"]);

function normTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function relate(a: string, b: string): boolean {
  const x = normTitle(a);
  const y = normTitle(b);
  if (!x || !y) return false;
  return x.includes(y) || y.includes(x);
}

function titleRelates(n: RawNode, q: string): boolean {
  return relate(n.title?.english ?? "", q) || relate(n.title?.romaji ?? "", q);
}

function toRef(n: RawNode | null, role: string | null): CharacterMediaRef | null {
  if (!n || n.id == null || n.isAdult) return null;
  const title = n.title?.english?.trim() || n.title?.romaji?.trim() || "";
  if (!title) return null;
  return {
    anilistId: n.id,
    malId: n.idMal ?? null,
    type: n.type === "MANGA" ? "manga" : "anime",
    format: n.format ?? null,
    name: title,
    poster: n.coverImage?.extraLarge ?? n.coverImage?.large ?? null,
    background: n.bannerImage ?? null,
    year: n.startDate?.year ? String(n.startDate.year) : null,
    score: n.averageScore ? n.averageScore / 10 : 0,
    overview: (n.description ?? "").replace(/<[^>]+>/g, "").trim(),
    role,
  };
}

function pick(refs: CharacterMediaRef[], canon: Set<string>, cap: number): CharacterMediaRef[] {
  const canonical = refs.filter((r) => canon.has(r.format ?? ""));
  const rest = refs.filter((r) => !canon.has(r.format ?? ""));
  const seen = new Set<string>();
  const out: CharacterMediaRef[] = [];
  for (const r of [...canonical, ...rest]) {
    const k = normTitle(r.name);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(r);
    if (out.length >= cap) break;
  }
  return out;
}

function charName(c: RawCharName): string {
  return c.name?.full?.trim() || c.name?.native?.trim() || "";
}

function fromTitle(m: RawTitleMedia): CharacterHit | null {
  const char = m.characters?.nodes?.[0];
  const name = char ? charName(char) : "";
  if (!name) return null;
  const relEdges = m.relations?.edges ?? [];
  const animeRefs = [
    toRef(m, "MAIN"),
    ...relEdges.filter((e) => e.node?.type === "ANIME").map((e) => toRef(e.node, null)),
  ];
  const mangaEdges = relEdges
    .filter((e) => e.node?.type === "MANGA")
    .sort(
      (a, b) => (a.relationType === "SOURCE" ? -1 : 0) - (b.relationType === "SOURCE" ? -1 : 0),
    );
  const mangaRefs = mangaEdges.map((e) => toRef(e.node, null));
  const anime = pick(
    animeRefs.filter((r): r is CharacterMediaRef => r != null),
    ANIME_CANON,
    3,
  );
  const manga = pick(
    mangaRefs.filter((r): r is CharacterMediaRef => r != null),
    MANGA_CANON,
    3,
  );
  if (anime.length + manga.length === 0) return null;
  return {
    id: m.id ?? 0,
    name,
    native: char?.name?.native?.trim() || null,
    image: char?.image?.large ?? null,
    anime,
    manga,
  };
}

function fromChar(c: RawChar): CharacterHit | null {
  const name = charName(c);
  if (!name) return null;
  const refs = (c.media?.edges ?? [])
    .map((e) => toRef(e.node, null))
    .filter((r): r is CharacterMediaRef => r != null);
  const anime = pick(
    refs.filter((r) => r.type === "anime"),
    ANIME_CANON,
    3,
  );
  const manga = pick(
    refs.filter((r) => r.type === "manga"),
    MANGA_CANON,
    3,
  );
  if (anime.length + manga.length === 0) return null;
  return {
    id: anime[0]?.anilistId ?? manga[0]?.anilistId ?? 0,
    name,
    native: c.name?.native?.trim() || null,
    image: c.image?.large ?? null,
    anime,
    manga,
  };
}

export async function anilistCharacterSearch(query: string): Promise<CharacterHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const data = await anilistRequest<Resp>(QUERY, { q }, undefined, true);
    const media = data?.m?.media?.[0] ?? null;
    const character = data?.c?.characters?.[0] ?? null;
    if (media && titleRelates(media, q) && TITLE_FORMATS.has(media.format ?? "")) {
      const byTitle = fromTitle(media);
      if (byTitle) return [byTitle];
    }
    if (character) {
      const byChar = fromChar(character);
      if (byChar) return [byChar];
    }
    return [];
  } catch {
    return [];
  }
}
