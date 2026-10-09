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
  assert.match(guide, /"version": "1\.7\.0"/);
});
