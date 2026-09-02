import assert from "node:assert/strict";
import test from "node:test";

import {
  applyEBookBrowseFilters,
  EBOOK_FILTER_GENRES,
  ebookMatchesGenre,
  ebookSourceBrowseTag,
} from "../src/lib/ebook/browse-filters.ts";
import type { EBook } from "../src/lib/ebook/api.ts";

const book = (value: Partial<EBook> & Pick<EBook, "id" | "title">): EBook => ({
  source: "source",
  authors: [],
  description: "",
  genres: [],
  ...value,
});

const books = [
  book({ id: "b", title: "Beta", status: "ongoing", originalLanguage: "ko", chapters: 20, score: 80 }),
  book({ id: "a", title: "Alpha", status: "completed", originalLanguage: "zh", chapters: 100, score: 70 }),
  book({ id: "c", title: "Charlie", status: "hiatus", originalLanguage: "ja", chapters: 5, score: 95 }),
];

test("eBook browse filters status and original language", () => {
  assert.deepEqual(
    applyEBookBrowseFilters(books, { status: "completed", language: "chinese", sort: "popular" }).map((item) => item.id),
    ["a"],
  );
});

test("eBook browse sorting supports name, chapters, and rating", () => {
  assert.deepEqual(applyEBookBrowseFilters(books, { status: "any", language: "any", sort: "name" }).map((item) => item.id), ["a", "b", "c"]);
  assert.deepEqual(applyEBookBrowseFilters(books, { status: "any", language: "any", sort: "chapters" }).map((item) => item.id), ["a", "b", "c"]);
  assert.deepEqual(applyEBookBrowseFilters(books, { status: "any", language: "any", sort: "rating" }).map((item) => item.id), ["c", "b", "a"]);
});

test("native source tag prioritizes status and otherwise passes sorting", () => {
  assert.equal(ebookSourceBrowseTag("ongoing", "rating"), "status:ongoing");
  assert.equal(ebookSourceBrowseTag("any", "chapters"), "sort:chapters");
});

test("eBook genre filter exposes the requested novel genres", () => {
  assert.deepEqual(EBOOK_FILTER_GENRES, [
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
  ]);
});

test("genre matching recognizes common source variants", () => {
  assert.equal(ebookMatchesGenre(["Science Fiction"], "Sci-fi"), true);
  assert.equal(ebookMatchesGenre(["System", "Web Novel"], "Cheat system"), true);
  assert.equal(ebookMatchesGenre(["Suspense Thriller"], "Thriller"), true);
});
