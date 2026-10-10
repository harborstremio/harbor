import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { matchEpisodeFileIndex } from "../src/lib/streams/episode-file.ts";
import { hashFromMagnet, magnetFromHash } from "../src/lib/debrid/types.ts";

const links = [
  { link: "https://fixture.invalid/episode1", filename: "Show.S01E01.mkv", size: 200 },
  { link: "https://fixture.invalid/episode2", filename: "Show.S01E02.mkv", size: 100 },
];
const ready = { id: 42, statusCode: 4, links };

function fixture(magnets: unknown) {
  const requests: URL[] = [];
  const mocks: Record<string, unknown> = {
    "@/lib/debug": { dlog() {}, dwarn() {} },
    "@/lib/streams/episode-file": { matchEpisodeFileIndex },
    "./types": { hashFromMagnet, magnetFromHash },
    "@/lib/safe-fetch": { safeFetch: async (url: string) => {
      const parsed = new URL(url);
      requests.push(parsed);
      let data: unknown;
      if (parsed.pathname.endsWith("/magnet/upload")) data = { magnets: [{ id: 42 }] };
      else if (parsed.pathname.endsWith("/magnet/status")) data = { magnets };
      else if (parsed.pathname.endsWith("/link/unlock")) {
        data = { link: parsed.searchParams.get("link"), filename: "Show.mkv", filesize: 200 };
      } else throw new Error(`Unexpected fixture path: ${parsed.pathname}`);
      return { ok: true, status: 200, json: async () => ({ status: "success", data }) };
    } },
  };
  const compiled = ts.transpileModule(readFileSync("src/lib/debrid/alldebrid.ts", "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports: Record<string, any> = {};
  new Function("require", "exports", "setTimeout", "clearTimeout", compiled)((id: string) => {
    assert.ok(Object.hasOwn(mocks, id), `Unexpected dependency: ${id}`);
    return mocks[id];
  }, exports, (fn: () => void) => { queueMicrotask(fn); return 1; }, () => {});
  return { client: exports.createAllDebrid("fixture-key"), requests };
}

for (const shape of ["array", "singleton"] as const) {
  test(`ready ${shape} response resolves the selected magnet immediately`, async () => {
    const f = fixture(shape === "array" ? [ready] : ready);
    const result = await f.client.playableUrl("fixture-hash", undefined, new AbortController().signal);
    assert.equal(result.ok, true);
    assert.equal(result.data.url, links[0].link);
    assert.equal(f.requests.length, 3, "upload, one status, unlock; no needless polling");
  });
}

test("selects the requested ID from an array instead of the first magnet", async () => {
  const f = fixture([{ ...ready, id: 99, links: [{ ...links[0], link: "https://fixture.invalid/wrong" }] }, ready]);
  const result = await f.client.playableUrl("fixture-hash", undefined, new AbortController().signal);
  assert.equal(result.ok, true);
  assert.equal(result.data.url, links[0].link);
});

test("accepts a string-encoded response ID without mixing up magnets", async () => {
  const f = fixture([{ ...ready, id: "42" }]);
  const result = await f.client.playableUrl("fixture-hash", undefined, new AbortController().signal);
  assert.equal(result.ok, true);
});

test("terminal status for the requested magnet is returned without polling", async () => {
  const f = fixture([{ ...ready, statusCode: 5 }]);
  const result = await f.client.playableUrl("fixture-hash", undefined, new AbortController().signal);
  assert.equal(result.ok, false);
  assert.equal(result.code, "status-5");
  assert.equal(f.requests.length, 2);
});

test("a missing requested ID never unlocks a different ready magnet", async () => {
  const f = fixture([{ ...ready, id: 99 }]);
  const result = await f.client.playableUrl("fixture-hash", undefined, new AbortController().signal);
  assert.equal(result.ok, false);
  assert.equal(result.code, "no-link");
  assert.equal(f.requests.filter((url) => url.pathname.endsWith("/magnet/status")).length, 12);
  assert.equal(f.requests.some((url) => url.pathname.endsWith("/link/unlock")), false);
});

test("array normalization preserves explicit file index and episode matching", async () => {
  const f = fixture([ready]);
  const hinted = await f.client.playableUrl("fixture-hash", undefined, new AbortController().signal,
    { season: 1, episode: 2 });
  assert.equal(hinted.ok, true);
  assert.equal(hinted.data.url, links[1].link);
  const explicit = await f.client.playableUrl("fixture-hash", 0, new AbortController().signal,
    { season: 1, episode: 2 });
  assert.equal(explicit.ok, true);
  assert.equal(explicit.data.url, links[0].link);
});
