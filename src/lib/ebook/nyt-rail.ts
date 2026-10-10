import type { EBook } from "./api";
import { readNytMatch } from "./nyt-availability";
import type { NytBook, NytList } from "./nyt";

const PREFIX = "nyt:";

export function isNytPlaceholder(id: string): boolean {
  return id.startsWith(PREFIX);
}

export function nytPlaceholderTitle(id: string): string {
  return id.startsWith(PREFIX) ? id.slice(PREFIX.length).split("|")[0] : "";
}

function placeholder(book: NytBook): EBook {
  return {
    id: `${PREFIX}${book.title}|${book.rank}`,
    source: "source",
    title: book.title,
    authors: book.author ? [book.author] : [],
    cover: book.cover,
    description: book.description,
    genres: [],
    isbn: book.isbn13,
  };
}

export function nytRailItems(list: NytList | null): EBook[] | null {
  if (!list) return null;
  return list.books.map((book) => {
    const match = readNytMatch(book);
    return match.state === "found" && match.ebook ? match.ebook : placeholder(book);
  });
}

export function nytRankFor(list: NytList | null, ebook: EBook): NytBook | null {
  if (!list) return null;
  const id = ebook.id;
  if (isNytPlaceholder(id)) {
    const title = nytPlaceholderTitle(id);
    return list.books.find((b) => b.title === title) ?? null;
  }
  const key = ebook.title.toLowerCase();
  return list.books.find((b) => b.title.toLowerCase() === key) ?? null;
}
