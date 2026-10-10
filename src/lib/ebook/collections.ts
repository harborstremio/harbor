import { t } from "@/lib/i18n";
import { setItemWithRecovery } from "@/lib/storage-recovery";
import type { EBook } from "./api";

export type EBookSourceCollection = {
  id: string;
  name: string;
  subtitle: string;
  kind: "series" | "catalog" | "award";
  books: EBook[];
};

export type EBookAwardTitle = { title: string; aliases?: string[] };

export type EBookAwardCollection = {
  id: string;
  name: string;
  subtitle: string;
  titles: EBookAwardTitle[];
};

export const EBOOK_AWARD_COLLECTIONS: EBookAwardCollection[] = [
  {
    id: "nyt-21st",
    name: t("The Times: Best Books of the 21st Century"),
    subtitle: t("From the New York Times critics' list of the century so far"),
    titles: [
      { title: "My Brilliant Friend" },
      { title: "The Warmth of Other Suns" },
      { title: "Wolf Hall" },
      { title: "The Known World" },
      { title: "The Corrections" },
      { title: "2666" },
      { title: "The Underground Railroad" },
      { title: "Austerlitz" },
      { title: "Never Let Me Go" },
      { title: "Gilead" },
      { title: "The Road" },
      { title: "Pachinko" },
      { title: "Normal People" },
      { title: "The Sympathizer" },
      { title: "Station Eleven" },
      { title: "A Visit from the Goon Squad" },
      { title: "The Brief Wondrous Life of Oscar Wao" },
      { title: "Atonement" },
      { title: "Life After Life" },
      { title: "The Overstory" },
    ],
  },
  {
    id: "screen",
    name: t("Read It Before You Watch It"),
    subtitle: t("Books behind the films and series everyone knows"),
    titles: [
      { title: "Dune" },
      { title: "The Lord of the Rings" },
      { title: "Fight Club" },
      { title: "No Country for Old Men" },
      { title: "The Shining" },
      { title: "Gone Girl" },
      { title: "The Martian" },
      { title: "Jurassic Park" },
      { title: "Do Androids Dream of Electric Sheep?" },
      { title: "The Godfather" },
      { title: "The Silence of the Lambs" },
      { title: "A Clockwork Orange" },
      { title: "The Hunger Games" },
      { title: "Ready Player One" },
      { title: "Call Me by Your Name" },
      { title: "The Handmaid's Tale" },
      { title: "The Girl with the Dragon Tattoo" },
      { title: "Life of Pi" },
      { title: "The English Patient" },
      { title: "Trainspotting" },
      { title: "American Psycho" },
      { title: "Shutter Island" },
      { title: "Fear and Loathing in Las Vegas" },
    ],
  },
  {
    id: "banned",
    name: t("Banned and Challenged"),
    subtitle: t("Books someone tried to pull from a shelf"),
    titles: [
      { title: "1984" },
      { title: "Brave New World" },
      { title: "Fahrenheit 451" },
      { title: "To Kill a Mockingbird" },
      { title: "The Catcher in the Rye" },
      { title: "Beloved" },
      { title: "The Handmaid's Tale" },
      { title: "Lolita" },
      { title: "Animal Farm" },
      { title: "Slaughterhouse-Five" },
      { title: "The Color Purple" },
      { title: "Of Mice and Men" },
      { title: "Ulysses" },
      { title: "Lady Chatterley's Lover" },
    ],
  },
  {
    id: "nobel",
    name: t("Nobel Laureates in Literature"),
    subtitle: t("Signature works by winners of the Nobel Prize"),
    titles: [
      { title: "One Hundred Years of Solitude" },
      { title: "The Old Man and the Sea" },
      { title: "Never Let Me Go" },
      { title: "Beloved" },
      { title: "The Stranger" },
      { title: "Snow" },
      { title: "Blindness" },
      { title: "Disgrace" },
      { title: "The Tin Drum" },
      { title: "Doctor Zhivago" },
      { title: "Lord of the Flies" },
    ],
  },
  {
    id: "modern-classics",
    name: t("Modern Classics"),
    subtitle: t("Twentieth century books that never left the shelf"),
    titles: [
      { title: "The Great Gatsby" },
      { title: "Catch-22" },
      { title: "On the Road" },
      { title: "The Bell Jar" },
      { title: "One Flew Over the Cuckoo's Nest" },
      { title: "Slaughterhouse-Five" },
      { title: "The Catcher in the Rye" },
      { title: "Invisible Man" },
      { title: "Things Fall Apart" },
      { title: "Mrs Dalloway" },
      { title: "The Sun Also Rises" },
    ],
  },
  {
    id: "dystopia",
    name: t("Dystopias"),
    subtitle: t("Futures nobody would choose to live in"),
    titles: [
      { title: "1984" },
      { title: "Brave New World" },
      { title: "Fahrenheit 451" },
      { title: "The Handmaid's Tale" },
      { title: "We" },
      { title: "The Road" },
      { title: "Never Let Me Go" },
      { title: "Parable of the Sower" },
      { title: "The Children of Men" },
      { title: "A Clockwork Orange" },
      { title: "Station Eleven" },
    ],
  },
  {
    id: "crime",
    name: t("Crime and Mystery Essentials"),
    subtitle: t("The cases that set the genre"),
    titles: [
      { title: "The Big Sleep" },
      { title: "The Maltese Falcon" },
      { title: "Gone Girl" },
      { title: "The Girl with the Dragon Tattoo" },
      { title: "And Then There Were None" },
      { title: "The Hound of the Baskervilles" },
      { title: "In Cold Blood" },
      { title: "The Talented Mr. Ripley" },
      { title: "The Silence of the Lambs" },
      { title: "Murder on the Orient Express" },
      { title: "The Secret History" },
    ],
  },
  {
    id: "womens-prize",
    name: t("Women's Prize for Fiction"),
    subtitle: t("Full length fiction by women writing in English"),
    titles: [
      { title: "Hamnet" },
      { title: "Piranesi" },
      { title: "The Power" },
      { title: "Home Fire" },
      { title: "An American Marriage" },
      { title: "Half of a Yellow Sun" },
      { title: "Demon Copperhead" },
      { title: "The Book of Form and Emptiness" },
    ],
  },
  {
    id: "national-book",
    name: t("National Book Award Winners"),
    subtitle: t("The American award for the year's best writing"),
    titles: [
      { title: "The Underground Railroad" },
      { title: "Sing, Unburied, Sing" },
      { title: "The Friend" },
      { title: "Trust Exercise" },
      { title: "Hell of a Book" },
      { title: "The Rabbit Hutch" },
      { title: "Let the Great World Spin" },
      { title: "Salvage the Bones" },
    ],
  },

  {
    id: "hugo",
    name: t("Hugo Award Winners"),
    subtitle: t("Landmark winners in science fiction and fantasy"),
    titles: [
      { title: "Dune", aliases: ["كثيب"] },
      { title: "The Left Hand of Darkness", aliases: ["اليد اليسرى للظلام"] },
      { title: "The Dispossessed", aliases: ["المحرومون"] },
      { title: "Neuromancer", aliases: ["نيورومانسر"] },
      { title: "Hyperion", aliases: ["هايبريون"] },
      { title: "The Three-Body Problem", aliases: ["مشكلة الأجسام الثلاثة"] },
      { title: "Ancillary Justice" },
      { title: "The Fifth Season", aliases: ["الموسم الخامس"] },
      { title: "The Stone Sky" },
      { title: "A Memory Called Empire" },
      { title: "Network Effect" },
      { title: "Nettle & Bone" },
    ],
  },
  {
    id: "nebula",
    name: t("Nebula Award Winners"),
    subtitle: t("Awarded by science-fiction and fantasy writers"),
    titles: [
      { title: "Dune", aliases: ["كثيب"] },
      { title: "Flowers for Algernon", aliases: ["أزهار لألجرنون"] },
      { title: "The Left Hand of Darkness", aliases: ["اليد اليسرى للظلام"] },
      { title: "Ringworld", aliases: ["عالم الحلقة"] },
      { title: "Rendezvous with Rama", aliases: ["موعد مع راما"] },
      { title: "The Dispossessed", aliases: ["المحرومون"] },
      { title: "Ender's Game", aliases: ["لعبة إندر"] },
      { title: "Neuromancer", aliases: ["نيورومانسر"] },
      { title: "The Windup Girl" },
      { title: "The Fifth Season", aliases: ["الموسم الخامس"] },
      { title: "The Stone Sky" },
      { title: "Piranesi", aliases: ["بيرانيزي"] },
      { title: "Babel", aliases: ["بابل"] },
    ],
  },
  {
    id: "booker",
    name: t("Booker Prize Winners"),
    subtitle: t("Celebrated works of literary fiction"),
    titles: [
      { title: "Midnight's Children", aliases: ["أطفال منتصف الليل"] },
      { title: "The Remains of the Day", aliases: ["بقايا النهار"] },
      { title: "The English Patient", aliases: ["المريض الإنجليزي"] },
      { title: "Life of Pi", aliases: ["حياة باي"] },
      { title: "Wolf Hall", aliases: ["قاعة الذئب"] },
      { title: "The Luminaries" },
      { title: "Lincoln in the Bardo" },
      { title: "Shuggie Bain" },
      { title: "The Promise", aliases: ["الوعد"] },
      { title: "Prophet Song" },
    ],
  },
  {
    id: "pulitzer-fiction",
    name: t("Pulitzer Prize for Fiction"),
    subtitle: t("Distinguished fiction honored by the Pulitzer Prize"),
    titles: [
      { title: "To Kill a Mockingbird", aliases: ["أن تقتل طائرا بريئا"] },
      { title: "The Color Purple", aliases: ["اللون الأرجواني"] },
      { title: "Beloved", aliases: ["محبوبة"] },
      { title: "The Road", aliases: ["الطريق"] },
      { title: "The Goldfinch", aliases: ["الحسون"] },
      { title: "All the Light We Cannot See", aliases: ["كل الضوء الذي لا يمكننا رؤيته"] },
      { title: "The Underground Railroad", aliases: ["سكة حديد تحت الأرض"] },
      { title: "The Overstory" },
      { title: "The Nickel Boys" },
      { title: "Demon Copperhead" },
    ],
  },
];

