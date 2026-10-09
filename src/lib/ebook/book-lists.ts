export type BookListOrdering = "ranked" | "chronological" | "unordered";

export type BookListSeed = {
  id: string;
  title: string;
  curator: string;
  blurb: string;
  ordering: BookListOrdering;
  /** Open Library search that stands the list up. Titles resolve through the same lane covers do. */
  query: { subject?: string; person?: string; place?: string; q?: string; sort?: string };
  expectedCount: number;
  rowCount: number;
  publishedYear?: number;
};

export type BookListEntry = { rank: number | null; title: string; author: string; year?: number };

/** A prize year is a fact about the book, not a search result, so winners are seeded rather than guessed. */
export type AwardListSeed = BookListSeed & { entries: BookListEntry[] };

const HUGO: BookListEntry[] = [
  { rank: null, title: "The Fifth Season", author: "N. K. Jemisin", year: 2016 },
  { rank: null, title: "The Obelisk Gate", author: "N. K. Jemisin", year: 2017 },
  { rank: null, title: "The Stone Sky", author: "N. K. Jemisin", year: 2018 },
  { rank: null, title: "The Calculating Stars", author: "Mary Robinette Kowal", year: 2019 },
  { rank: null, title: "A Memory Called Empire", author: "Arkady Martine", year: 2020 },
  { rank: null, title: "Network Effect", author: "Martha Wells", year: 2021 },
  { rank: null, title: "A Desolation Called Peace", author: "Arkady Martine", year: 2022 },
  { rank: null, title: "Nettle & Bone", author: "T. Kingfisher", year: 2023 },
  { rank: null, title: "Some Desperate Glory", author: "Emily Tesh", year: 2024 },
  { rank: null, title: "The Dispossessed", author: "Ursula K. Le Guin", year: 1975 },
  { rank: null, title: "The Left Hand of Darkness", author: "Ursula K. Le Guin", year: 1970 },
  { rank: null, title: "Dune", author: "Frank Herbert", year: 1966 },
  { rank: null, title: "Ender's Game", author: "Orson Scott Card", year: 1986 },
  { rank: null, title: "Neuromancer", author: "William Gibson", year: 1985 },
  { rank: null, title: "Hyperion", author: "Dan Simmons", year: 1990 },
  { rank: null, title: "Doomsday Book", author: "Connie Willis", year: 1993 },
  { rank: null, title: "The Diamond Age", author: "Neal Stephenson", year: 1996 },
  { rank: null, title: "American Gods", author: "Neil Gaiman", year: 2002 },
  { rank: null, title: "Jonathan Strange & Mr Norrell", author: "Susanna Clarke", year: 2005 },
  { rank: null, title: "The Windup Girl", author: "Paolo Bacigalupi", year: 2010 },
  { rank: null, title: "Among Others", author: "Jo Walton", year: 2012 },
  { rank: null, title: "Ancillary Justice", author: "Ann Leckie", year: 2014 },
];

const BOOKER: BookListEntry[] = [
  { rank: null, title: "Orbital", author: "Samantha Harvey", year: 2024 },
  { rank: null, title: "Prophet Song", author: "Paul Lynch", year: 2023 },
  { rank: null, title: "The Seven Moons of Maali Almeida", author: "Shehan Karunatilaka", year: 2022 },
  { rank: null, title: "The Promise", author: "Damon Galgut", year: 2021 },
  { rank: null, title: "Shuggie Bain", author: "Douglas Stuart", year: 2020 },
  { rank: null, title: "Girl, Woman, Other", author: "Bernardine Evaristo", year: 2019 },
  { rank: null, title: "Milkman", author: "Anna Burns", year: 2018 },
  { rank: null, title: "Lincoln in the Bardo", author: "George Saunders", year: 2017 },
  { rank: null, title: "The Sellout", author: "Paul Beatty", year: 2016 },
  { rank: null, title: "A Brief History of Seven Killings", author: "Marlon James", year: 2015 },
  { rank: null, title: "The Luminaries", author: "Eleanor Catton", year: 2013 },
  { rank: null, title: "Wolf Hall", author: "Hilary Mantel", year: 2009 },
  { rank: null, title: "The White Tiger", author: "Aravind Adiga", year: 2008 },
  { rank: null, title: "The God of Small Things", author: "Arundhati Roy", year: 1997 },
  { rank: null, title: "The English Patient", author: "Michael Ondaatje", year: 1992 },
  { rank: null, title: "The Remains of the Day", author: "Kazuo Ishiguro", year: 1989 },
  { rank: null, title: "Midnight's Children", author: "Salman Rushdie", year: 1981 },
];

const PULITZER: BookListEntry[] = [
  { rank: null, title: "Night Watch", author: "Jayne Anne Phillips", year: 2024 },
  { rank: null, title: "Demon Copperhead", author: "Barbara Kingsolver", year: 2023 },
  { rank: null, title: "Trust", author: "Hernan Diaz", year: 2023 },
  { rank: null, title: "The Netanyahus", author: "Joshua Cohen", year: 2022 },
  { rank: null, title: "The Night Watchman", author: "Louise Erdrich", year: 2021 },
  { rank: null, title: "The Nickel Boys", author: "Colson Whitehead", year: 2020 },
  { rank: null, title: "The Overstory", author: "Richard Powers", year: 2019 },
  { rank: null, title: "Less", author: "Andrew Sean Greer", year: 2018 },
  { rank: null, title: "The Underground Railroad", author: "Colson Whitehead", year: 2017 },
  { rank: null, title: "The Sympathizer", author: "Viet Thanh Nguyen", year: 2016 },
  { rank: null, title: "All the Light We Cannot See", author: "Anthony Doerr", year: 2015 },
  { rank: null, title: "The Goldfinch", author: "Donna Tartt", year: 2014 },
  { rank: null, title: "A Visit from the Goon Squad", author: "Jennifer Egan", year: 2011 },
  { rank: null, title: "The Road", author: "Cormac McCarthy", year: 2007 },
  { rank: null, title: "Middlesex", author: "Jeffrey Eugenides", year: 2003 },
  { rank: null, title: "The Amazing Adventures of Kavalier & Clay", author: "Michael Chabon", year: 2001 },
  { rank: null, title: "Beloved", author: "Toni Morrison", year: 1988 },
  { rank: null, title: "To Kill a Mockingbird", author: "Harper Lee", year: 1961 },
];

