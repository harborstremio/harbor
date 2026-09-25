import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const DOCK = "var(--harbor-music-dock";
const GAP = "var(--harbor-dock-gap";
const NEWLINE = String.fromCharCode(10);
const read = (p: string) => readFileSync(p, "utf8");

function topLevelBlock(css: string, selector: string): string {
  const lines = css.split(NEWLINE);
  const start = lines.findIndex((line) => line.trimEnd() === selector + " {");
  assert.ok(start >= 0, selector + " rule not found at top level");
  const rest = lines.slice(start);
  const end = rest.findIndex((line) => line === "}");
  return rest.slice(0, end < 0 ? rest.length : end).join(NEWLINE);
}

test("the dock publishes its height for everything else to clear", () => {
  assert.ok(
    read("src/components/music/music-dock.tsx").includes('setProperty("--harbor-music-dock"'),
  );
});

test("settings content, rail and footer all clear the dock", () => {
  const css = read("src/index.css");
  for (const selector of [".hset-main", ".hset-rail", ".hset-footer"]) {
    assert.ok(topLevelBlock(css, selector).includes(GAP), selector + " sits under the music dock");
  }
});

test("the composite gap covers both the dock and any viewport lift", () => {
  const dock = read("src/components/music/music-dock.tsx");
  assert.ok(dock.includes("--harbor-dock-gap"), "the dock must publish the composite gap");
  assert.ok(dock.includes("var(--harbor-viewport-bottom, 0px)"), "the gap must fold in the lift");
});

test("floating bottom surfaces clear the dock", () => {
  const files = [
    "src/components/back-to-top.tsx",
    "src/components/scroll-top-button.tsx",
    "src/components/floating-page-actions.tsx",
    "src/components/controller-connected-toast.tsx",
    "src/components/lists/list-toast.tsx",
    "src/components/episode-jumper.tsx",
    "src/components/update/update-card.tsx",
    "src/components/music/music-source-picker.tsx",
  ];
  for (const file of files)
    assert.ok(read(file).includes(DOCK), file + " floats at the bottom without clearing the dock");
});

test("the existing ebook back-to-top clears the music dock without a redesign", () => {
  const ebook = read("src/views/ebook.tsx");
  const control = ebook.slice(ebook.indexOf("{showScrollTop && !reading"));
  assert.ok(control.includes(DOCK));
  assert.ok(control.includes("var(--harbor-viewport-bottom"));
});

test("the shared back-to-top is flat and on theme, not an accent slab", () => {
  const btn = read("src/components/back-to-top.tsx");
  assert.ok(btn.includes("bg-elevated"));
  assert.ok(btn.includes("ring-1 ring-edge-soft"));
  assert.ok(!btn.includes("bg-accent"));
});
