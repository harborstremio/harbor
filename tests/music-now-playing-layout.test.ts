// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const TSX = readFileSync("src/components/music/music-now-playing.tsx", "utf8");
const CSS = readFileSync("src/components/music/music-now-playing.css", "utf8");

const BASE = CSS.slice(0, CSS.indexOf("@container"));

function rule(selector: string): string {
  const at = BASE.indexOf(`\n${selector} {`);
  if (at < 0) return "";
  return BASE.slice(at + 1, BASE.indexOf("}", at));
}

function px(declaration: string, body: string): number {
  const found = new RegExp(`${declaration}\\s*:\\s*(-?[\\d.]+)px`).exec(body);
  return found ? Number(found[1]) : NaN;
}

test("the search panel has its own container rule, not the tab panel's", () => {
  const slot = rule(".music-now-search-slot");
  assert.ok(slot, "expected a .music-now-search-slot rule in music-now-playing.css");
  assert.ok(px("padding-top", slot) >= 16, `search slot must clear the tab strip, got ${slot}`);
});

test("that container wraps MusicNowSearch so the spacing actually applies", () => {
  assert.match(TSX, /className="music-now-search-slot"[^>]*>\s*<MusicNowSearch/);
});

test("the narrow container query keeps the separation", () => {
  const narrow = CSS.slice(CSS.search(/@container\s*\(max-width:\s*780px\)/));
  const slot = narrow.slice(narrow.indexOf(".music-now-search-slot {"));
  assert.ok(
    slot.startsWith(".music-now-search-slot {"),
    "narrow layout must restate the search slot",
  );
  assert.ok(px("padding-top", slot.slice(0, slot.indexOf("}"))) >= 12);
});

test("Up next still derives from the live queue via musicUpcoming", () => {
  assert.match(TSX, /import \{ musicUpcoming \} from "\.\/music-queue"/);
  assert.match(TSX, /musicUpcoming\(player\.queue, player\.queueIndex,/);
  assert.match(TSX, /className="music-now-next-list"/);
});

test("choosing a tab leaves search, so the tab strip is never inert", () => {
  assert.match(TSX, /onClick=\{\(\) => \{\s*setSearching\(false\);\s*setPanel\(id\);\s*\}\}/);
  assert.match(TSX, /aria-controls=\{searching \? undefined : `music-now-panel-\$\{id\}`\}/);
});

test("tab strip icon buttons meet the 44px target floor", () => {
  const icon = rule(".music-now-all-queue");
  assert.equal(px("width", icon), 44);
  assert.equal(px("height", icon), 44);
  assert.ok(px("min-height", rule(".music-now-quality")) >= 44);
});

test("only one trailing icon takes the auto margin", () => {
  assert.match(
    CSS,
    /\.music-now-all-queue \+ \.music-now-all-queue\s*\{\s*margin-inline-start:\s*0;?\s*\}/,
  );
});
