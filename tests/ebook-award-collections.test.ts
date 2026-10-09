import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const api = readFileSync(new URL("../src/lib/ebook/api.ts", import.meta.url), "utf8");
const view = readFileSync(new URL("../src/views/ebook.tsx", import.meta.url), "utf8");

test("eBook award collections use confirmed Wikidata award relationships", () => {
  assert.match(api, /wdt:P166/);
  assert.match(api, /pq:P1686/);
  assert.match(api, /kind:\s*"award"/);
});

test("the Collections screen resolves curated awards through installed sources", () => {
  assert.match(view, /collection\.kind === "award"/);
  assert.match(view, /searchSourceEBookCatalog\(title, providerId\)/);
  assert.match(view, /Award Winners/);
});
