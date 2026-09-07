// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { chapterGroupKey, chapterNumberKey, chapterSourceIdFromId, resolveReaderChapters } from "../src/lib/manga/chapter-identity.ts";

test("chapterNumberKey extracts clean numbers", () => {
  assert.equal(chapterNumberKey("5"), "5");
  assert.equal(chapterNumberKey("5.5"), "5.5");
  assert.equal(chapterNumberKey("5,5"), "5.5");
  assert.equal(chapterNumberKey("05"), "5");
  assert.equal(chapterNumberKey("5.50"), "5.5");
  assert.equal(chapterNumberKey("0.5"), "0.5");
});

test("chapterNumberKey tolerates prefixes and punctuation", () => {
  assert.equal(chapterNumberKey("Ch. 5"), "5");
  assert.equal(chapterNumberKey("Chapter 12"), "12");
  assert.equal(chapterNumberKey("chap 3"), "3");
  assert.equal(chapterNumberKey("Vol.2 Ch.5"), "5");
  assert.equal(chapterNumberKey("vol. 3 ch. 5.5"), "5.5");
  assert.equal(chapterNumberKey("vol2ch5"), "5");
});

test("chapterNumberKey returns null for non-numeric labels", () => {
  assert.equal(chapterNumberKey("Extra"), null);
  assert.equal(chapterNumberKey("Oneshot"), null);
  assert.equal(chapterNumberKey(""), null);
  assert.equal(chapterNumberKey(null), null);
  assert.equal(chapterNumberKey(undefined), null);
});

test("chapterGroupKey groups clean numeric chapters across providers", () => {
  const a = chapterGroupKey({ language: "en", chapter: "5" });
  const b = chapterGroupKey({ language: "en", chapter: "5.0" });
  const c = chapterGroupKey({ language: "en", chapter: "Ch. 5" });
  assert.equal(a, b);
  assert.equal(a, c);
});

test("chapterGroupKey ignores volume-only differences", () => {
  const a = chapterGroupKey({ language: "en", chapter: "Vol.2 Ch.5" });
  const b = chapterGroupKey({ language: "en", chapter: "Vol.3 Ch.5" });
  assert.equal(a, b);
});

test("chapterGroupKey title fallback is case-insensitive and whitespace-collapsed", () => {
  const a = chapterGroupKey({ language: "en", chapter: null, title: "  Extra   Chapter " });
  const b = chapterGroupKey({ language: "en", chapter: null, title: "extra chapter" });
  assert.equal(a, b);
});

test("chapterGroupKey distinguishes languages", () => {
  const en = chapterGroupKey({ language: "en", chapter: "5" });
  const ja = chapterGroupKey({ language: "ja", chapter: "5" });
  assert.notEqual(en, ja);
});

test("chapterGroupKey falls back to oneshot", () => {
  assert.equal(chapterGroupKey({ language: "en", chapter: null, title: null }), "en|oneshot");
});

test("chapterSourceIdFromId extracts the prefix before ::", () => {
  assert.equal(chapterSourceIdFromId("p1::chapter-0"), "p1");
  assert.equal(chapterSourceIdFromId("suwayomi::server::42"), "suwayomi");
  assert.equal(chapterSourceIdFromId("no-separator"), "");
});

test("resolveReaderChapters holds the preferred source across chapters", () => {
  const chapters = [
    { id: "p1::c0", chapter: "0", language: "en", publishAt: "2024-01-01T00:00:00Z" },
    { id: "p2::c0", chapter: "0", language: "en", publishAt: "2024-01-02T00:00:00Z" },
    { id: "p3::c0", chapter: "0", language: "en", publishAt: "2024-01-03T00:00:00Z" },
    { id: "p1::c1", chapter: "1", language: "en", publishAt: "2024-01-04T00:00:00Z" },
    { id: "p2::c1", chapter: "1", language: "en", publishAt: "2024-01-05T00:00:00Z" },
    { id: "p3::c1", chapter: "1", language: "en", publishAt: "2024-01-06T00:00:00Z" },
  ];
  const out = resolveReaderChapters(chapters, { sourceId: "p3" });
  assert.deepEqual(out.map((c) => c.id), ["p3::c0", "p3::c1"]);
});

test("resolveReaderChapters falls back to newest when preferred source lacks a chapter", () => {
  const chapters = [
    { id: "p1::c0", chapter: "0", language: "en", publishAt: "2024-01-01T00:00:00Z" },
    { id: "p3::c0", chapter: "0", language: "en", publishAt: "2024-01-06T00:00:00Z" },
    { id: "p1::c1", chapter: "1", language: "en", publishAt: "2024-01-02T00:00:00Z" },
    { id: "p2::c1", chapter: "1", language: "en", publishAt: "2024-01-05T00:00:00Z" },
  ];
  const out = resolveReaderChapters(chapters, { sourceId: "p3" });
  assert.deepEqual(out.map((c) => c.id), ["p3::c0", "p2::c1"]);
});

test("resolveReaderChapters picks newest per group without a preference", () => {
  const chapters = [
    { id: "p1::c0", chapter: "0", language: "en", publishAt: "2024-01-01T00:00:00Z" },
    { id: "p2::c0", chapter: "0", language: "en", publishAt: "2024-01-02T00:00:00Z" },
    { id: "p1::c1", chapter: "1", language: "en", publishAt: "2024-01-04T00:00:00Z" },
    { id: "p3::c1", chapter: "1", language: "en", publishAt: "2024-01-06T00:00:00Z" },
  ];
  const out = resolveReaderChapters(chapters);
  assert.deepEqual(out.map((c) => c.id), ["p2::c0", "p3::c1"]);
});

test("resolveReaderChapters sorts ascending by chapter number", () => {
  const chapters = [
    { id: "p1::c3", chapter: "3", language: "en" },
    { id: "p1::c1", chapter: "1", language: "en" },
    { id: "p1::c10", chapter: "10", language: "en" },
    { id: "p1::c2", chapter: "2", language: "en" },
  ];
  const out = resolveReaderChapters(chapters);
  assert.deepEqual(out.map((c) => c.id), ["p1::c1", "p1::c2", "p1::c3", "p1::c10"]);
});

test("resolveReaderChapters handles non-numeric labels via title fallback", () => {
  const chapters = [
    { id: "p1::extra", chapter: "Extra", language: "en" },
    { id: "p1::c1", chapter: "1", language: "en" },
  ];
  const out = resolveReaderChapters(chapters);
  assert.deepEqual(out.map((c) => c.id), ["p1::c1", "p1::extra"]);
});