const WOMENS_PRIZE: BookListEntry[] = [
  { rank: null, title: "Brotherless Night", author: "V. V. Ganeshananthan", year: 2024 },
  { rank: null, title: "Demon Copperhead", author: "Barbara Kingsolver", year: 2023 },
  { rank: null, title: "The Book of Form and Emptiness", author: "Ruth Ozeki", year: 2022 },
  { rank: null, title: "Piranesi", author: "Susanna Clarke", year: 2021 },
  { rank: null, title: "Hamnet", author: "Maggie O'Farrell", year: 2020 },
  { rank: null, title: "An American Marriage", author: "Tayari Jones", year: 2019 },
  { rank: null, title: "Home Fire", author: "Kamila Shamsie", year: 2018 },
  { rank: null, title: "The Power", author: "Naomi Alderman", year: 2017 },
  { rank: null, title: "Half of a Yellow Sun", author: "Chimamanda Ngozi Adichie", year: 2007 },
];

export const BOOK_AWARD_LISTS: readonly AwardListSeed[] = [
  {
    id: "hugo-best-novel",
    title: "Hugo Award for Best Novel",
    curator: "World Science Fiction Society",
    blurb:
      "Voted by the members of Worldcon since 1953, the award that has crowned science fiction's turning points from Dune to the Broken Earth.",
    ordering: "chronological",
    query: { subject: "science fiction" },
    expectedCount: HUGO.length,
    rowCount: 24,
    entries: HUGO,
  },
  {
    id: "booker-prize",
    title: "The Booker Prize",
    curator: "Booker Prize Foundation",
    blurb:
      "One novel a year, chosen from everything published in English in the UK and Ireland. The prize that made literary fiction an event.",
    ordering: "chronological",
    query: { subject: "fiction" },
    expectedCount: BOOKER.length,
    rowCount: 24,
    entries: BOOKER,
  },
  {
    id: "pulitzer-fiction",
    title: "Pulitzer Prize for Fiction",
    curator: "Columbia University",
    blurb:
      "Distinguished fiction by an American author, preferably dealing with American life. Awarded since 1918 and still the country's measure of itself.",
    ordering: "chronological",
    query: { subject: "american fiction" },
    expectedCount: PULITZER.length,
    rowCount: 24,
    entries: PULITZER,
  },
  {
    id: "womens-prize-fiction",
    title: "Women's Prize for Fiction",
    curator: "Women's Prize Trust",
    blurb:
      "Full-length fiction by women writing in English, from anywhere in the world, founded in 1996 to answer a prize list that kept forgetting them.",
    ordering: "chronological",
    query: { subject: "fiction" },
    expectedCount: WOMENS_PRIZE.length,
    rowCount: 24,
    entries: WOMENS_PRIZE,
  },
];

/** Shelves that stand up from Open Library alone, with no seeded winner list behind them. */
export const BOOK_SUBJECT_LISTS: readonly BookListSeed[] = [
  {
    id: "classics",
    title: "The classics",
    curator: "Open Library",
    blurb: "The books that kept being reprinted, ranked by how many editions the world has bothered to make.",
    ordering: "ranked",
    query: { subject: "classic literature", sort: "editions" },
    expectedCount: 100,
    rowCount: 24,
  },
  {
    id: "most-read",
    title: "Most read right now",
    curator: "Open Library",
    blurb: "What readers are shelving this week, straight from Open Library's own reading lists.",
    ordering: "ranked",
    query: { subject: "fiction", sort: "readinglog" },
    expectedCount: 100,
    rowCount: 24,
  },
  {
    id: "banned-books",
    title: "Banned and challenged",
    curator: "Open Library",
    blurb: "Books someone tried to take off a shelf, which is usually a reason to put them on one.",
    ordering: "unordered",
    query: { subject: "banned books" },
    expectedCount: 60,
    rowCount: 24,
  },
];

export function bookListById(id: string): BookListSeed | undefined {
  return (
    BOOK_AWARD_LISTS.find((list) => list.id === id) ??
    BOOK_SUBJECT_LISTS.find((list) => list.id === id)
  );
}

export function awardListEntries(id: string): readonly BookListEntry[] {
  return BOOK_AWARD_LISTS.find((list) => list.id === id)?.entries ?? [];
}

/** Every award a seeded list records for a title, matched the way a reader would: name and author. */
export function awardsForBook(title: string, authors: readonly string[]): string[] {
  const wanted = normalizeBookTitle(title);
  if (!wanted) return [];
  const author = normalizeBookTitle(authors[0] ?? "");
  const out: string[] = [];
  for (const list of BOOK_AWARD_LISTS) {
    for (const entry of list.entries) {
      if (normalizeBookTitle(entry.title) !== wanted) continue;
      if (author && normalizeBookTitle(entry.author) !== author) continue;
      out.push(entry.year ? `${list.title} (${entry.year})` : list.title);
      break;
    }
  }
  return out;
}

export function normalizeBookTitle(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, "")
    .replace(/\s*[:(\[].*$/, "")
    .replace(/[^a-z0-9 &]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
