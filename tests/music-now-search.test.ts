import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  dedupeSearchTracks,
  filterSearchMode,
  mergeSearchTracks,
  moveSearchCursor,
  nextSearchLimit,
  searchTrackKey,
  NOW_SEARCH_CEILING,
  NOW_SEARCH_PAGE,
} from "../src/lib/music/now-search.ts";
import type { MusicTrack } from "../src/lib/music/types.ts";

function track(over: Partial<MusicTrack> & { id: string }): MusicTrack {
  return {
    connectorId: "catalog",
    title: "Song",
    artist: "Artist",
    artwork: "https://cdn.example/a.jpg",
    durationSeconds: 180,
    durationLabel: "3:00",
    ...over,
  };
}

function page(count: number, offset = 0): MusicTrack[] {
  return Array.from({ length: count }, (_, index) => track({ id: `t${offset + index}` }));
}

test("pagination asks for one more page while the source keeps filling the window", () => {
  assert.equal(nextSearchLimit(NOW_SEARCH_PAGE, NOW_SEARCH_PAGE), NOW_SEARCH_PAGE * 2);
  assert.equal(nextSearchLimit(NOW_SEARCH_PAGE * 2, NOW_SEARCH_PAGE * 2), NOW_SEARCH_PAGE * 3);
  assert.equal(nextSearchLimit(NOW_SEARCH_PAGE * 3, NOW_SEARCH_PAGE * 3), NOW_SEARCH_PAGE * 4);
});

test("pagination stops when the source returns fewer rows than it was allowed", () => {
  assert.equal(nextSearchLimit(NOW_SEARCH_PAGE, NOW_SEARCH_PAGE - 1), null);
  assert.equal(nextSearchLimit(NOW_SEARCH_PAGE, 0), null);
  assert.equal(nextSearchLimit(NOW_SEARCH_PAGE * 2, NOW_SEARCH_PAGE), null);
});

test("pagination stops at the ceiling instead of growing forever", () => {
  assert.equal(nextSearchLimit(NOW_SEARCH_CEILING, NOW_SEARCH_CEILING), null);
  assert.equal(nextSearchLimit(NOW_SEARCH_CEILING + NOW_SEARCH_PAGE, NOW_SEARCH_CEILING * 2), null);
});

test("pagination never grows past the ceiling in a single step", () => {
  const stepped = nextSearchLimit(NOW_SEARCH_CEILING - 1, NOW_SEARCH_CEILING);
  assert.ok(stepped !== null && stepped <= NOW_SEARCH_CEILING);
});

test("pagination refuses a limit below one page", () => {
  assert.equal(nextSearchLimit(0, 0), null);
  assert.equal(nextSearchLimit(Number.NaN, 24), null);
});

test("a video-only page stops paging immediately because the video endpoint caps itself", () => {
  assert.equal(nextSearchLimit(NOW_SEARCH_PAGE, 12), null);
});

test("mode filtering splits songs from music videos on mediaKind", () => {
  const rows = [
    track({ id: "a" }),
    track({ id: "b", mediaKind: "audio" }),
    track({ id: "c", mediaKind: "video" }),
  ];
  assert.deepEqual(
    filterSearchMode(rows, "songs").map((item) => item.id),
    ["a", "b"],
  );
  assert.deepEqual(
    filterSearchMode(rows, "videos").map((item) => item.id),
    ["c"],
  );
});

test("an untagged track counts as a song, which is what searchTyped actually returns", () => {
  assert.equal(filterSearchMode([track({ id: "a" })], "songs").length, 1);
  assert.equal(filterSearchMode([track({ id: "a" })], "videos").length, 0);
});

test("dedupe keys on connector and source identity, not the row position", () => {
  const rows = [
    track({ id: "a", connectorId: "youtube", sourceId: "vid1" }),
    track({ id: "b", connectorId: "youtube", sourceId: "vid1" }),
    track({ id: "a", connectorId: "deezer" }),
  ];
  assert.deepEqual(dedupeSearchTracks(rows).map(searchTrackKey), ["youtube:vid1", "deezer:a"]);
});

test("a wider window merges without duplicating the page already on screen", () => {
  const first = page(24);
  const second = page(48);
  const merged = mergeSearchTracks(first, second);
  assert.equal(merged.length, 48);
  assert.deepEqual(
    merged.slice(0, 24).map((item) => item.id),
    first.map((item) => item.id),
  );
  assert.equal(new Set(merged.map(searchTrackKey)).size, 48);
});

test("merging a window that added nothing leaves the list untouched", () => {
  const first = page(24);
  const merged = mergeSearchTracks(first, page(24));
  assert.equal(merged.length, 24);
});

test("merging keeps the order the user is already reading", () => {
  const previous = [track({ id: "a" }), track({ id: "b" })];
  const incoming = [track({ id: "b" }), track({ id: "a" }), track({ id: "c" })];
  assert.deepEqual(
    mergeSearchTracks(previous, incoming).map((item) => item.id),
    ["a", "b", "c"],
  );
});

test("arrow keys walk the rows and stop at both ends", () => {
  assert.equal(moveSearchCursor(-1, 1, 3), 0);
  assert.equal(moveSearchCursor(0, 1, 3), 1);
  assert.equal(moveSearchCursor(2, 1, 3), 2);
  assert.equal(moveSearchCursor(0, -1, 3), 0);
  assert.equal(moveSearchCursor(-1, -1, 3), 2);
  assert.equal(moveSearchCursor(0, 1, 0), -1);
});

const CSS = readFileSync("src/components/music/music-now-search.css", "utf8");
const TSX = readFileSync("src/components/music/music-now-search.tsx", "utf8");

function listRule(): string {
  const at = CSS.indexOf("\n.music-now-search-list {");
  assert.notEqual(at, -1, "the results list lost its own rule");
  return CSS.slice(at, CSS.indexOf("}", at));
}

test("the observer root actually clips, or every page loads at once without a scroll", () => {
  const list = listRule();
  assert.match(list, /overflow-y:\s*auto/);
  assert.match(
    list,
    /max-height:\s*min\(/,
    "a flex-only height leaves the list unclipped, so the sentinel is always intersecting",
  );
  assert.match(
    TSX,
    /root:\s*listRef\.current/,
    "the sentinel must be measured against the list, not the viewport",
  );
});

test("a page never lands past the end of the list it scrolls in", () => {
  assert.match(listRule(), /overscroll-behavior:\s*contain/);
});

test("video mode follows the provider continuation instead of increasing a fixed search cap", () => {
  assert.match(
    TSX,
    /searchMusicVideoPage\(value,\s*false,\s*videoCursors\.current\.get\(limit\)/,
    "each video page needs its provider cursor, including on retry",
  );
});
