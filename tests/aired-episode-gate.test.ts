// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { airedOnly } from "../src/lib/aired.ts";

const DAY = 86_400_000;
const past = (n: number) => new Date(Date.now() - n * DAY).toISOString();
const future = (n: number) => new Date(Date.now() + n * DAY).toISOString();

type Ep = { episode: number; rel: string | null };

function season(): Ep[] {
  const eps: Ep[] = [];
  for (let i = 1; i <= 17; i++) eps.push({ episode: i, rel: past(200 - i) });
  for (let i = 18; i <= 20; i++) eps.push({ episode: i, rel: future(i - 17) });
  for (let i = 21; i <= 24; i++) eps.push({ episode: i, rel: null });
  return eps;
}

test("an undated episode past the last aired one is never treated as released", () => {
  const kept = airedOnly(season(), (e) => e.rel).map((e) => e.episode);
  assert.deepEqual(kept, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
});

test("a fully undated series still marks completely", () => {
  const eps: Ep[] = [1, 2, 3].map((episode) => ({ episode, rel: null }));
  assert.deepEqual(
    airedOnly(eps, (e) => e.rel).map((e) => e.episode),
    [1, 2, 3],
  );
});

test("an undated episode between two aired ones is kept", () => {
  const eps: Ep[] = [
    { episode: 1, rel: past(30) },
    { episode: 2, rel: null },
    { episode: 3, rel: past(10) },
    { episode: 4, rel: null },
  ];
  assert.deepEqual(
    airedOnly(eps, (e) => e.rel).map((e) => e.episode),
    [1, 2, 3],
  );
});

test("mark all watched runs the same aired rule as mark season", () => {
  const src = readFileSync(new URL("../src/lib/mark-watched.ts", import.meta.url), "utf8");
  assert.match(src, /import \{ airedOnly \} from "@\/lib\/aired"/);
  assert.match(src, /ordered\.sort\(\(a, b\) => a\.season - b\.season \|\| a\.episode - b\.episode\)/);
  assert.match(src, /return airedOnly\(ordered, \(v\) => v\.rel\)/);
  assert.doesNotMatch(
    src,
    /if \(rel\) \{\s+const at = Date\.parse\(rel\)/,
    "the weak rule skipped only dated-future episodes and let undated ones through",
  );
});

test("tracker progress is projected onto aired episodes, not a left-shifted list", () => {
  for (const path of ["../src/lib/anilist/use-anilist-watched.ts", "../src/lib/mal/use-mal-watched.ts"]) {
    const src = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(src, /const sorted = airedOnly\(\s+\[\.\.\.episodesRef\.current\]\.sort\(/, path);
    assert.doesNotMatch(src, /function airedEpisodes/, path);
    assert.doesNotMatch(src, /if \(!e\.airdate\) return true/, path);
  }
});
