// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { updatePosterDock, resetPosterDock } from "../src/lib/poster-dock.ts";

interface MockStyle {
  transform: string;
  transformOrigin: string;
  willChange: string;
  transition: string;
  zIndex: string;
}

interface MockElement {
  style: MockStyle;
  children: MockElement[];
  querySelector: (sel: string) => MockElement | null;
  contains: (el: MockElement) => boolean;
  getBoundingClientRect: () => {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
  };
}

function createMockElement(rect: { left: number; right: number; width: number }): MockElement {
  const visual: MockElement = {
    style: {
      transform: "",
      transformOrigin: "",
      willChange: "",
      transition: "",
      zIndex: "",
    },
    children: [],
    querySelector: () => null,
    contains: () => true,
    getBoundingClientRect: () => ({
      left: rect.left,
      right: rect.right,
      top: 0,
      bottom: 270,
      width: rect.width,
      height: 270,
    }),
  };

  const element: MockElement = {
    style: {
      transform: "",
      transformOrigin: "",
      willChange: "",
      transition: "",
      zIndex: "",
    },
    children: [visual],
    querySelector: (sel: string) => (sel === "[data-preview-anchor]" ? visual : null),
    contains: (el: MockElement) => el === visual,
    getBoundingClientRect: () => ({
      left: rect.left,
      right: rect.right,
      top: 0,
      bottom: 270,
      width: rect.width,
      height: 270,
    }),
  };

  return element;
}

function parseTransform(transform: string): { x: number; y: number; scale: number } {
  const match = transform.match(
    /translate3d\(([-\d.]+)px,\s*([-\d.]+)px,\s*0\)\s*scale\(([-\d.]+)\)/,
  );
  if (!match) return { x: 0, y: 0, scale: 1 };
  return {
    x: Number(match[1]),
    y: Number(match[2]),
    scale: Number(match[3]),
  };
}

test("poster dock aligns transformOrigin and clamps x for edge cards", async (t) => {
  const cellWidth = 180;
  const gap = 20;
  const stride = cellWidth + gap; // 200
  const count = 5;
  const trackWidth = count * stride - gap; // 980

  function setupTrack(rtl = false) {
    const children: MockElement[] = [];
    for (let i = 0; i < count; i++) {
      const left = rtl ? trackWidth - (i + 1) * cellWidth - i * gap : i * stride;
      const right = left + cellWidth;
      children.push(createMockElement({ left, right, width: cellWidth }));
    }

    const track: MockElement = {
      style: {
        transform: "",
        transformOrigin: "",
        willChange: "",
        transition: "",
        zIndex: "",
      },
      children,
      querySelector: () => null,
      contains: (el) => children.includes(el),
      getBoundingClientRect: () => ({
        left: 0,
        right: trackWidth,
        top: 0,
        bottom: 270,
        width: trackWidth,
        height: 270,
      }),
    };

    return { track, children };
  }

  await t.test("last poster in LTR row aligns to right bottom and does not shift right", () => {
    const { track, children } = setupTrack(false);
    const lastChild = children[count - 1];
    const visual = lastChild.querySelector("[data-preview-anchor]")!;

    // Hover over center of the last card (index 4: left=800, right=980, center=890)
    updatePosterDock({
      track: track as unknown as HTMLElement,
      pointerX: 890,
      cellWidth,
      gap,
      scrollPosition: 0,
      rtl: false,
      transitionMs: 300,
    });

    assert.equal(visual.style.transformOrigin, "right bottom");
    const parsed = parseTransform(visual.style.transform);
    assert.ok(parsed.scale > 1, `expected scale > 1, got ${parsed.scale}`);
    assert.ok(parsed.x <= 0, `expected x <= 0 to avoid right-edge overflow, got ${parsed.x}`);

    resetPosterDock(track as unknown as HTMLElement);
  });

  await t.test("last poster in RTL row aligns to left bottom and does not shift left", () => {
    const { track, children } = setupTrack(true);
    const lastChild = children[count - 1];
    const visual = lastChild.querySelector("[data-preview-anchor]")!;

    // In RTL, the last child (index 4) is at visual end (contentX = 4 * 200 + 90 = 890 from right)
    // pointerX = trackWidth - 890 = 980 - 890 = 90
    updatePosterDock({
      track: track as unknown as HTMLElement,
      pointerX: 90,
      cellWidth,
      gap,
      scrollPosition: 0,
      rtl: true,
      transitionMs: 300,
    });

    assert.equal(visual.style.transformOrigin, "left bottom");
    const parsed = parseTransform(visual.style.transform);
    assert.ok(parsed.scale > 1, `expected scale > 1, got ${parsed.scale}`);
    assert.ok(parsed.x >= 0, `expected x >= 0 to avoid left-edge overflow, got ${parsed.x}`);

    resetPosterDock(track as unknown as HTMLElement);
  });

  await t.test("first poster in LTR row aligns to left bottom and does not shift left", () => {
    const { track, children } = setupTrack(false);
    const firstChild = children[0];
    const visual = firstChild.querySelector("[data-preview-anchor]")!;

    // Hover center of first card (index 0: center=90)
    updatePosterDock({
      track: track as unknown as HTMLElement,
      pointerX: 90,
      cellWidth,
      gap,
      scrollPosition: 0,
      rtl: false,
      transitionMs: 300,
    });

    assert.equal(visual.style.transformOrigin, "left bottom");
    const parsed = parseTransform(visual.style.transform);
    assert.ok(parsed.scale > 1, `expected scale > 1, got ${parsed.scale}`);
    assert.ok(parsed.x >= 0, `expected x >= 0, got ${parsed.x}`);

    resetPosterDock(track as unknown as HTMLElement);
  });

  await t.test("first poster in RTL row aligns to right bottom and does not shift right", () => {
    const { track, children } = setupTrack(true);
    const firstChild = children[0];
    const visual = firstChild.querySelector("[data-preview-anchor]")!;

    // In RTL, index 0 is at right edge (pointerX = 980 - 90 = 890)
    updatePosterDock({
      track: track as unknown as HTMLElement,
      pointerX: 890,
      cellWidth,
      gap,
      scrollPosition: 0,
      rtl: true,
      transitionMs: 300,
    });

    assert.equal(visual.style.transformOrigin, "right bottom");
    const parsed = parseTransform(visual.style.transform);
    assert.ok(parsed.scale > 1, `expected scale > 1, got ${parsed.scale}`);
    assert.ok(parsed.x <= 0, `expected x <= 0, got ${parsed.x}`);

    resetPosterDock(track as unknown as HTMLElement);
  });

  await t.test("middle poster uses center bottom transform origin", () => {
    const { track, children } = setupTrack(false);
    const middleChild = children[2];
    const visual = middleChild.querySelector("[data-preview-anchor]")!;

    // Hover center of middle card (index 2: 2 * 200 + 90 = 490)
    updatePosterDock({
      track: track as unknown as HTMLElement,
      pointerX: 490,
      cellWidth,
      gap,
      scrollPosition: 0,
      rtl: false,
      transitionMs: 300,
    });

    assert.equal(visual.style.transformOrigin, "center bottom");
    const parsed = parseTransform(visual.style.transform);
    assert.ok(parsed.scale > 1, `expected scale > 1, got ${parsed.scale}`);

    resetPosterDock(track as unknown as HTMLElement);
  });
});
