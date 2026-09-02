// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

import {
  bigPictureChromeState,
  buildBpFacts,
  cycleTab,
  BP_NAV_JUMP,
  directionScore,
  gridEscapes,
  gridStep,
  navigationMode,
  railEscapes,
  parseBpMetaId,
  isBpNavJumpKey,
  pickIndexInDirection,
  rankIndicesInDirection,
  remainingMinutes,
  shouldAutoStartBigPicture,
  shouldOfferBigPicture,
  shouldRenderBigPicture,
  toBpRect,
  type BpRect,
} from "../src/views/big-picture/bp-logic.ts";

function rect(x: number, y: number, w: number, h: number): BpRect {
  return toBpRect({ left: x, top: y, width: w, height: h });
}

function poster(col: number, row: number): BpRect {
  return rect(48 + col * 150, 300 + row * 320, 136, 204);
}

test("toBpRect derives centres", () => {
  const r = rect(10, 20, 100, 50);
  assert.equal(r.cx, 60);
  assert.equal(r.cy, 45);
});

test("directionScore rejects anything not ahead in the travel direction", () => {
  const from = poster(2, 0);
  assert.equal(directionScore(from, poster(1, 0), "right"), null);
  assert.equal(directionScore(from, poster(3, 0), "left"), null);
  assert.equal(directionScore(from, poster(2, 0), "down"), null);
});

test("right lands on the immediate neighbour, not a far one", () => {
  const from = poster(0, 0);
  const pool = [poster(3, 0), poster(1, 0), poster(2, 0)];
  assert.equal(pickIndexInDirection(from, pool, "right"), 1);
});

test("down from a row keeps the column when one lines up", () => {
  const from = poster(3, 0);
  const pool = [poster(0, 1), poster(3, 1), poster(6, 1)];
  assert.equal(pickIndexInDirection(from, pool, "down"), 1);
});

test("down prefers the next row over a far-away closer-centred tile", () => {
  const from = poster(2, 0);
  const nextRowFarLeft = poster(0, 1);
  const twoRowsDownAligned = poster(2, 2);
  const at = pickIndexInDirection(from, [twoRowsDownAligned, nextRowFarLeft], "down");
  assert.equal(at, 1, "a slightly drifted tile one row down beats a perfect column two rows down");
});

test("down never skips a row, at any column offset", () => {
  const from = poster(4, 0);
  for (let col = 0; col <= 8; col += 1) {
    const nextRow = poster(col, 1);
    const twoRowsAligned = poster(4, 2);
    const at = pickIndexInDirection(from, [twoRowsAligned, nextRow], "down");
    assert.equal(at, 1, `column ${col} in the next row must beat a perfect column two rows down`);
  }
});

test("a wide continue-watching card maps down onto the poster beneath its centre", () => {
  const cwCard = rect(48, 260, 452, 254);
  const posters = [poster(0, 0), poster(1, 0), poster(2, 0), poster(3, 0)];
  const at = pickIndexInDirection(cwCard, posters, "down");
  const chosen = posters[at];
  assert.ok(
    Math.abs(chosen.cx - cwCard.cx) <= 150,
    `expected a poster near the card centre, got cx ${chosen.cx} vs ${cwCard.cx}`,
  );
});

test("up from the first row reaches the top bar chips", () => {
  const from = poster(1, 0);
  const chips = [rect(48, 14, 96, 44), rect(160, 14, 96, 44), rect(272, 14, 110, 44)];
  const at = pickIndexInDirection(from, chips, "up");
  assert.ok(at >= 0, "a top bar chip must be reachable going up");
});

test("keyboard rows step one key at a time", () => {
  const keys = Array.from({ length: 10 }, (_, i) => rect(48 + i * 56, 400, 51, 44));
  assert.equal(pickIndexInDirection(keys[4], keys, "right"), 5);
  assert.equal(pickIndexInDirection(keys[4], keys, "left"), 3);
});

