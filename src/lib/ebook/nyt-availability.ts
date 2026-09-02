import { searchSourceEBooks } from "./providers";
import type { EBook } from "./api";
import type { NytBook } from "./nyt";

export type NytMatch = { state: "unknown" | "checking" | "found" | "missing"; ebook?: EBook };

const cache = new Map<string, NytMatch>();
const listeners = new Set<() => void>();
let version = 0;

function emit(): void {
  version += 1;
  listeners.forEach((l) => l());
}

export function subscribeNytAvailability(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function nytAvailabilityVersion(): number {
  return version;
}

export function nytBookKey(book: NytBook): string {
  return `${normalize(book.title)}|${normalize(book.author)}`;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function surname(author: string): string {
  const cleaned = normalize(author).split(" and ")[0] ?? "";
  const parts = cleaned.split(" ").filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : "";
}

function titleMatches(want: string, got: string): boolean {
  if (!want || !got) return false;
  if (want === got) return true;
  const shorter = want.length <= got.length ? want : got;
  const longer = want.length <= got.length ? got : want;
  if (longer.startsWith(shorter) && shorter.length >= 6) return true;
  return false;
}

function authorMatches(book: NytBook, candidate: EBook): boolean {
  const last = surname(book.author);
  if (!last) return true;
  return candidate.authors.some((a) => normalize(a).split(" ").includes(last));
}

export function readNytMatch(book: NytBook): NytMatch {
  return cache.get(nytBookKey(book)) ?? { state: "unknown" };
}

export async function resolveNytBook(book: NytBook): Promise<NytMatch> {
  const key = nytBookKey(book);
  const existing = cache.get(key);
  if (existing && existing.state !== "unknown") return existing;
  cache.set(key, { state: "checking" });
  emit();
  let result: NytMatch = { state: "missing" };
  try {
    const hits = await searchSourceEBooks(book.title);
    const wantTitle = normalize(book.title);
    const match = hits.find(
      (hit) => titleMatches(wantTitle, normalize(hit.title)) && authorMatches(book, hit),
    );
    if (match) result = { state: "found", ebook: match };
  } catch {
    result = { state: "unknown" };
  }
  cache.set(key, result);
  emit();
  return result;
}

export async function resolveNytBooks(books: NytBook[]): Promise<void> {
  for (const book of books) {
    if (readNytMatch(book).state !== "unknown") continue;
    await resolveNytBook(book);
  }
}