const CACHE_KEY = "harbor.ebook.source-collections.v2";
const AWARD_SEARCH_CACHE_KEY = "harbor.ebook.award-search.v1";
const CACHE_TTL = 24 * 60 * 60 * 1000;
const CACHE_CAP = 12;
const RAIL_LIMIT = 24;

type CollectionCacheEntry = { at: number; collections: EBookSourceCollection[] };

const memoryCache = new Map<string, EBookSourceCollection[]>();
const writtenFingerprints = new Map<string, string>();

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/\p{M}+/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function uniqueBooks(books: EBook[]): EBook[] {
  const unique = new Map<string, EBook>();
  for (const book of books) {
    const key = normalize(book.title) || book.id;
    const existing = unique.get(key);
    if (!existing || (!existing.cover && book.cover)) unique.set(key, book);
  }
  return [...unique.values()];
}

function bookTitleKeys(book: EBook): string[] {
  return [book.title, book.seriesTitle, ...(book.altTitle?.split("|") ?? [])]
    .map((title) => normalize(title ?? ""))
    .filter(Boolean);
}

function awardTitleKeys(title: EBookAwardTitle): string[] {
  return [title.title, ...(title.aliases ?? [])].map(normalize).filter(Boolean);
}

export function findAwardSourceBook(title: EBookAwardTitle, books: EBook[]): EBook | undefined {
  const wanted = awardTitleKeys(title);
  return books.find((book) => {
    const candidates = bookTitleKeys(book);
    return candidates.some((candidate) =>
      wanted.some((key) => candidate === key || candidate.includes(key) || key.includes(candidate)),
    );
  });
}

