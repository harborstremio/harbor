// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const source = readFileSync(new URL("../src/lib/ebook/providers.ts", import.meta.url), "utf8");
const scan = source.slice(
  source.indexOf("const LOCAL_SCAN_MAX_DEPTH"),
  source.indexOf("const gutendexEpubs"),
);

test("the library walk goes deeper than one folder", () => {
  // Author/Book/Book.epub is as common as a flat folder, and one pass found neither.
  assert.match(scan, /walk\(await localJoin\(dir, item\.name\), item\.name, depth \+ 1\)/);
  assert.match(scan, /await walk\(source\.location, "", 0\)/, "the chosen folder is the root");
});

test("the walk is bounded in both depth and breadth", () => {
  // readDir follows symlinks, so an unbounded walk can loop or swallow a whole drive.
  assert.match(scan, /depth > LOCAL_SCAN_MAX_DEPTH \|\| visited >= LOCAL_SCAN_MAX_DIRS/);
  assert.match(source, /const LOCAL_SCAN_MAX_DEPTH = \d+;/);
  assert.match(source, /const LOCAL_SCAN_MAX_DIRS = \d+;/);
});

test("a folder is titled by its own name, never by a split path", () => {
  // Windows separates with a backslash, so slicing the path string titles books wrong.
  assert.match(scan, /title: localTitle\(name\)/);
  assert.doesNotMatch(scan, /dir\.split\(/);
});

test("loose files at the top stay separate books while a folder groups its volumes", () => {
  assert.match(scan, /if \(!name\)/, "only the root treats loose epubs as individual books");
  assert.match(scan, /paths: await Promise\.all\(epubs\.map/, "a book folder keeps every volume");
});
