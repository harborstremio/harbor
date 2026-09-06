import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const guide = await readFile(
  new URL("../src/views/manga/manga-sources-panel/plugin-guide.tsx", import.meta.url),
  "utf8",
);

test("eBook plugin downloads document browse-filter metadata", () => {
  for (const field of ["originalLanguage?: string", "score?: number", "trendingScore?: number"])
    assert.match(guide, new RegExp(field.replace("?", "\\?")));
  for (const tag of [
    "status:ongoing",
    "status:completed",
    "status:hiatus",
    "sort:popular",
    "sort:chapters",
    "sort:rating",
  ])
    assert.match(guide, new RegExp(tag));
});

test("eBook example manifest is current and explicitly typed", () => {
  assert.match(guide, /"type": "ebook"/);
  assert.match(guide, /"version": "2\.0\.2"/);
  assert.match(guide, /timeoutMs: 45000/);
  assert.match(guide, /provider method alive for 50,000 ms/);
});

test("eBook plugin reference documents optional audiobook support", () => {
  assert.match(guide, /audiobookChapters\?\(id: string\)/);
  assert.match(guide, /audiobookStream\?\(chapterId: string\)/);
  assert.match(guide, /async audiobookChapters\(id\)/);
  assert.match(guide, /async audiobookStream\(chapterId\)/);
  assert.match(guide, /Return EVERY audio chapter in playback order/);
  assert.match(guide, /Do not return only the first/);
  assert.match(guide, /selected chapter's own audio URL/);
  assert.match(guide, /chapterStart\?: string/);
  assert.match(guide, /return one audio track rather\s+than inventing timestamps/);
  assert.match(guide, /There\s+is no audiobook flag in repo\.json/);
  assert.match(guide, /audiobook\?: boolean/);
  assert.match(guide, /audiobook: true/);
  assert.match(guide, /label it on the eBook home page/);
  assert.match(guide, /saves listening progress separately from reading/);
});

test("eBook plugin guide splits complete-book text into logical chapters", () => {
  assert.match(guide, /function splitFullBookText\(value\)/);
  assert.match(guide, /discard duplicate headings from the table of contents/);
  assert.match(guide, /Never return the\s+complete book body for every chapter/);
  assert.match(guide, /PDF-only source requires text supplied by the source or Harbor-side extraction/);
});