test("keyboard drops straight down a column into the next row", () => {
  const rowA = Array.from({ length: 10 }, (_, i) => rect(48 + i * 56, 400, 51, 44));
  const rowB = Array.from({ length: 10 }, (_, i) => rect(48 + i * 56, 452, 51, 44));
  assert.equal(pickIndexInDirection(rowA[6], rowB, "down"), 6);
});

test("no target returns -1 rather than wrapping around", () => {
  const keys = Array.from({ length: 4 }, (_, i) => rect(i * 56, 400, 51, 44));
  assert.equal(pickIndexInDirection(keys[3], keys, "right"), -1);
});

test("a row holds horizontally but hands off vertically", () => {
  assert.equal(navigationMode({ inGrid: false, inRail: true, dir: "left" }), "rail");
  assert.equal(navigationMode({ inGrid: false, inRail: true, dir: "right" }), "rail");
  assert.equal(navigationMode({ inGrid: false, inRail: true, dir: "up" }), "spatial");
  assert.equal(navigationMode({ inGrid: false, inRail: true, dir: "down" }), "spatial");
});

test("a grid owns every direction", () => {
  for (const dir of ["up", "down", "left", "right"] as const) {
    assert.equal(navigationMode({ inGrid: true, inRail: true, dir }), "grid");
  }
});

test("loose chrome navigates freely", () => {
  assert.equal(navigationMode({ inGrid: false, inRail: false, dir: "right" }), "spatial");
  assert.equal(navigationMode({ inGrid: false, inRail: false, dir: "down" }), "spatial");
});

test("only vertical presses may leave a rail or a grid", () => {
  assert.equal(railEscapes("up"), true);
  assert.equal(railEscapes("down"), true);
  assert.equal(railEscapes("left"), false);
  assert.equal(railEscapes("right"), false);

  assert.equal(gridEscapes("left", false), false, "left at a grid edge must never escape");
  assert.equal(gridEscapes("right", false), false, "right at a grid edge must never escape");
  assert.equal(gridEscapes("down", false), true);
  assert.equal(gridEscapes("down", true), false, "a target inside the grid always wins");
});

function grid(cols: number, count: number): BpRect[] {
  return Array.from({ length: count }, (_, i) =>
    rect(48 + (i % cols) * 160, 200 + Math.floor(i / cols) * 240, 136, 204),
  );
}

test("grid right wraps to the start of the next row", () => {
  const cells = grid(4, 12);
  assert.equal(gridStep(3, cells, "right"), 4);
});

test("grid left wraps back to the end of the previous row", () => {
  const cells = grid(4, 12);
  assert.equal(gridStep(4, cells, "left"), 3);
});

test("grid right at the very last cell reports no target", () => {
  const cells = grid(4, 12);
  assert.equal(gridStep(11, cells, "right"), -1);
});

test("grid left at the very first cell reports no target", () => {
  const cells = grid(4, 12);
  assert.equal(gridStep(0, cells, "left"), -1);
});

test("grid down holds the column", () => {
  const cells = grid(4, 12);
  assert.equal(gridStep(1, cells, "down"), 5);
  assert.equal(gridStep(5, cells, "down"), 9);
});

test("grid up holds the column", () => {
  const cells = grid(4, 12);
  assert.equal(gridStep(9, cells, "up"), 5);
});

test("grid down from the last row reports no target so focus can leave", () => {
  const cells = grid(4, 12);
  assert.equal(gridStep(9, cells, "down"), -1);
});

test("grid down into a ragged final row lands on the nearest cell rather than stranding", () => {
  const cells = grid(4, 6);
  assert.equal(gridStep(0, cells, "down"), 4);
  assert.equal(gridStep(1, cells, "down"), 5);
  assert.equal(gridStep(2, cells, "down"), 5, "column 2 has no cell below, so take the closest");
  assert.equal(gridStep(3, cells, "down"), 5, "column 3 has no cell below, so take the closest");
});

test("in right to left, Right walks back down the DOM because rows run right to left", () => {
  const cells = grid(4, 12);
  assert.equal(gridStep(4, cells, "right", true), 3, "visual right is the earlier DOM index");
  assert.equal(gridStep(4, cells, "left", true), 5, "visual left is the later DOM index");
});

