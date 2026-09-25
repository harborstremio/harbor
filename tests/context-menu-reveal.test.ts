import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as placement from "../src/components/context-menu/menu-placement.ts";

function vertices(polygon: string) {
  return [...polygon.matchAll(/(-?[\d.]+)% (-?[\d.]+)%/g)].map((match) => [
    Number(match[1]),
    Number(match[2]),
  ]);
}
function visible(
  reveal: { clipFrom: string; clipTo: string },
  progress: number,
  x: number,
  y: number,
) {
  const from = vertices(reveal.clipFrom);
  const to = vertices(reveal.clipTo);
  const points = from.map((point, index) =>
    point.map((value, axis) => value + (to[index][axis] - value) * progress),
  );
  const sides = points.map((point, index) => {
    const next = points[(index + 1) % points.length];
    return (next[0] - point[0]) * (y - point[1]) - (next[1] - point[1]) * (x - point[0]);
  });
  return sides.every((side) => side >= -0.001) || sides.every((side) => side <= 0.001);
}

test("root reveal uncovers from the real fitted anchor with an angled boundary and fixed content size", () => {
  assert.equal(
    typeof placement.menuReveal,
    "function",
    "shared placement must supply 2D reveal geometry",
  );
  for (const [anchor, near, far] of [
    [{ x: 40, y: 50 }, [8, 8], [92, 92]],
    [{ x: 280, y: 350 }, [92, 92], [8, 8]],
    [{ x: 40, y: 350 }, [8, 92], [92, 8]],
    [{ x: 280, y: 50 }, [92, 8], [8, 92]],
  ] as const) {
    const reveal = placement.menuReveal(anchor, { x: 40, y: 50 }, { width: 240, height: 300 });
    assert.equal(vertices(reveal.clipFrom).length, 4);
    assert.equal(vertices(reveal.clipTo).length, 4, "mask topology remains interpolatable");
    assert.equal(visible(reveal, 0, near[0], near[1]), false);
    assert.equal(visible(reveal, 0.4, near[0], near[1]), true);
    assert.equal(visible(reveal, 0.4, far[0], far[1]), false);
    assert.equal(visible(reveal, 1, far[0], far[1]), true);
  }
});

test("submenus connect to their own parent and freeze meaningful above, below and straddling geometry", () => {
  const size = { width: 220, height: 280 };
  const viewport = { width: 900, height: 640 };
  for (const rtl of [false, true]) {
    const below = placement.submenuPlacement(
      { left: 330, right: 530, top: 80, bottom: 116 },
      size,
      viewport,
      rtl,
    );
    assert.ok(below.reveal, "submenu must expose its own opening geometry");
    assert.equal(below.reveal.originY, 0);
    assert.equal(below.reveal.originX, below.side === "left" ? 100 : 0);
    const above = placement.submenuPlacement(
      { left: 330, right: 530, top: 618, bottom: 650 },
      size,
      viewport,
      rtl,
    );
    assert.equal(above.reveal.originY, 100, "above direction does not depend on horizontal side");
    const straddling = placement.submenuPlacement(
      { left: 330, right: 530, top: 470, bottom: 502 },
      size,
      viewport,
      rtl,
    );
    assert.ok(straddling.reveal.originY > 0 && straddling.reveal.originY < 100);
  }
});

test("entrance reveal never moves a parent row while its submenu measures that anchor", () => {
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
  const entrance = css.slice(
    css.indexOf("@keyframes context-menu-enter"),
    css.indexOf("@keyframes context-menu-detail-enter"),
  );
  assert.ok(entrance.includes("clip-path:"), "the opening still reveals rather than only fading");
  assert.doesNotMatch(entrance, /\b(?:transform|translate|scale)\s*:/);
});
