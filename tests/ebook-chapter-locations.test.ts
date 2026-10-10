import assert from "node:assert/strict";
import test from "node:test";
import {
  ebookLegacyNavigation,
  ebookLocationResolver,
  ebookTextIdentity,
  type EBookChapterLocationSource,
} from "../src/lib/ebook/chapter-locations.ts";
import {
  addEBookBookmark,
  loadEBookAnnotations,
  loadEBookBookmarks,
  loadEBookProgress,
  loadEBookResume,
  migrateEBookChapterLocations,
  saveEBookAnnotation,
  saveEBookProgress,
  saveEBookResume,
} from "../src/lib/ebook/reader-state.ts";

const id = (path: string, owner = "2701") => JSON.stringify([owner, path]);
const source = (path: string, text: string, position = 0): EBookChapterLocationSource => ({
  chapter: { id: id(path), title: path, position, legacy: !path.includes("#") },
  text,
  progressKnownOriginal: true,
});
const legacy = source(
  "book.xhtml",
  "Chapter One\n\nRepeated\n\nFirst paragraph.\n\nChapter Two\n\nRepeated\n\nSecond paragraph.",
);
const sources = [
  source("book.xhtml#one", "Chapter One\n\nRepeated\n\nFirst paragraph."),
  source("book.xhtml#two", "Chapter Two\n\nRepeated\n\nSecond paragraph.", 1),
];
const migrate = (legacySources = [legacy]) =>
  migrateEBookChapterLocations(
    "profile",
    "book",
    sources.map((source) => source.chapter),
    sources,
    legacySources,
  );

function storage() {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      get length() { return values.size; },
      key: (index: number) => [...values.keys()][index] ?? null,
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { addEventListener() {}, dispatchEvent() {} },
  });
  return values;
}

test("paragraph migration follows content and nearby context across real chapter boundaries", () => {
  const resolve = ebookLocationResolver(sources);
  assert.equal(resolve(legacy, 4)?.chapter.id, sources[1].chapter.id);
  assert.equal(resolve(legacy, 4)?.line, 1);
  assert.equal(resolve(legacy, 5)?.line, 2);
  assert.equal(resolve(legacy, 99), null);
});

test("ambiguous, changed, translated and other-volume paragraphs never receive guessed locations", () => {
  const repeated = source("book.xhtml", "Repeated");
  assert.equal(ebookLocationResolver(sources)(repeated, 0), null);
  assert.equal(ebookLocationResolver(sources)(source("book.xhtml", "Changed"), 0), null);
  assert.equal(ebookLocationResolver(sources)({ ...legacy, translated: true }, 2), null);
  assert.equal(
    ebookLocationResolver(sources)(
      { ...legacy, chapter: { ...legacy.chapter, id: id("book.xhtml", "other-volume") } },
      2,
    ),
    null,
  );
});

test("resume, bookmark and annotation offsets migrate without deleting legacy state or changing recency", () => {
  const values = storage();
  const oldResume = saveEBookResume("profile", "book", {
    chapterId: legacy.chapter.id,
    chapterTitle: "Original title",
    chapterIndex: 7,
    totalChapters: 11,
  });
  saveEBookProgress("profile", "book", `${legacy.chapter.id}:harbor`, 5);
  addEBookBookmark("profile", {
    bookId: "book",
    chapterId: legacy.chapter.id,
    chapterTitle: "Original title",
    line: 2,
    preview: "First paragraph.",
  });
  saveEBookAnnotation("profile", "book", {
    chapterId: legacy.chapter.id,
    ranges: [{ line: 2, start: 0, end: 5 }],
    text: "First",
    color: "orange",
    density: 50,
    title: "Note",
    body: "Keep me",
    tags: [],
    reference: false,
  });
  const remaining = migrate();
  assert.deepEqual(remaining, []);
  assert.equal(loadEBookResume("profile", "book")?.chapterId, sources[1].chapter.id);
  assert.equal(loadEBookResume("profile", "book")?.updatedAt, oldResume.updatedAt);
  assert.equal(loadEBookResume("profile", "book")?.chapterIndex, 1);
  assert.equal(loadEBookProgress("profile", "book", `${sources[1].chapter.id}:harbor`), 2);
  assert.equal(loadEBookProgress("profile", "book", `${legacy.chapter.id}:harbor`), 5);
  assert.equal(loadEBookBookmarks("profile", "book")[0].chapterId, sources[0].chapter.id);
  assert.equal(loadEBookBookmarks("profile", "book")[0].line, 2);
  assert.equal(loadEBookAnnotations("profile", "book")[0].body, "Keep me");
  assert.equal(loadEBookAnnotations("profile", "book")[0].chapterId, sources[0].chapter.id);
  assert.ok([...values.keys()].some((key) => key.startsWith("harbor.ebook.chapter-migration.v1.")));
  assert.equal(loadEBookResume("other-profile", "book"), null);
  saveEBookProgress("profile", "book", `${sources[1].chapter.id}:harbor`, 1);
  migrate();
  assert.equal(loadEBookProgress("profile", "book", `${sources[1].chapter.id}:harbor`), 1);
});

