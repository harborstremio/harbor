// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const feed = read("src/lib/social/activity-feed.ts");
const autosave = read("src/views/player/hooks/use-resume-autosave.ts");
const marker = read("src/lib/mark-watched.ts");
const sync = read("src/lib/social/use-activity-sync.ts");
const store = read("src/lib/watch-events.ts");

test("recent activity no longer derives only from the resume list", () => {
  assert.match(feed, /watchEvents\?: WatchEvent\[\]/, "the feed must accept completion events");
  const evt = feed.indexOf("input.watchEvents");
  const cw = feed.indexOf("for (const c of input.cw)");
  assert.ok(evt >= 0, "completion events must be read");
  assert.ok(cw > evt, "completion events are merged before the resume list");
});

test("completion events are marked finished and keep the episode label", () => {
  const block = feed.slice(feed.indexOf("input.watchEvents"), feed.indexOf("for (const c of input.cw)"));
  assert.match(block, /kind: "finished"/);
  assert.match(block, /withAnime\(w\.id, w\.type\)/, "anime must still be typed as anime");
  assert.match(block, /S\$\{w\.season\} E\$\{w\.episode\}/);
});

test("finishing playback records a watch event for every content type", () => {
  assert.match(autosave, /if \(finished\) \{\s*recordWatchEvent\(/);
  const guard = autosave.slice(autosave.indexOf("if (finished) {"), autosave.indexOf("const animeLocal"));
  assert.doesNotMatch(guard, /meta\.type === "series" &&/, "must not be limited to one media type");
});

test("mark as watched records an event for both movies and shows", () => {
  const hits = marker.match(/recordWatchEvent\(/g) ?? [];
  assert.ok(hits.length >= 2, `expected movie and series paths, found ${hits.length}`);
  assert.match(marker, /recordWatchEvent\(\{ id: meta\.id, type: "movie"/);
  assert.match(marker, /recordWatchEvent\(\{ id: meta\.id, type: "series"/);
});

test("the sync hook re-pushes when a watch event lands", () => {
  assert.match(sync, /subscribeWatchEvents\(\(\) => setWatchEvents\(listWatchEvents\(\)\)\)/);
  assert.match(sync, /watchEvents,\r?\n\s*\}\),/, "events must be passed into the feed");
  assert.match(sync, /\[cw, ratings, favMap, mangaMap, imports, watchEvents\]/);
});

test("the watch log is capped and survives unreadable storage", () => {
  assert.match(store, /const MAX = \d+;/);
  assert.match(store, /\.slice\(0, MAX\)/, "the log must be bounded");
  assert.match(store, /catch \{\s*return \[\];/, "a corrupt log must not throw");
});

test("re-finishing the same episode replaces rather than duplicates", () => {
  assert.match(store, /filter\(\(p\) =>[\s\S]*?!== key\)/);
  assert.match(store, /\$\{e\.id\}\|\$\{e\.season \?\? ""\}\|\$\{e\.episode \?\? ""\}/);
});