test("left to right and right to left are exact mirrors of each other", () => {
  const cells = grid(4, 12);
  for (let i = 0; i < cells.length; i += 1) {
    assert.equal(gridStep(i, cells, "right", true), gridStep(i, cells, "left", false));
    assert.equal(gridStep(i, cells, "left", true), gridStep(i, cells, "right", false));
  }
});

test("right to left mirrors the wrap at both grid edges", () => {
  const cells = grid(4, 12);
  assert.equal(gridStep(0, cells, "right", true), -1, "first cell sits at the visual right edge");
  assert.equal(gridStep(0, cells, "left", true), 1);
  assert.equal(gridStep(11, cells, "left", true), -1);
  assert.equal(gridStep(11, cells, "right", true), 10);
});

test("right to left leaves vertical grid movement untouched", () => {
  const cells = grid(4, 12);
  assert.equal(gridStep(1, cells, "down", true), gridStep(1, cells, "down", false));
  assert.equal(gridStep(9, cells, "up", true), gridStep(9, cells, "up", false));
});

test("grid navigation ignores an out of range index", () => {
  const cells = grid(4, 12);
  assert.equal(gridStep(-1, cells, "right"), -1);
  assert.equal(gridStep(99, cells, "down"), -1);
});

test("parseBpMetaId splits the route prefix from compound ids", () => {
  assert.deepEqual(parseBpMetaId("series:tt14688458"), { type: "series", id: "tt14688458" });
  assert.deepEqual(parseBpMetaId("movie:tmdb:movie:123"), { type: "movie", id: "tmdb:movie:123" });
  assert.deepEqual(parseBpMetaId("anime:kitsu:1376"), { type: "series", id: "kitsu:1376" });
});

test("parseBpMetaId leaves a bare id untouched", () => {
  assert.deepEqual(parseBpMetaId("tt1234567"), { type: "movie", id: "tt1234567" });
});

test("parseBpMetaId does not mistake an id namespace for a route prefix", () => {
  assert.deepEqual(parseBpMetaId("kitsu:1376"), { type: "movie", id: "kitsu:1376" });
  assert.deepEqual(parseBpMetaId("tmdb:tv:1399"), { type: "movie", id: "tmdb:tv:1399" });
});

test("parseBpMetaId survives a trailing colon", () => {
  assert.deepEqual(parseBpMetaId("series:"), { type: "movie", id: "series:" });
});

test("facts never print the season count twice", () => {
  const facts = buildBpFacts(
    { releaseInfo: "2023", runtime: "3 seasons" },
    { year: "2023", kind: "tv", numberOfSeasons: 4 },
  );
  assert.deepEqual(facts, ["2023", "4 seasons"]);
});

test("facts prefer the TMDB season count over a stale runtime string", () => {
  const facts = buildBpFacts({ runtime: "3 seasons" }, { kind: "tv", numberOfSeasons: 4 });
  assert.ok(facts.includes("4 seasons"));
  assert.ok(!facts.includes("3 seasons"));
});

test("a movie keeps its runtime and drops nothing", () => {
  const facts = buildBpFacts(
    { releaseInfo: "2021", runtime: "2h 35m", genres: ["Sci-Fi", "Adventure", "Drama", "Extra"] },
    { kind: "movie" },
  );
  assert.deepEqual(facts, ["2021", "2h 35m", "Sci-Fi, Adventure, Drama"]);
});

test("facts fall back to the meta when there is no TMDB detail", () => {
  assert.deepEqual(buildBpFacts({ releaseDate: "2019-05-04", runtime: "48m" }, null), [
    "2019",
    "48m",
  ]);
});

test("one season is singular", () => {
  assert.ok(buildBpFacts({}, { kind: "tv", numberOfSeasons: 1 }).includes("1 season"));
});

test("facts are empty when nothing is known", () => {
  assert.deepEqual(buildBpFacts({}, null), []);
});

const TABS = ["home", "search", "library", "settings"] as const;

