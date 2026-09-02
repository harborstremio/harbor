// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const source = readFileSync(
  new URL("../src/views/player/hooks/use-resume-autosave.ts", import.meta.url),
  "utf8",
);

test("a signed-out movie rewatch keeps updating its local Continue Watching entry", () => {
  assert.match(source, /movieWasWatched \|\| localCwEntry\(id\) !== null/);
  assert.match(source, /rewatchMovie[\s\S]*?saveLocalCw\(/);
});

test("finishing a movie clears the local Continue Watching entry", () => {
  assert.match(
    source,
    /if \(s\.meta\.type === "movie" && finished\) \{\s*setMovieWatchedLocal\(id, true\);\s*clearLocalCw\(id\);/,
  );
});
