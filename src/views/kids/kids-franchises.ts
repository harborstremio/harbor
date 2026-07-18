import { type Meta } from "@/lib/cinemeta";
import {
  tmdbCollection,
  tmdbDiscover,
  tmdbKeywordIdByName,
  tmdbSearchCollectionId,
  tmdbSearchTitle,
} from "@/lib/providers/tmdb";

type ManualItem = { type: "movie" | "series"; query: string; year?: number };

export type Franchise = {
  key: string;
  name: string;
  grad: string;
  source:
    | { kind: "collection"; queries: string[] }
    | { kind: "keyword"; keyword: string }
    | { kind: "manual"; items: ManualItem[] };
  drop?: number;
};

export const KIDS_FRANCHISES: Franchise[] = [
  {
    key: "toy-story",
    name: "Toy Story",
    grad: "from-sky-400 via-sky-300 to-amber-300",
    source: { kind: "collection", queries: ["Toy Story Collection"] },
  },
  {
    key: "frozen",
    name: "Frozen",
    grad: "from-cyan-300 via-sky-300 to-indigo-400",
    source: { kind: "collection", queries: ["Frozen Collection"] },
  },
  {
    key: "minions",
    name: "Minions",
    grad: "from-yellow-300 via-amber-300 to-blue-500",
    source: { kind: "collection", queries: ["Despicable Me Collection", "Minions Collection"] },
  },
  {
    key: "shrek",
    name: "Shrek",
    grad: "from-lime-500 via-green-600 to-emerald-700",
    source: { kind: "collection", queries: ["Shrek Collection", "Puss in Boots Collection"] },
  },
  {
    key: "cars",
    name: "Cars",
    grad: "from-red-500 via-orange-500 to-amber-400",
    source: { kind: "collection", queries: ["Cars Collection"] },
  },
  {
    key: "httyd",
    name: "How to Train Your Dragon",
    grad: "from-teal-500 via-cyan-600 to-violet-600",
    source: { kind: "collection", queries: ["How to Train Your Dragon Collection"] },
  },
  {
    key: "kung-fu-panda",
    name: "Kung Fu Panda",
    grad: "from-emerald-500 via-green-600 to-amber-400",
    source: { kind: "collection", queries: ["Kung Fu Panda Collection"] },
  },
  {
    key: "incredibles",
    name: "The Incredibles",
    grad: "from-red-600 via-rose-500 to-orange-500",
    source: { kind: "collection", queries: ["The Incredibles Collection"] },
  },
  {
    key: "madagascar",
    name: "Madagascar",
    grad: "from-green-500 via-lime-500 to-amber-300",
    source: {
      kind: "collection",
      queries: ["Madagascar Collection", "Penguins of Madagascar Collection"],
    },
  },
  {
    key: "ice-age",
    name: "Ice Age",
    grad: "from-sky-300 via-cyan-300 to-blue-400",
    source: { kind: "collection", queries: ["Ice Age Collection"] },
  },
  {
    key: "sonic",
    name: "Sonic",
    grad: "from-blue-600 via-blue-500 to-sky-400",
    source: { kind: "collection", queries: ["Sonic the Hedgehog Collection"] },
  },
  {
    key: "hotel-t",
    name: "Hotel Transylvania",
    grad: "from-purple-700 via-violet-600 to-fuchsia-500",
    source: { kind: "collection", queries: ["Hotel Transylvania Collection"] },
    drop: 18,
  },
  {
    key: "pokemon",
    name: "Pokemon",
    grad: "from-red-500 via-rose-500 to-yellow-400",
    source: {
      kind: "manual",
      items: [
        { type: "series", query: "Pokémon", year: 1997 },
        { type: "series", query: "Pokémon Horizons: The Series", year: 2023 },
        { type: "series", query: "Pokémon Concierge", year: 2023 },
        { type: "movie", query: "Pokémon Detective Pikachu", year: 2019 },
        { type: "movie", query: "Pokémon: The First Movie", year: 1998 },
        { type: "movie", query: "Pokémon: The Movie 2000", year: 1999 },
        { type: "movie", query: "Pokémon 3: The Movie", year: 2000 },
        { type: "movie", query: "Pokémon 4Ever", year: 2001 },
        { type: "movie", query: "Pokémon Heroes", year: 2002 },
        { type: "movie", query: "Pokémon: Jirachi Wish Maker", year: 2003 },
        { type: "movie", query: "Pokémon: Destiny Deoxys", year: 2004 },
        { type: "movie", query: "Pokémon: Lucario and the Mystery of Mew", year: 2005 },
        { type: "movie", query: "Pokémon: The Rise of Darkrai", year: 2007 },
        { type: "movie", query: "Pokémon: Giratina and the Sky Warrior", year: 2008 },
        { type: "movie", query: "Pokémon: Arceus and the Jewel of Life", year: 2009 },
        { type: "movie", query: "Pokémon the Movie: White - Victini and Zekrom", year: 2011 },
        { type: "movie", query: "Pokémon the Movie: Kyurem vs. the Sword of Justice", year: 2012 },
        { type: "movie", query: "Pokémon the Movie: Genesect and the Legend Awakened", year: 2013 },
        {
          type: "movie",
          query: "Pokémon the Movie: Diancie and the Cocoon of Destruction",
          year: 2014,
        },
        { type: "movie", query: "Pokémon the Movie: Hoopa and the Clash of Ages", year: 2015 },
        { type: "movie", query: "Pokémon the Movie: I Choose You!", year: 2017 },
        { type: "movie", query: "Pokémon the Movie: The Power of Us", year: 2018 },
        { type: "movie", query: "Pokémon: Mewtwo Strikes Back - Evolution", year: 2019 },
        { type: "movie", query: "Pokémon: Secrets of the Jungle", year: 2020 },
      ],
    },
  },
  {
    key: "lego",
    name: "LEGO",
    grad: "from-red-500 via-amber-400 to-yellow-400",
    source: { kind: "keyword", keyword: "lego" },
  },
];

