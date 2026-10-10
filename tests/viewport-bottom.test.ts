import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { viewportBottomGap } from "../src/lib/viewport-bottom";

test("with no zoom the layout and visual viewports agree and nothing is offset", () => {
  assert.equal(viewportBottomGap(900, 900, 0), 0);
});

test("zoomed in, the gap is what the layout viewport hides below the visible area", () => {
  assert.equal(viewportBottomGap(900, 720, 0), 180);
});

test("a scrolled visual viewport counts its own offset", () => {
  assert.equal(viewportBottomGap(900, 720, 100), 80);
});

test("a visual viewport larger than the layout never pushes content upward", () => {
  assert.equal(viewportBottomGap(900, 1000, 0), 0);
  assert.equal(viewportBottomGap(900, 900, -50), 0);
});

test("sub-pixel noise is not treated as a gap", () => {
  assert.equal(viewportBottomGap(900, 899.7, 0), 0);
});

test("a fractional ui zoom never lifts the dock", () => {
  assert.equal(viewportBottomGap(900, 899.0, 0), 0);
  assert.equal(viewportBottomGap(900, 898.2, 0), 0);
  assert.equal(viewportBottomGap(829, 828.47, 0), 0);
  assert.equal(viewportBottomGap(900, 877, 0), 0);
});

test("nonsense measurements are survivable", () => {
  assert.equal(viewportBottomGap(Number.NaN, 700, 0), 0);
  assert.equal(viewportBottomGap(900, Number.NaN, 0), 0);
});

test("the gap can never exceed the viewport itself", () => {
  assert.equal(viewportBottomGap(500, -1000, 0), 500);
});

test("the dock anchors to the visual viewport, not the layout viewport", () => {
  const dock = readFileSync("src/components/music/music-dock.tsx", "utf8");
  assert.ok(dock.includes("trackViewportBottom()"), "the tracker must be installed");
  assert.equal(
    (dock.match(/bottom: "var\(--harbor-viewport-bottom, 0px\)"/g) ?? []).length,
    2,
    "both the dock and its collapsed tab must anchor",
  );
  assert.ok(
    dock.includes("--harbor-dock-gap"),
    "the dock must publish a composite gap for everything else to clear",
  );
});

test("every floating bottom surface clears the zoom gap as well as the dock", () => {
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
  for (const file of files) {
    assert.ok(
      readFileSync(file, "utf8").includes("--harbor-viewport-bottom"),
      `${file} would float away when zoomed`,
    );
  }
});