function compactBook(book: EBook): EBook {
  return {
    id: book.id,
    source: "source",
    providerId: book.providerId,
    sourceItemId: book.sourceItemId,
    providerName: book.providerName,
    seriesTitle: book.seriesTitle,
    title: book.title,
    altTitle: book.altTitle,
    authors: book.authors.slice(0, 4),
    cover: book.cover,
    internalCover: book.internalCover,
    description: "",
    year: book.year,
    publishedAt: book.publishedAt,
    status: book.status,
    genres: book.genres.slice(0, 8),
    chapters: book.chapters,
    volumes: book.volumes,
    score: book.score,
    siteUrl: book.siteUrl,
  };
}

function collectionFingerprint(collections: EBookSourceCollection[]): string {
  return collections
    .map(
      (collection) =>
        `${collection.id}:${collection.books
          .map((book) => `${book.id}:${book.title}:${book.cover ?? ""}`)
          .join(",")}`,
    )
    .join("|");
}

export function eBookCollectionCacheScope(providerId: string, providerIds: string[]): string {
  const installed = providerIds
    .filter((id) => id !== "all")
    .sort()
    .join("|");
  return `${providerId || "all"}::${installed}`;
}

export function preferredEBookPopular(
  sourceBooks: EBook[] | null,
  metadataBooks: EBook[] | null,
): EBook[] | null {
  if (sourceBooks === null) return null;
  return sourceBooks.length ? sourceBooks : metadataBooks;
}
function awardCopy(id: string): Pick<EBookAwardCollection, "name" | "subtitle"> | null {
  switch (id) {
    case "hugo":
      return {
        name: t("Hugo Award Winners"),
        subtitle: t("Landmark winners in science fiction and fantasy"),
      };
    case "nebula":
      return {
        name: t("Nebula Award Winners"),
        subtitle: t("Awarded by science-fiction and fantasy writers"),
      };
    case "booker":
      return {
        name: t("Booker Prize Winners"),
        subtitle: t("Celebrated works of literary fiction"),
      };
    case "pulitzer-fiction":
      return {
        name: t("Pulitzer Prize for Fiction"),
        subtitle: t("Distinguished fiction honored by the Pulitzer Prize"),
      };
    case "nyt-21st":
      return {
        name: t("The Times: Best Books of the 21st Century"),
        subtitle: t("From the New York Times critics' list of the century so far"),
      };
    case "screen":
      return {
        name: t("Read It Before You Watch It"),
        subtitle: t("Books behind the films and series everyone knows"),
      };
    case "banned":
      return {
        name: t("Banned and Challenged"),
        subtitle: t("Books someone tried to pull from a shelf"),
      };
    case "nobel":
      return {
        name: t("Nobel Laureates in Literature"),
        subtitle: t("Signature works by winners of the Nobel Prize"),
      };
    case "modern-classics":
      return {
        name: t("Modern Classics"),
        subtitle: t("Twentieth century books that never left the shelf"),
      };
    case "dystopia":
      return {
        name: t("Dystopias"),
        subtitle: t("Futures nobody would choose to live in"),
      };
    case "crime":
      return {
        name: t("Crime and Mystery Essentials"),
        subtitle: t("The cases that set the genre"),
      };
    case "womens-prize":
      return {
        name: t("Women's Prize for Fiction"),
        subtitle: t("Full length fiction by women writing in English"),
      };
    case "national-book":
      return {
        name: t("National Book Award Winners"),
        subtitle: t("The American award for the year's best writing"),
      };
    default:
      return null;
  }
}