const KEYWORD_KID: Record<string, string> = {
  without_genres: "27,53",
  include_adult: "false",
};

export function franchiseFetcher(key: string, f: Franchise): (page: number) => Promise<Meta[]> {
  if (f.source.kind === "collection") {
    const queries = f.source.queries;
    return async (page) => {
      if (page > 1) return [];
      const ids = await Promise.all(
        queries.map((q) => tmdbSearchCollectionId(key, q).catch(() => null)),
      );
      const cols = await Promise.all(
        ids.map((id) => (id ? tmdbCollection(key, id).catch(() => null) : Promise.resolve(null))),
      );
      const seen = new Set<string>();
      const out: Meta[] = [];
      for (const col of cols) {
        for (const m of col?.parts ?? []) {
          if (seen.has(m.id)) continue;
          seen.add(m.id);
          out.push(m);
        }
      }
      out.sort((a, b) => (a.releaseDate ?? "zzz").localeCompare(b.releaseDate ?? "zzz"));
      return out;
    };
  }
  if (f.source.kind === "manual") {
    const items = f.source.items;
    return async (page) => {
      if (page > 1) return [];
      const found = await Promise.all(
        items.map((it) => tmdbSearchTitle(key, it.type, it.query, it.year).catch(() => null)),
      );
      const seen = new Set<string>();
      const out: Meta[] = [];
      for (const m of found) {
        if (!m || seen.has(m.id)) continue;
        seen.add(m.id);
        out.push(m);
      }
      out.sort((a, b) => (a.releaseDate ?? "zzz").localeCompare(b.releaseDate ?? "zzz"));
      return out;
    };
  }
  const keyword = f.source.keyword;
  return async (page) => {
    const p = String(Math.max(1, page));
    const id = await tmdbKeywordIdByName(key, keyword);
    const base = { sort_by: "popularity.desc", "vote_count.gte": "1", page: p, ...KEYWORD_KID };
    const [movies, tv] = await Promise.all([
      id
        ? tmdbDiscover(key, "movie", { with_keywords: String(id), ...base }).catch(
            () => [] as Meta[],
          )
        : Promise.resolve([] as Meta[]),
      id
        ? tmdbDiscover(key, "tv", { with_keywords: String(id), ...base }).catch(() => [] as Meta[])
        : Promise.resolve([] as Meta[]),
    ]);
    const seen = new Set<string>();
    const out: Meta[] = [];
    for (const m of [...movies, ...tv]) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      out.push(m);
    }
    return out;
  };
}
