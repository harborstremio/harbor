import type { EBook } from "./api";

export type EBookBrowseStatus = "any" | "ongoing" | "completed" | "hiatus";
export type EBookBrowseLanguage = "any" | "chinese" | "korean" | "japanese";
export type EBookBrowseSort = "name" | "popular" | "chapters" | "rating" | "trending";

export const EBOOK_FILTER_GENRES = [
  "Cheat system",
  "Comedy",
  "Cultivation",
  "Fantasy",
  "LitRPG",
  "Mystery",
  "Romance",
  "Sci-fi",
  "Slice of Life",
  "Sports",
  "Thriller",
] as const;

export type EBookBrowseFilters = {
  status: EBookBrowseStatus;
  language: EBookBrowseLanguage;
  sort: EBookBrowseSort;
};

const normalizedStatus = (value?: string): EBookBrowseStatus | "" => {
  const status = value?.toLocaleLowerCase() ?? "";
  if (/complete|finished/.test(status)) return "completed";
  if (/hiatus|paused|break/.test(status)) return "hiatus";
  if (/ongoing|releasing|publishing|current/.test(status)) return "ongoing";
  return "";
};

const normalizedLanguage = (value?: string): EBookBrowseLanguage | "" => {
  const language = value?.trim().toLocaleLowerCase() ?? "";
  if (["zh", "zho", "chi", "cn", "chinese"].includes(language)) return "chinese";
  if (["ko", "kor", "kr", "korean"].includes(language)) return "korean";
  if (["ja", "jpn", "jp", "japanese"].includes(language)) return "japanese";
  return "";
};

const GENRE_ALIASES: Record<string, string[]> = {
  "cheat system": ["cheat system", "system"],
  "sci fi": ["sci fi", "science fiction"],
  mystery: ["mystery", "detective"],
  thriller: ["thriller", "suspense"],
};

const normalizedGenre = (value: string) =>
  value
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

export function ebookMatchesGenre(genres: string[], selected: string): boolean {
  const wanted = normalizedGenre(selected);
  if (!wanted) return true;
  const aliases = GENRE_ALIASES[wanted] ?? [wanted];
  return genres.some((genre) => {
    const candidate = normalizedGenre(genre);
    return aliases.some(
      (alias) => candidate === alias || candidate.includes(alias) || alias.includes(candidate),
    );
  });
}

export function ebookSourceBrowseTag(
  status: EBookBrowseStatus,
  sort: EBookBrowseSort,
): string | undefined {
  if (status !== "any") return `status:${status}`;
  return `sort:${sort}`;
}

export function applyEBookBrowseFilters(
  books: EBook[],
  filters: EBookBrowseFilters,
): EBook[] {
  const filtered = books.filter(
    (book) =>
      (filters.status === "any" || normalizedStatus(book.status) === filters.status) &&
      (filters.language === "any" ||
        normalizedLanguage(book.originalLanguage) === filters.language),
  );
  if (filters.sort === "popular") return filtered;
  return [...filtered].sort((left, right) => {
    if (filters.sort === "name") return left.title.localeCompare(right.title);
    if (filters.sort === "chapters") return (right.chapters ?? -1) - (left.chapters ?? -1);
    if (filters.sort === "rating") return (right.score ?? -1) - (left.score ?? -1);
    return (
      (right.trendingScore ?? right.score ?? right.chapters ?? -1) -
      (left.trendingScore ?? left.score ?? left.chapters ?? -1)
    );
  });
}