test("shoulder buttons cycle tabs in both directions", () => {
  assert.equal(cycleTab(TABS, "home", 1), "search");
  assert.equal(cycleTab(TABS, "settings", 1), "home");
  assert.equal(cycleTab(TABS, "home", -1), "settings");
});

test("cycling from a route that is not a tab starts at the first tab", () => {
  assert.equal(cycleTab(TABS, "detail" as (typeof TABS)[number], 1), "search");
});

test("a kid profile is never offered Big Picture", () => {
  assert.equal(
    shouldOfferBigPicture({
      kidProfileActive: true,
      buttonEnabled: true,
      suppressedByChrome: false,
    }),
    false,
  );
});

test("the Big Picture button respects its own setting and the chrome suppression", () => {
  const base = { kidProfileActive: false, buttonEnabled: true, suppressedByChrome: false };
  assert.equal(shouldOfferBigPicture(base), true);
  assert.equal(shouldOfferBigPicture({ ...base, buttonEnabled: false }), false);
  assert.equal(shouldOfferBigPicture({ ...base, suppressedByChrome: true }), false);
});

test("Big Picture does not render for a kid profile even if it was already open", () => {
  assert.equal(shouldRenderBigPicture({ active: true, kidProfileActive: true }), false);
  assert.equal(shouldRenderBigPicture({ active: true, kidProfileActive: false }), true);
  assert.equal(shouldRenderBigPicture({ active: false, kidProfileActive: false }), false);
});

test("auto start never fires into a kid profile, and never fires twice", () => {
  const base = { autoStart: true, alreadyBooted: false, kidProfileActive: false };
  assert.equal(shouldAutoStartBigPicture(base), true);
  assert.equal(shouldAutoStartBigPicture({ ...base, kidProfileActive: true }), false);
  assert.equal(shouldAutoStartBigPicture({ ...base, alreadyBooted: true }), false);
  assert.equal(shouldAutoStartBigPicture({ ...base, autoStart: false }), false);
});

test("Big Picture stays mounted but hidden and inert while playback is open", () => {
  const playing = bigPictureChromeState({
    active: true,
    kidProfileActive: false,
    playbackOpen: true,
  });
  assert.deepEqual(playing, { mounted: true, hidden: true, navigationEnabled: false });
});

test("Big Picture comes back visible and navigable when playback closes", () => {
  const idle = bigPictureChromeState({ active: true, kidProfileActive: false, playbackOpen: false });
  assert.deepEqual(idle, { mounted: true, hidden: false, navigationEnabled: true });
});

test("a kid profile unmounts Big Picture rather than merely hiding it", () => {
  const kid = bigPictureChromeState({ active: true, kidProfileActive: true, playbackOpen: false });
  assert.deepEqual(kid, { mounted: false, hidden: false, navigationEnabled: false });
});

test("remaining minutes rounds and never goes negative", () => {
  assert.equal(remainingMinutes(3_600_000, 600_000), 50);
  assert.equal(remainingMinutes(3_600_000, 3_700_000), 0);
  assert.equal(remainingMinutes(0, 0), null);
});

test("a full-width neighbour whose centre lines up is still reachable", () => {
  const card = rect(48, 300, 136, 204);
  const banner = rect(0, 520, 1920, 96);
  assert.notEqual(directionScore(card, banner, "down"), null);
  assert.equal(directionScore(banner, card, "down"), null);
});

test("ranking returns every valid target nearest first, not just the winner", () => {
  const from = poster(0, 0);
  const pool = [poster(3, 0), poster(1, 0), poster(2, 0)];
  assert.deepEqual(rankIndicesInDirection(from, pool, "right"), [1, 2, 0]);
  assert.deepEqual(rankIndicesInDirection(from, pool, "left"), []);
});

test("the nav jump key stays off every other Big Picture binding", () => {
  assert.equal(isBpNavJumpKey(BP_NAV_JUMP.key), true);
  for (const key of ["ArrowUp", "Enter", "Escape", "Backspace", "PageUp", "PageDown", "Tab"]) {
    assert.equal(isBpNavJumpKey(key), false, `${key} must not double as the nav jump`);
  }
});
