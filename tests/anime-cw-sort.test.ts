// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import ts from "typescript";
import type { LibraryItem } from "../src/lib/stremio";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function sortHarness(resumeTimes: Map<string, number>) {
  const helper = read("src/lib/stremio.ts").match(/export function cwSortKey\([\s\S]*?\n\}/)?.[0];
  assert.ok(helper, "shared CW sort helper must exist");
  const anime = read("src/views/anime.tsx");
  const rail = anime.slice(anime.indexOf("const continueWatching = useMemo"));
  const comparator = rail.match(/\.sort\(([\s\S]*?)\)\s*\.filter\(/)?.[1];
  assert.ok(comparator, "Anime CW sorts before franchise deduplication");
  // Execute the actual helper and rail comparator without mounting the app or using account data.
  const code = ts.transpileModule(
    `${helper}\nexport const compare = (${comparator.trim().replace(/,$/, "")});`,
    {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    },
  ).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "resumeForItem", code)(
    module,
    module.exports,
    (item: LibraryItem) => ({ t: resumeTimes.get(item._id) ?? 0 }),
  );
  return module.exports as { compare: (a: LibraryItem, b: LibraryItem) => number };
}

function item(id: string, date: string): LibraryItem {
  return {
    _id: id,
    type: "series",
    name: id,
    removed: false,
    _mtime: date,
    state: { lastWatched: date, timeOffset: 100, duration: 1000 },
  };
}

test("Anime CW puts freshly resumed items ahead of newer cloud timestamps", () => {
  const resumed = item("resume", "2026-09-01T00:00:00Z");
  const cloud = item("cloud", "2026-09-10T00:00:00Z");
  const h = sortHarness(new Map([[resumed._id, Date.parse("2026-09-12T00:00:00Z")]]));
  assert.deepEqual(
    [cloud, resumed].sort(h.compare).map((i) => i._id),
    ["resume", "cloud"],
  );
});

test("Anime CW retains timestamp ordering without local resume and handles missing dates", () => {
  const h = sortHarness(new Map());
  const older = item("older", "2026-09-01T00:00:00Z");
  const newer = item("newer", "2026-09-10T00:00:00Z");
  const missing = item("missing", "invalid");
  assert.deepEqual(
    [missing, older, newer].sort(h.compare).map((i) => i._id),
    ["newer", "older", "missing"],
  );
  assert.equal(h.compare(older, older), 0);
});
