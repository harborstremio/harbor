// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const carousel = readFileSync(
  new URL("../src/components/hero-carousel.tsx", import.meta.url),
  "utf8",
);

test("hero controls do not start carousel dragging", () => {
  assert.match(
    carousel,
    /e\.target\.closest\("button, a, input, select, textarea, \[role='button'\]"\)/,
  );
});

test("carousel arrows keep accessible targets without overlapping hero actions", () => {
  assert.match(carousel, /start-0 z-30 my-auto flex h-14 w-14 items-center justify-center/);
  assert.match(carousel, /end-0 z-30 my-auto flex h-14 w-14 items-center justify-center/);
  assert.doesNotMatch(carousel, /h-2\/3 w-\[14%\] max-w-\[120px\]/);
});
