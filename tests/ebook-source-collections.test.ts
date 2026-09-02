import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSourceEBookCollections,
  eBookCollectionCacheScope,
  findAwardSourceBook,
  preferredEBookPopular,
} from "../src/lib/ebook/collections.ts";
import type { EBook } from "../src/lib/ebook/api.ts";

function book(
  id: string,
  title: string,
  options: Partial<EBook> = {},
): EBook {
  return {
    id: `source:demo:${id}`,
    source: "source",
    providerId: "demo",
    sourceItemId: id,
    title,
    authors: [],
    description: "",
    genres: [],
    ...options,
  };
}

test("source collections preserve the installed source's popular order", () => {
  const collections = buildSourceEBookCollections([
    book("3", "Third"),
    book("1", "First"),
    book("2", "Second"),
  ]);
  const popular = collections.find((collection) => collection.id === "catalog:popular");
  assert.deepEqual(popular?.books.map((item) => item.title), ["Third", "First", "Second"]);
});

test("popular eBooks prefer the installed source and fall back to metadata", () => {
  const source = [book("source", "Source Popular")];
  const metadata = [book("metadata", "Metadata Popular", { source: "google" })];
  assert.equal(preferredEBookPopular(source, metadata), source);
  assert.equal(preferredEBookPopular([], metadata), metadata);
  assert.equal(preferredEBookPopular(null, metadata), null);
});

test("source collections group distinct source books by explicit series title", () => {
  const collections = buildSourceEBookCollections([
    book("1", "Story One", { seriesTitle: "The Story Cycle" }),
    book("2", "Story Two", { seriesTitle: "The Story Cycle" }),
    book("3", "Unrelated"),
  ]);
  const series = collections.find((collection) => collection.id === "series:the story cycle");
  assert.equal(series?.kind, "series");
  assert.deepEqual(series?.books.map((item) => item.title), ["Story One", "Story Two"]);
});

test("collection cache scopes include every installed provider", () => {
  assert.equal(eBookCollectionCacheScope("all", ["z", "all", "a"]), "all::a|z");
});

test("source collections expose curated awards instead of genre shelves", () => {
  const collections = buildSourceEBookCollections([
    book("1", "Dune", { genres: ["Science fiction"] }),
    book("2", "Unrelated", { genres: ["Science fiction"] }),
  ]);
  assert.ok(collections.some((collection) => collection.id === "award:hugo"));
  assert.ok(collections.some((collection) => collection.id === "award:nebula"));
  assert.ok(collections.every((collection) => !collection.id.startsWith("catalog:genre:")));
});

test("award matching recognizes Arabic title aliases from the source", () => {
  assert.equal(
    findAwardSourceBook({ title: "Dune", aliases: ["كثيب"] }, [book("1", "كثيب")])?.id,
    "source:demo:1",
  );
});
