// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { lyricIndexAt, parseLrc } from "../src/lib/music/lyrics.ts";
import {
  karaokeLineState,
  karaokeScrollMotion,
  karaokeScrollTop,
} from "../src/lib/music/karaoke-scroll.ts";

const LRC = [
  "[00:12.00]I walked the long way home",
  "[00:16.40]Past the lights on the water",
  "[00:21.10]Nothing left to say",
  "[00:25.80]So I said it anyway",
  "[00:31.20]And the morning came",
].join("\n");

const lines = parseLrc(LRC);

test("stepping to the next line scrolls smoothly, a long seek snaps", () => {
  assert.equal(karaokeScrollMotion({ from: 2, to: 3 }), "smooth");
  assert.equal(karaokeScrollMotion({ from: 12, to: 11 }), "smooth");
  assert.equal(karaokeScrollMotion({ from: 2, to: 41 }), "instant");
  assert.equal(karaokeScrollMotion({ from: 41, to: 2 }), "instant");
});

test("a new track and a first line both arrive without animating across the song", () => {
  assert.equal(karaokeScrollMotion({ from: 3, to: 4, trackChanged: true }), "instant");
  assert.equal(karaokeScrollMotion({ from: -1, to: 0 }), "instant");
  assert.equal(karaokeScrollMotion({ from: 5, to: -1 }), "instant");
  assert.equal(karaokeScrollMotion({ from: Number.NaN, to: 3 }), "instant");
});

test("reduced motion never animates, whatever the step", () => {
  assert.equal(karaokeScrollMotion({ from: 2, to: 3, reducedMotion: true }), "instant");
  assert.equal(karaokeScrollMotion({ from: 0, to: 1, reducedMotion: true }), "instant");
});

test("before the first lyric nothing is sung yet and every line is still upcoming", () => {
  const active = lyricIndexAt(lines, 4);
  assert.equal(active, -1);
  assert.deepEqual(
    lines.map((_, index) => karaokeLineState(index, active)),
    lines.map(() => "upcoming"),
  );
});

test("mid song the current line is bracketed by past and upcoming lines", () => {
  const active = lyricIndexAt(lines, 22.5);
  assert.equal(lines[active].text, "Nothing left to say");
  assert.equal(karaokeLineState(active, active), "current");
  assert.equal(karaokeLineState(active - 1, active), "past");
  assert.equal(karaokeLineState(active + 1, active), "upcoming");
});

test("after the last lyric the final line stays current and the rest are past", () => {
  const active = lyricIndexAt(lines, 600);
  assert.equal(active, lines.length - 1);
  assert.equal(karaokeLineState(active, active), "current");
  assert.equal(karaokeLineState(0, active), "past");
});

test("the current line is parked at the same place in the view as the song moves", () => {
  const view = { viewHeight: 900, lineHeight: 120, maxScroll: 6000 };
  const places = [480, 1200, 2400].map((lineTop) => {
    const top = karaokeScrollTop({ ...view, lineTop });
    return lineTop + view.lineHeight / 2 - top;
  });
  assert.equal(new Set(places).size, 1);
  assert.ok(places[0] > 0 && places[0] < view.viewHeight);
});

test("the list never scrolls above its start or past its end", () => {
  const view = { viewHeight: 900, lineHeight: 120, maxScroll: 2000 };
  assert.equal(karaokeScrollTop({ ...view, lineTop: 0 }), 0);
  assert.equal(karaokeScrollTop({ ...view, lineTop: 40 }), 0);
  assert.equal(karaokeScrollTop({ ...view, lineTop: 9999 }), 2000);
  assert.equal(karaokeScrollTop({ ...view, lineTop: Number.NaN }), 0);
});
