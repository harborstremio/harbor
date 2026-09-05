import type { EBook } from "./api";
import type { NytBook, NytList, NytSnapshot } from "./nyt";

export type NytMatch = { book: NytBook; list: NytList };

const STOP = /\b(a|an|the)\b/g;
const MARKS = /[̀-ͯ]/g;
const QUOTES = /[‘’“”]/g;
const SUBTITLE = /[:;(–—]/;

export function normalizeBookTitle(value: string): string {
  const base = value.toLowerCase().normalize("NFKD").replace(MARKS, "").replace(QUOTES, "");
  const head = base.split(SUBTITLE)[0] ?? base;
  return head.replace(STOP, " ").replace(/[^a-z0-9]+/g, " ").trim();
}

function surnames(values: string[]): Set<string> {
  const out = new Set<string>();
  for (const value of values) {
    for (const part of value.split(/,|\band\b|&/)) {
      const words = part.trim().toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean);
      const last = words[words.length - 1];
      if (last && last.length > 2) out.add(last);
    }
  }
  return out;
}

function authorsAgree(ebook: EBook, book: NytBook): boolean {
  const left = surnames(ebook.authors ?? []);
  const right = surnames(book.author ? [book.author] : []);
  if (left.size === 0 || right.size === 0) return true;
  for (const name of left) if (right.has(name)) return true;
  return false;
}

function isbnOf(value: string | undefined): string {
  return (value ?? "").replace(/[^0-9xX]/g, "").toUpperCase();
}

export function nytMatchIn(list: NytList, ebook: EBook): NytBook | null {
  const isbn = isbnOf(ebook.isbn);
  if (isbn) {
    const byIsbn = list.books.find((b) => isbnOf(b.isbn13) === isbn);
    if (byIsbn) return byIsbn;
  }
  const key = normalizeBookTitle(ebook.title);
  if (!key) return null;
  const exact = list.books.filter((b) => normalizeBookTitle(b.title) === key);
  if (exact.length === 0) return null;
  return exact.find((b) => authorsAgree(ebook, b)) ?? null;
}

export function nytBestsellerFor(snap: NytSnapshot | null, ebook: EBook): NytMatch | null {
  if (!snap) return null;
  let best: NytMatch | null = null;
  for (const list of snap.lists) {
    const book = nytMatchIn(list, ebook);
    if (!book) continue;
    if (
      !best ||
      book.rank < best.book.rank ||
      (book.rank === best.book.rank && book.weeksOnList > best.book.weeksOnList)
    ) {
      best = { book, list };
    }
  }
  return best;
}
