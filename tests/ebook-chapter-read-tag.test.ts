import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("completed eBook chapters receive a durable Read tag", async () => {
  const [state, reader, view] = await Promise.all([
    readFile(new URL("../src/lib/ebook/reader-state.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/views/ebook/harbor-reader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/views/ebook.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(state, /markEBookChapterRead/);
  assert.match(reader, /chapterProgress >= 100.*markEBookChapterRead/);
  assert.match(view, /completed\.has\(chapter\.id\) && <EBookChapterReadMark/);
});