function localizeCollection(collection: EBookSourceCollection): EBookSourceCollection {
  if (collection.kind === "series") {
    return {
      ...collection,
      subtitle: t("{count} books from this source", { count: collection.books.length }),
    };
  }
  if (collection.kind === "catalog") {
    return {
      ...collection,
      name: t("Most Popular"),
      subtitle: t("Popular titles from the installed source"),
    };
  }
  const award = awardCopy(collection.id.replace(/^award:/, ""));
  return award ? { ...collection, ...award } : collection;
}

export function buildSourceEBookCollections(items: EBook[]): EBookSourceCollection[] {
  const sourceItems = items.filter((book) => book.source === "source");
  if (!sourceItems.length) return [];

  const collections: EBookSourceCollection[] = [];
  const series = new Map<string, { name: string; books: EBook[] }>();
  for (const item of sourceItems) {
    for (const book of item.books ?? [item]) {
      const name = book.seriesTitle?.trim() || item.seriesTitle?.trim();
      const key = name ? normalize(name) : "";
      if (!key) continue;
      const group = series.get(key) ?? { name: name!, books: [] };
      group.books.push(book);
      series.set(key, group);
    }
  }
  for (const [key, group] of series) {
    const books = uniqueBooks(group.books).slice(0, RAIL_LIMIT);
    if (books.length < 2) continue;
    collections.push({
      id: `series:${key}`,
      name: group.name,
      subtitle: t("{count} books from this source", { count: books.length }),
      kind: "series",
      books,
    });
  }

  const catalogBooks = uniqueBooks(sourceItems).slice(0, RAIL_LIMIT);
  if (catalogBooks.length) {
    collections.push({
      id: "catalog:popular",
      name: t("Most Popular"),
      subtitle: t("Popular titles from the installed source"),
      kind: "catalog",
      books: catalogBooks,
    });
  }

  const awardBooks = sourceItems.flatMap((item) => item.books ?? [item]);
  for (const award of EBOOK_AWARD_COLLECTIONS) {
    const books = uniqueBooks(
      award.titles.flatMap((title) => findAwardSourceBook(title, awardBooks) ?? []),
    );
    if (!books.length) continue;
    const copy = awardCopy(award.id) ?? { name: award.name, subtitle: award.subtitle };
    collections.push({
      id: `award:${award.id}`,
      ...copy,
      kind: "award",
      books: books.slice(0, RAIL_LIMIT),
    });
  }

  return collections;
}

