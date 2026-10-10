import type { EBook } from "./api";

export type EBookUniverse = {
  id: string;
  name: string;
  query: string;
  aliases?: string[];
  artQuery?: string;
  accent: number;
  logo?: string;
  backdrop?: string;
  noLogo?: boolean;
};

export const EBOOK_UNIVERSES: EBookUniverse[] = [
  {
    id: "against-the-gods",
    name: "Against the Gods",
    query: "Against the Gods",
    aliases: ["Ni Tian Xie Shen", "ضد الآلهة"],
    artQuery: "Ni Tian Xie Shen",
    accent: 18,
  },
  {
    id: "reverend-insanity",
    name: "Reverend Insanity",
    query: "Reverend Insanity",
    aliases: ["Master of Gu", "Gu Daoist Master", "القس المجنون"],
    accent: 350,
  },
  {
    id: "lord-of-mysteries",
    name: "Lord of Mysteries",
    query: "Lord of Mysteries",
    aliases: ["Lord of the Mysteries", "لورد الغوامض"],
    accent: 275,
  },
  {
    id: "beginning-after-the-end",
    name: "The Beginning After the End",
    query: "The Beginning After the End",
    aliases: ["TBATE", "البداية بعد النهاية"],
    accent: 225,
  },
  {
    id: "omniscient-reader",
    name: "Omniscient Reader's Viewpoint",
    query: "Omniscient Reader's Viewpoint",
    aliases: ["Omniscient Reader", "ORV"],
    accent: 205,
  },
  {
    id: "solo-leveling",
    name: "Solo Leveling",
    query: "Solo Leveling",
    aliases: ["Only I Level Up", "I Alone Level Up"],
    accent: 260,
    backdrop:
      "https://s4.anilist.co/file/anilistcdn/media/anime/banner/151807-37yfQA3ym8PA.jpg",
    logo:
      "https://artworks.thetvdb.com/banners/v4/series/389597/clearlogo/6749c5054f0aa.png",
  },
  {
    id: "martial-peak",
    name: "Martial Peak",
    query: "Martial Peak",
    aliases: ["Wu Lian Dian Feng"],
    artQuery: "Wu Lian Dian Feng",
    accent: 30,
  },
  {
    id: "battle-through-the-heavens",
    name: "Battle Through the Heavens",
    query: "Battle Through the Heavens",
    aliases: ["Fights Break Sphere", "Dou Po Cang Qiong"],
    artQuery: "Dou Po Cang Qiong",
    accent: 12,
  },
  {
    id: "tales-of-demons-and-gods",
    name: "Tales of Demons and Gods",
    query: "Tales of Demons and Gods",
    aliases: ["Yao Shen Ji"],
    artQuery: "Yao Shen Ji",
    accent: 130,
  },
  {
    id: "coiling-dragon",
    name: "Coiling Dragon",
    query: "Coiling Dragon",
    aliases: ["Panlong"],
    artQuery: "Panlong",
    accent: 45,
  },
  {
    id: "i-shall-seal-the-heavens",
    name: "I Shall Seal the Heavens",
    query: "I Shall Seal the Heavens",
    aliases: ["Wo Yu Feng Tian"],
    artQuery: "Wo Yu Feng Tian",
    accent: 155,
  },
  {
    id: "renegade-immortal",
    name: "Renegade Immortal",
    query: "Renegade Immortal",
    aliases: ["Xian Ni"],
    artQuery: "Xian Ni",
    accent: 195,
  },
  {
    id: "a-will-eternal",
    name: "A Will Eternal",
    query: "A Will Eternal",
    aliases: ["Yi Nian Yong Heng"],
    artQuery: "Yi Nian Yong Heng",
    accent: 175,
  },
  {
    id: "legendary-mechanic",
    name: "The Legendary Mechanic",
    query: "The Legendary Mechanic",
    aliases: ["Transcendental Mechanic"],
    accent: 215,
  },
  {
    id: "release-that-witch",
    name: "Release That Witch",
    query: "Release That Witch",
    aliases: ["Fang Kai Na Ge Nu Wu"],
    accent: 325,
  },
  {
    id: "kings-avatar",
    name: "The King's Avatar",
    query: "The King's Avatar",
    aliases: ["Quan Zhi Gao Shou"],
    artQuery: "Quan Zhi Gao Shou",
    accent: 55,
  },
  {
    id: "overlord",
    name: "Overlord",
    query: "Overlord",
    accent: 285,
  },
  {
    id: "mushoku-tensei",
    name: "Mushoku Tensei",
    query: "Mushoku Tensei",
    aliases: ["Jobless Reincarnation"],
    accent: 38,
  },
  {
    id: "re-zero",
    name: "Re:Zero",
    query: "Re Zero",
    aliases: ["Re:Zero Starting Life in Another World"],
    accent: 300,
  },
  {
    id: "slime",
    name: "That Time I Got Reincarnated as a Slime",
    query: "That Time I Got Reincarnated as a Slime",
    aliases: ["Tensei Shitara Slime Datta Ken"],
    accent: 210,
    backdrop:
      "https://s4.anilist.co/file/anilistcdn/media/anime/banner/101280-9t7J3774n955.jpg",
    logo:
      "https://artworks.thetvdb.com/banners/v4/series/352408/clearlogo/611c83c1eba90.png",
  },
];