test("translated resume and annotations spanning new chapters keep readable legacy IDs", () => {
  storage();
  saveEBookResume("profile", "book", { chapterId: legacy.chapter.id, chapterTitle: "Original title" });
  saveEBookProgress("profile", "book", `${legacy.chapter.id}:harbor`, 2);
  const translated = { ...legacy, translated: true };
  const remaining = migrate([translated]);
  assert.equal(remaining[0].id, legacy.chapter.id);
  assert.equal(loadEBookResume("profile", "book")?.chapterId, legacy.chapter.id);
  storage();
  saveEBookAnnotation("profile", "book", {
    chapterId: legacy.chapter.id,
    ranges: [{ line: 2, start: 0, end: 16 }, { line: 3, start: 0, end: 11 }],
    text: "First paragraph. Chapter Two",
    color: "orange",
    density: 50,
    title: "Boundary note",
    body: "Keep both ranges",
    tags: [],
    reference: false,
  });
  const unresolved = migrate();
  assert.equal(unresolved[0].id, legacy.chapter.id);
  assert.equal(loadEBookAnnotations("profile", "book")[0].chapterId, legacy.chapter.id);
  assert.equal(loadEBookAnnotations("profile", "book")[0].ranges.length, 2);
});

test("a saved text identity prevents remapping a changed or translated resume", () => {
  storage();
  saveEBookResume("profile", "book", {
    chapterId: legacy.chapter.id,
    chapterTitle: "Original title",
    textIdentity: ebookTextIdentity("Translated text"),
  });
  saveEBookProgress("profile", "book", `${legacy.chapter.id}:harbor`, 2);
  migrate();
  assert.equal(loadEBookResume("profile", "book")?.chapterId, legacy.chapter.id);
});

test("unproven progress remains on a legacy chapter when saved translations may exist", () => {
  storage();
  saveEBookResume("profile", "book", {
    chapterId: legacy.chapter.id,
    chapterTitle: "Original title",
  });
  saveEBookProgress("profile", "book", `${legacy.chapter.id}:harbor`, 5);
  const remaining = migrateEBookChapterLocations(
    "profile",
    "book",
    sources.map((source) => source.chapter),
    sources,
    [{ ...legacy, progressKnownOriginal: false }],
  );
  assert.equal(remaining[0].id, legacy.chapter.id);
  assert.equal(loadEBookResume("profile", "book")?.chapterId, legacy.chapter.id);
  assert.equal(loadEBookProgress("profile", "book", `${sources[1].chapter.id}:harbor`), 0);
});

test("legacy Next continues inside a real chapter split across EPUB files", () => {
  const split = [
    source("a.xhtml#one", "Chapter One\n\nOpening.\n\nContinuation."),
    source("b.xhtml#two", "Chapter Two\n\nSecond chapter.", 1),
  ];
  const firstFile = source("a.xhtml", "Chapter One\n\nOpening.");
  assert.deepEqual(ebookLegacyNavigation(firstFile, split), {
    position: 0,
    legacyNext: { chapterId: split[0].chapter.id, line: 2 },
  });
  const complete = source("a.xhtml", split[0].text);
  assert.deepEqual(ebookLegacyNavigation(complete, split).legacyNext, {
    chapterId: split[1].chapter.id,
    line: 0,
  });
});

test("text identities distinguish both halves of UTF-16 surrogate pairs", () => {
  assert.notEqual(ebookTextIdentity("😀"), ebookTextIdentity("😁"));
});
