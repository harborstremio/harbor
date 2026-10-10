const compactCss = (value: string) =>
  value
    .replace(/\s*([{}:;,/])\s*/g, "$1")
    .replace(/\s+/g, " ")
    .replace(/@media\s+\(/g, "@media(")
    .replace(/;}/g, "}");
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const watchCss = compactCss(read("../src/components/music/music-watch.css"));
const watchTsx = read("../src/components/music/music-watch.tsx");
const discoveryCss = compactCss(read("../src/components/music/music-video-discovery.css"));
const discoveryTsx = read("../src/components/music/music-video-discovery.tsx");

const rule = (css: string, selector: string) => {
  const start = css.indexOf(selector + "{");
  assert.notEqual(start, -1, `missing rule ${selector}`);
  return css.slice(start + selector.length + 1, css.indexOf("}", start));
};

test("the watch stage reserves a 16:9 box and clips the media element itself", () => {
  const stage = rule(watchCss, ".music-watch-stage");
  assert.match(stage, /aspect-ratio:\s*16\/9/);
  assert.match(stage, /overflow:hidden/);
  assert.match(stage, /border-radius:/);
  assert.match(stage, /position:relative/);
});

test("the stage no longer pins itself to escape a native window it no longer hosts", () => {
  assert.doesNotMatch(watchCss, /position:sticky/);
  assert.doesNotMatch(watchCss, /native window/i);
  assert.doesNotMatch(watchCss, /max-height:620px/);
});

test("the terminal error state replaces the picture and offers a reachable retry", () => {
  assert.match(watchTsx, /preparationError \? \(/);
  assert.match(watchTsx, /music-watch-stage-error/);
  assert.match(watchTsx, /role="alert"/);
  const retry = watchTsx.slice(
    watchTsx.indexOf("music-watch-stage-error"),
    watchTsx.indexOf("music-watch-stage-poster"),
  );
  assert.match(retry, /data-music-watch-retry/);
  assert.match(retry, /type="button"/);
  assert.match(retry, /t\("common\.retry"\)/);
  assert.match(retry, /onClick=\{replayTrack\}/);
  assert.match(rule(watchCss, ".music-watch-retry"), /min-height:44px/);
  assert.match(watchCss, /\.music-watch-retry:focus-visible\{outline:/);
});

test("resolving shows artwork and shaped skeletons rather than an empty or frozen frame", () => {
  assert.match(watchTsx, /music-watch-stage-poster/);
  assert.match(watchTsx, /function VideoNextSkeleton/);
  assert.match(watchTsx, /\{busy && \(\s*<ul className="music-watch-next-list"/);
  assert.match(watchTsx, /similarBusy \? \(/);
  assert.doesNotMatch(watchTsx, /Loader2/);
  assert.match(watchCss, /@keyframes music-watch-sheen/);
});

test("the up next rows expose focus and pointer affordance on the controls that actually take it", () => {
  assert.match(
    watchCss,
    /\.music-watch-next-art:focus-visible,\.music-watch-next-label button:focus-visible\{outline:/,
  );
  assert.doesNotMatch(rule(watchCss, ".music-watch-video-next"), /cursor:pointer/);
  assert.match(rule(watchCss, ".music-watch-next-art"), /cursor:pointer/);
});

test("skeleton and retry motion stand down under reduced motion", () => {
  assert.match(
    watchCss,
    /@media\(prefers-reduced-motion:reduce\)\{[^}]*music-watch-sheen|@media\(prefers-reduced-motion:reduce\)\{[^{]*\.music-watch-next-skeleton/,
  );
  assert.match(
    discoveryCss,
    /@media\(prefers-reduced-motion:reduce\)\{.*\.music-video-skeleton span\{animation:none\}/,
  );
});

test("the discovery rail arrows are dead controls no longer: they disable at each edge", () => {
  assert.match(
    discoveryTsx,
    /const \[edges, setEdges\] = useState\(\{ start: true, end: true \}\)/,
  );
  assert.match(discoveryTsx, /disabled=\{edges\.start\}/);
  assert.match(discoveryTsx, /disabled=\{edges\.end\}/);
  assert.match(discoveryTsx, /new ResizeObserver\(measure\)/);
  assert.match(discoveryTsx, /addEventListener\("scroll", measure/);
  assert.match(discoveryCss, /\.music-video-rail-controls button:disabled\{/);
});

test("the discovery placeholder mirrors the tile it becomes instead of spinning", () => {
  assert.match(discoveryTsx, /music-video-skeleton-art/);
  assert.match(discoveryTsx, /music-video-skeleton-line/);
  assert.doesNotMatch(discoveryTsx, /Loader2/);
  assert.doesNotMatch(discoveryCss, /music-video-spin/);
  assert.match(rule(discoveryCss, ".music-video-skeleton-art"), /aspect-ratio:16\/9/);
});

test("every discovery control declares its button type so a rail cannot submit the search form", () => {
  const buttons = discoveryTsx.match(/<button(?![^>]*type=)[^>]*>/g) ?? [];
  assert.deepEqual(buttons, []);
});
