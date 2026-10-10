const compactCss = (value: string) =>
  value
    .replace(/\s*([{}:;,/])\s*/g, "$1")
    .replace(/\s+/g, " ")
    .replace(/@media\s+\(/g, "@media(")
    .replace(/;}/g, "}");
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const watch = readFileSync("src/components/music/music-watch.tsx", "utf8");
const css = compactCss(readFileSync("src/components/music/music-watch.css", "utf8"));
const poster = readFileSync("src/components/poster.tsx", "utf8");

test("Poster's wide ratio is 16:7, which is NOT a video frame", () => {
  assert.ok(
    poster.includes('wide: "43.75%"'),
    "if this changes, the ratio choice below must be revisited",
  );
  assert.ok(poster.includes('landscape: "56.25%"'), "landscape is the 16:9 video ratio");
});

test("the watch next thumbnail holder is a 16:9 box", () => {
  assert.ok(css.includes(".music-watch-next-art{position:relative;aspect-ratio:16/9"));
});

test("the video stage is a 16:9 box", () => {
  assert.ok(css.includes(".music-watch-stage{position:relative;z-index:2;aspect-ratio:16/9"));
});

test("no poster on this page declares a ratio its holder does not have", () => {
  assert.ok(
    !watch.includes('ratio="wide"'),
    "a 16:7 poster inside a 16:9 holder leaves bands of empty holder showing",
  );
});

test("both posters declare the matching 16:9 ratio", () => {
  const matches = watch.split('ratio="landscape"').length - 1;
  assert.equal(matches, 2, "the watch next thumbnail and the stage backdrop must both be 16:9");
});