export function readSourceEBookCollections(scope: string): EBookSourceCollection[] {
  if (!scope) return [];
  const memory = memoryCache.get(scope);
  if (memory) return memory.map(localizeCollection);
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const store = JSON.parse(raw) as Record<string, CollectionCacheEntry>;
    const entry = store[scope];
    if (!entry || Date.now() - entry.at > CACHE_TTL) return [];
    const collections = entry.collections
      .filter(
        (collection) =>
          (collection.kind === "series" ||
            collection.kind === "catalog" ||
            collection.kind === "award") &&
          Array.isArray(collection.books) &&
          collection.books.length > 0,
      )
      .map(localizeCollection);
    memoryCache.set(scope, collections);
    writtenFingerprints.set(scope, collectionFingerprint(collections));
    return collections;
  } catch {
    return [];
  }
}

function readAwardSearchStore(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(AWARD_SEARCH_CACHE_KEY) ?? "{}") as Record<
      string,
      number
    >;
  } catch {
    return {};
  }
}

export function sourceEBookAwardsAreFresh(scope: string): boolean {
  const at = readAwardSearchStore()[scope];
  return typeof at === "number" && Date.now() - at < CACHE_TTL;
}

export function markSourceEBookAwardsResolved(scope: string): void {
  if (!scope) return;
  const store = readAwardSearchStore();
  store[scope] = Date.now();
  const keys = Object.keys(store);
  if (keys.length > CACHE_CAP) {
    const oldest = keys.sort((left, right) => (store[left] ?? 0) - (store[right] ?? 0));
    for (const key of oldest.slice(0, keys.length - CACHE_CAP)) delete store[key];
  }
  try {
    setItemWithRecovery(AWARD_SEARCH_CACHE_KEY, JSON.stringify(store));
  } catch {
    return;
  }
}

export async function streamSourceEBookAwardMatches(
  seedBooks: EBook[],
  search: (query: string) => Promise<EBook[]>,
  onChunk: (books: EBook[]) => void,
): Promise<EBook[]> {
  const sourceBooks = seedBooks.flatMap((book) => book.books ?? [book]);
  const found = new Map(sourceBooks.map((book) => [book.id, book]));
  const unresolved = EBOOK_AWARD_COLLECTIONS.flatMap((award) =>
    award.titles.filter((title) => !findAwardSourceBook(title, sourceBooks)),
  );
  let cursor = 0;
  let pending: EBook[] = [];
  const flush = () => {
    if (!pending.length) return;
    onChunk(pending);
    pending = [];
  };
  const worker = async () => {
    while (cursor < unresolved.length) {
      const title = unresolved[cursor++];
      let match: EBook | undefined;
      for (const query of [title.title, ...(title.aliases ?? [])]) {
        const hits = await search(query).catch(() => []);
        match = findAwardSourceBook(title, hits);
        if (match) break;
      }
      if (!match || found.has(match.id)) continue;
      found.set(match.id, match);
      pending.push(match);
      if (pending.length >= 4) flush();
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, unresolved.length) }, () => worker()));
  flush();
  return [...found.values()];
}

export function writeSourceEBookCollections(
  scope: string,
  collections: EBookSourceCollection[],
): void {
  if (!scope || !collections.length) return;
  const compact = collections.map((collection) => ({
    ...collection,
    books: collection.books.map(compactBook),
  }));
  const fingerprint = collectionFingerprint(compact);
  if (writtenFingerprints.get(scope) === fingerprint) return;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const store = raw ? (JSON.parse(raw) as Record<string, CollectionCacheEntry>) : {};
    store[scope] = { at: Date.now(), collections: compact };
    const keys = Object.keys(store);
    if (keys.length > CACHE_CAP) {
      const oldest = keys.sort((left, right) => (store[left]?.at ?? 0) - (store[right]?.at ?? 0));
      for (const key of oldest.slice(0, keys.length - CACHE_CAP)) delete store[key];
    }
    if (!setItemWithRecovery(CACHE_KEY, JSON.stringify(store))) return;
    memoryCache.set(scope, compact);
    writtenFingerprints.set(scope, fingerprint);
  } catch {
    return;
  }
}
