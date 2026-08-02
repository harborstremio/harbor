// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const themes = read("src/lib/voyage/themes.ts");
const generate = read("src/lib/voyage/generate.ts");

test("every voyage theme ships curated tastemaker picks", () => {
  const ids = [...themes.matchAll(/^\s+id: "(\w+)",$/gm)].map((m) => m[1]);
  assert.ok(ids.length >= 6, `expected the six themes, found ${ids.length}`);
  const blocks = themes.split(/^\s{4}id: "/m).slice(1);
  for (const b of blocks) {
    const name = b.slice(0, b.indexOf('"'));
    assert.match(b, /seeds: \[/, `theme ${name} has no curated seeds`);
    const seeds = (b.match(/"tt\d+",/g) || []).length;
    assert.ok(seeds >= 12, `theme ${name} only has ${seeds} seeds, needs a real spread`);
  }
});

test("curated seeds are unique within a theme", () => {
  const blocks = themes.split(/^\s{4}id: "/m).slice(1);
  for (const b of blocks) {
    const name = b.slice(0, b.indexOf('"'));
    const start = b.indexOf("seeds: [");
    const list = b.slice(start, b.indexOf("],", start));
    const seeds = (list.match(/"(tt\d+)"/g) || []).map((s) => s.slice(1, -1));
    assert.ok(seeds.length > 0, `theme ${name} has no seeds`);
    assert.equal(new Set(seeds).size, seeds.length, `theme ${name} repeats a seed`);
  }
});

test("api picks must lead with the theme genre so loose tags cannot leak in", () => {
  assert.match(generate, /function leadsWithGenre/);
  assert.match(generate, /g\.length > 0 && g\[0\]\.toLowerCase\(\) === genre\.toLowerCase\(\)/);
  assert.match(generate, /clean\.filter\(\(m\) => leadsWithGenre\(m, theme\.genre\)\)/);
});

test("a genre that rarely leads still gets api picks instead of going empty", () => {
  assert.match(generate, /const LIVE_MIN = \d+;/);
  assert.match(generate, /if \(lead\.length >= LIVE_MIN\) return lead;/);
  assert.match(generate, /\(m\.genres \?\? \[\]\)\.some\(\(g\) => g\.toLowerCase\(\) === want\)/);
});

test("the pool blends curated and api picks rather than one or the other", () => {
  assert.match(generate, /interleave\(shuffle\(curated\), shuffle\(live\)\)/);
  const il = generate.slice(generate.indexOf("function interleave"), generate.indexOf("export async function generatePool"));
  assert.match(il, /seen\.has\(m\.id\)/, "interleaving must not duplicate a title");
});
