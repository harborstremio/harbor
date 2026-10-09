import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

function searchFixture(fetcher: (url: string) => Promise<unknown>, fastDeadline = false) {
  const output = ts.transpileModule(readFileSync("src/lib/search-addons.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const api: any = {};
  new Function("require", "exports", "setTimeout", "clearTimeout", output)(
    (name: string) => {
      if (name === "./addons") return { isCollectionCatalog: () => false };
      if (name === "./safe-fetch") return { safeFetch: fetcher };
      throw Error(`Unexpected dependency: ${name}`);
    }, api, fastDeadline ? (fn: () => void) => setTimeout(fn, 5) : setTimeout, clearTimeout,
  );
  return api.searchAddonCatalogs;
}

test("fused search includes mixed-case movie/show types without altering protocol paths", async () => {
  const fetched: string[] = [];
  const search = searchFixture(async url => {
    fetched.push(url);
    const type = decodeURIComponent(new URL(url).pathname.split("/")[2]);
    return new Response(JSON.stringify({ metas: [{ id: "provider:7", type, name: type }] }));
  });
  const result = await search([{ transportUrl: "https://addon.invalid/manifest.json", manifest: { id: "fixture", name: "Fixture", catalogs: [
    { type: "Movie", id: "new/movies", extraSupported: ["search"] },
    { type: "Series", id: "new/shows", extra: [{ name: "search" }] },
  ] } }], "test / query");
  assert.equal(result.movies.length, 1);
  assert.equal(result.series.length, 1);
  assert.equal(result.movies[0].id, result.series[0].id);
  assert.ok(fetched.some(url => url.includes("/Movie/new%2Fmovies/search=test%20%2F%20query.json")));
  assert.ok(fetched.some(url => url.includes("/Series/new%2Fshows/")));
});

test("a stalled catalog body does not hide a working addon's fused results", async () => {
  const search = searchFixture(async url => url.includes("stalled.invalid")
    ? { ok: true, json: () => new Promise(() => {}) }
    : new Response(JSON.stringify({ metas: [{ id: "fixture:good", type: "movie", name: "Good result" }] })), true);
  const addons = ["stalled", "working"].map(name => ({ transportUrl: `https://${name}.invalid/manifest.json`, manifest: { id: name, name, catalogs: [{ type: "movie", id: "movies", extraSupported: ["search"] }] } }));
  const result = await search(addons, "fixture");
  assert.deepEqual(result.movies.map((x: any) => x.id), ["fixture:good"]);
});
