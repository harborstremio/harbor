// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const gql = readFileSync(
  new URL("../src/lib/manga/sources/suwayomi/graphql.ts", import.meta.url),
  "utf8",
);

test("saved manga detail reads the server DB before any live source fetch", () => {
  const fn = gql.match(/export async function gqlManga\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn, "gqlManga must exist");
  const query = fn.indexOf("manga(id: ${mangaId})");
  const mutation = fn.indexOf("fetchMangaAndChapters");
  assert.ok(query >= 0, "must query the cached manga row");
  assert.ok(mutation > query, "live fetch is only the fallback, never the primary path");
  assert.match(fn, /cached\.initialized !== false/);
});

test("saved manga chapters read the server DB before any live source fetch", () => {
  const fn = gql.match(/export async function gqlChapters\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn, "gqlChapters must exist");
  const query = fn.indexOf("chapters(condition: { mangaId: ${mangaId} })");
  const mutation = fn.indexOf("fetchChapters(input:");
  assert.ok(query >= 0, "must query cached chapters");
  assert.ok(mutation > query, "fetchChapters is only the empty-DB prime fallback");
  assert.match(fn, /cachedNodes\.length > 0\) return mapGqlChapters\(cachedNodes\);/);
});

test("graphql failures still fall through to REST", () => {
  assert.match(gql, /if \(data == null && fdata == null\) throw new Error\("suwayomi_graphql_error"\);/);
});

test("refs with an empty sourceId still decode (fetch only needs mangaId)", () => {
  const model = readFileSync(
    new URL("../src/lib/manga/sources/suwayomi/model.ts", import.meta.url),
    "utf8",
  );
  const mangaFn = model.match(/export function decodeMangaId\([\s\S]*?\n\}/)?.[0];
  const chapterFn = model.match(/export function decodeChapterId\([\s\S]*?\n\}/)?.[0];
  assert.ok(mangaFn && chapterFn);
  assert.match(mangaFn, /if \(!mangaId\) return null;/);
  assert.ok(!/!sourceId \|\| !mangaId/.test(mangaFn), "empty sourceId must not kill manga decode");
  assert.match(chapterFn, /if \(!mangaId \|\| !key\) return null;/);
  assert.ok(!/!sourceId \|\| !mangaId \|\| !key/.test(chapterFn), "empty sourceId must not kill chapter decode");
});
