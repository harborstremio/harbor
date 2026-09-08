import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

type SummaryInput = {
  keys: string[] | null;
  local: (key: string) => boolean | undefined;
  providers: Array<{ provider: string; watched: Set<string> | null }>;
};
type Summary = {
  status: "watched" | "unwatched" | "partial" | "unknown";
  watched: number;
  total: number;
  unavailable: string[];
};
type Summarize = (input: SummaryInput) => Summary;

let summarize: Summarize | undefined;
function summary(input: SummaryInput): Summary {
  if (!summarize) {
    const path = new URL("../src/lib/context-watched-state.ts", import.meta.url);
    assert.ok(existsSync(path), "The shared watched-state reader must provide a pure summary");
    const output = ts.transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const module = { exports: {} as { summarizeContextWatched?: Summarize } };
    // The hook and account readers share this module; the pure summary must not
    // call them or touch real account/storage state.
    new Function("require", "module", "exports", output)(() => ({}), module, module.exports);
    summarize = module.exports.summarizeContextWatched;
    assert.equal(typeof summarize, "function", "Missing shared watched-state summary");
  }
  return summarize!(input);
}

const noManual = () => undefined;

test("provider-only movie history is known watched without a local flag", () => {
  assert.deepEqual(
    summary({
      keys: ["movie"],
      local: noManual,
      providers: [{ provider: "Trakt", watched: new Set(["movie"]) }],
    }),
    { status: "watched", watched: 1, total: 1, unavailable: [] },
  );
});

test("explicit manual unwatched overrides provider history", () => {
  assert.deepEqual(
    summary({
      keys: ["1:1"],
      local: () => false,
      providers: [{ provider: "Stremio", watched: new Set(["1:1"]) }],
    }),
    { status: "unwatched", watched: 0, total: 1, unavailable: [] },
  );
});

test("manual watched evidence remains known when a provider is unavailable", () => {
  assert.deepEqual(
    summary({
      keys: ["movie"],
      local: () => true,
      providers: [{ provider: "Trakt", watched: null }],
    }),
    { status: "watched", watched: 1, total: 1, unavailable: ["Trakt"] },
  );
});

test("explicit manual unwatched remains known when a provider cannot be read", () => {
  assert.deepEqual(
    summary({
      keys: ["1:1"],
      local: () => false,
      providers: [{ provider: "Trakt", watched: null }],
    }),
    { status: "unwatched", watched: 0, total: 1, unavailable: ["Trakt"] },
  );
});

test("all released episodes can be covered by different providers", () => {
  assert.deepEqual(
    summary({
      keys: ["1:1", "1:2", "2:1"],
      local: noManual,
      providers: [
        { provider: "Stremio", watched: new Set(["1:1", "1:2"]) },
        { provider: "Trakt", watched: new Set(["2:1"]) },
      ],
    }),
    { status: "watched", watched: 3, total: 3, unavailable: [] },
  );
});

test("some watched released episodes produce partial title progress", () => {
  assert.deepEqual(
    summary({
      keys: ["1:1", "1:2", "1:3"],
      local: (key) => (key === "1:2" ? false : undefined),
      providers: [{ provider: "Trakt", watched: new Set(["1:1", "1:2"]) }],
    }),
    { status: "partial", watched: 1, total: 3, unavailable: [] },
  );
});

test("absent history is unwatched only after all connected providers were read", () => {
  assert.deepEqual(
    summary({
      keys: ["1:1"],
      local: noManual,
      providers: [
        { provider: "Stremio", watched: new Set() },
        { provider: "Trakt", watched: new Set() },
      ],
    }),
    { status: "unwatched", watched: 0, total: 1, unavailable: [] },
  );
});

test("local-only absent history is known unwatched", () => {
  assert.deepEqual(summary({ keys: ["movie"], local: noManual, providers: [] }), {
    status: "unwatched",
    watched: 0,
    total: 1,
    unavailable: [],
  });
});

test("an unavailable provider prevents absent history from becoming unwatched", () => {
  assert.deepEqual(
    summary({
      keys: ["1:1"],
      local: noManual,
      providers: [
        { provider: "Stremio", watched: new Set() },
        { provider: "Trakt", watched: null },
      ],
    }),
    { status: "unknown", watched: 0, total: 1, unavailable: ["Trakt"] },
  );
});

test("known positive progress stays partial when the remaining history is unreadable", () => {
  assert.deepEqual(
    summary({
      keys: ["1:1", "1:2"],
      local: noManual,
      providers: [
        { provider: "Stremio", watched: new Set(["1:1"]) },
        { provider: "Trakt", watched: null },
      ],
    }),
    { status: "partial", watched: 1, total: 2, unavailable: ["Trakt"] },
  );
});

test("unknown episode metadata cannot claim title completion", () => {
  assert.deepEqual(
    summary({
      keys: null,
      local: () => true,
      providers: [{ provider: "Stremio", watched: new Set(["1:1"]) }],
    }),
    { status: "unknown", watched: 0, total: 0, unavailable: [] },
  );
});

test("episode evidence matches only the exact normalized target key", () => {
  const providers = [{ provider: "Trakt", watched: new Set(["2:1"]) }];
  assert.deepEqual(summary({ keys: ["1:13"], local: noManual, providers }), {
    status: "unwatched",
    watched: 0,
    total: 1,
    unavailable: [],
  });
  assert.deepEqual(summary({ keys: ["2:1"], local: noManual, providers }), {
    status: "watched",
    watched: 1,
    total: 1,
    unavailable: [],
  });
});