export function normalizeEBookUniverseTitle(value: string): string {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/\p{M}+/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function universeKeys(universe: EBookUniverse): string[] {
  return [universe.name, universe.query, ...(universe.aliases ?? [])]
    .map(normalizeEBookUniverseTitle)
    .filter(Boolean);
}

function bookKeys(book: EBook): string[] {
  return [book.title, book.seriesTitle, ...(book.altTitle?.split("|") ?? [])]
    .map((title) => normalizeEBookUniverseTitle(title ?? ""))
    .filter(Boolean);
}

export function findEBookUniverseMatch(
  universe: EBookUniverse,
  candidates: EBook[],
): EBook | null {
  const keys = universeKeys(universe);
  let best: EBook | null = null;
  let bestScore = -Infinity;
  for (const group of candidates) {
    for (const book of group.books ?? [group]) {
      const titles = bookKeys(book);
      if (!titles.length) continue;
      let score = -Infinity;
      for (const title of titles) {
        for (const key of keys) {
          let match = 0;
          if (title === key) match = 100;
          else if (title.startsWith(key) || key.startsWith(title)) match = 55;
          else if (title.includes(key) || key.includes(title)) match = 25;
          if (!match) continue;
          match -= Math.abs(title.length - key.length) / 25;
          score = Math.max(score, match);
        }
      }
      if (!Number.isFinite(score)) continue;
      score += book.cover ? 2 : 0;
      score += Math.min(book.chapters ?? 0, 2_000) / 2_000;
      if (score > bestScore) {
        best = book;
        bestScore = score;
      }
    }
  }
  return best;
}

export async function resolveEBookUniverse(
  universe: EBookUniverse,
  seedBooks: EBook[],
  search: (query: string) => Promise<EBook[]>,
): Promise<EBook | null> {
  const seeded = findEBookUniverseMatch(universe, seedBooks);
  if (seeded) return seeded;
  const results = await Promise.all(
    [universe.query, ...(universe.aliases ?? [])].map((query) => search(query).catch(() => [])),
  );
  return findEBookUniverseMatch(universe, results.flat());
}

function authorKey(value: string): string {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/\p{M}+/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function booksBySameAuthor(ebook: EBook, candidates: EBook[]): EBook[] {
  const authors = new Set(ebook.authors.map(authorKey).filter(Boolean));
  if (!authors.size) return [];
  const title = normalizeEBookUniverseTitle(ebook.title);
  const found = new Map<string, EBook>();
  for (const group of candidates) {
    for (const book of group.books ?? [group]) {
      if (book.id === ebook.id || normalizeEBookUniverseTitle(book.title) === title) continue;
      if (!book.authors.some((author) => authors.has(authorKey(author)))) continue;
      const key = normalizeEBookUniverseTitle(book.seriesTitle || book.title) || book.id;
      const current = found.get(key);
      if (!current || (!current.cover && book.cover)) found.set(key, book);
    }
  }
  return [...found.values()];
}
