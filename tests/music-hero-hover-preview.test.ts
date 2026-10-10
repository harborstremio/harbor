import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const media = readFileSync("src/views/music/music-hero-media.tsx", "utf8");
const hero = readFileSync("src/views/music/music-home-hero.tsx", "utf8");
const connector = readFileSync("src-tauri/src/music/connector.rs", "utf8");

test("only one connector can resolve a video, so a fallback is required", () => {
  assert.match(connector, /fn resolve_video[\s\S]{0,200}Err\(NO_VIDEO/);
});

test("the hero falls back to searching for a music video when the item's own source has none", () => {
  assert.match(media, /searchMusicVideos/);
  const fn = media.slice(media.indexOf("async function previewUrlFor"));
  assert.ok(
    fn.indexOf("musicVideoStream") < fn.indexOf("searchMusicVideos"),
    "direct resolve must be tried before searching",
  );
});

test("a failed direct resolve does not abort the preview", () => {
  assert.match(media, /musicVideoStream\(track\)\.catch\(\(\) => null\)/);
});
test("the preview is only visible while hovering and stays muted and looping", () => {
  assert.ok(media.includes("data-on={(hovering && playing)"), "visibility must be gated on hover");
  assert.ok(media.includes("muted"), "a hero preview must never make sound");
  assert.ok(media.includes("loop"));
});

test("reduced motion and a hidden page suppress the preview", () => {
  assert.match(media, /prefers-reduced-motion: reduce/);
  assert.match(media, /document\.hidden/);
});

test("hovering the hero pauses the carousel", () => {
  const guard = hero.slice(hero.indexOf("const timer = setTimeout("));
  const before = hero.slice(0, hero.indexOf("const timer = setTimeout("));
  const lastGuard = before.search(/if\s*\(\s*!active/);
  assert.ok(lastGuard >= 0, "cycle guard not found");
  assert.match(before.slice(lastGuard), /\|\|\s*hovering\s*\|\|/);
  assert.ok(guard.length > 0);
});

test("focus pauses the carousel too, for keyboard users", () => {
  const i = hero.search(/if\s*\(\s*!active/);
  assert.ok(i >= 0);
  assert.match(hero.slice(i, hero.indexOf("const timer = setTimeout(", i)), /focused/);
});
