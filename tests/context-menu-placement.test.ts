import assert from "node:assert/strict";
import test from "node:test";
import { submenuPlacement } from "../src/components/context-menu/menu-placement.ts";

const viewport = { width: 800, height: 600 };
const size = { width: 256, height: 320 };
const anchor = { left: 220, right: 450, top: 100, bottom: 136 };

test("submenu reveal follows resolved vertical geometry, independently of its horizontal side", () => {
  const below = submenuPlacement(anchor, size, viewport, false);
  assert.deepEqual(
    { x: below.x, y: below.y, side: below.side, origin: below.origin },
    { x: 450, y: 100, side: "right", origin: 0 },
  );
  const flipped = submenuPlacement({ ...anchor, left: 570, right: 780 }, size, viewport, false);
  assert.equal(flipped.side, "left");
  assert.equal(flipped.origin, below.origin);
  const above = submenuPlacement({ ...anchor, top: 564, bottom: 600 }, size, viewport, false);
  assert.equal(above.y, 272);
  assert.equal(above.origin, 100, "a panel ending above its row unfolds upwards");
  const straddling = submenuPlacement({ ...anchor, top: 440, bottom: 476 }, size, viewport, false);
  assert.ok(
    Math.abs(straddling.origin - 58.125) < 0.001,
    "a constrained tall panel unfolds from its real anchor",
  );
});

test("submenu positioning contains RTL and constrained viewports without changing the anchor meaning", () => {
  const rtl = submenuPlacement(anchor, size, viewport, true);
  assert.equal(rtl.side, "right", "RTL flips only when its preferred side cannot fit");
  assert.equal(rtl.origin, 0);
  const narrow = submenuPlacement(
    anchor,
    { width: 304, height: 184 },
    { width: 320, height: 200 },
    true,
  );
  assert.equal(narrow.x, 8);
  assert.equal(narrow.y, 8);
  assert.ok(narrow.origin > 0 && narrow.origin < 100);
});
