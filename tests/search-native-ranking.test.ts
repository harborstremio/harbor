// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { isBetterSearchMatch } from "../src/lib/search-query.ts";

test("an exact Chinese original title outranks a more popular unrelated show", () => {
  const match = { name: "Pursuit of Jade", original_name: "逐玉", popularity: 10 };
  const unrelated = { name: "Jade Dynasty", original_name: "诛仙", popularity: 1000 };
  assert.equal(isBetterSearchMatch("逐玉", match, unrelated), true);
  assert.equal(isBetterSearchMatch("逐玉", unrelated, match), false);
  assert.equal(match.name, "Pursuit of Jade");
});

test("normalizes full-width names, case and whitespace without translating queries", () => {
  assert.equal(
    isBetterSearchMatch(
      "  ＢＡＴＭＡＮ  ",
      { title: "Batman", popularity: 1 },
      { title: "Batman Returns", popularity: 100 },
    ),
    true,
  );
  assert.equal(
    isBetterSearchMatch(
      "千と千尋の神隠し",
      { title: "Spirited Away", original_title: "千と千尋の神隠し", popularity: 1 },
      { title: "Other", popularity: 100 },
    ),
    true,
  );
});

test("retains popularity tie-breaking when neither or both titles match exactly", () => {
  assert.equal(
    isBetterSearchMatch(
      "Jade",
      { name: "Pursuit of Jade", popularity: 10 },
      { name: "Jade Dynasty", popularity: 100 },
    ),
    false,
  );
  assert.equal(
    isBetterSearchMatch(
      "Jade",
      { name: "Jade", popularity: 100 },
      { name: "Jade", popularity: 10 },
    ),
    true,
  );
});
