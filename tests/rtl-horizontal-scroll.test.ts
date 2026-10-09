import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function fixture(direction = "rtl", stride?: number) {
  let now = 0;
  let frame: ((now: number) => void) | undefined;
  const load = (file: string, requireMock: (name: string) => unknown) => {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const exports: any = {};
    new Function("require", "exports", "getComputedStyle", "performance", "requestAnimationFrame", "cancelAnimationFrame", "setTimeout", compiled)(
      requireMock, exports, () => ({ direction }), { now: () => now },
      (fn: (at: number) => void) => { frame = fn; return 1; },
      () => { frame = undefined; }, () => {},
    );
    return exports;
  };
  const coordinates = load("../src/lib/horizontal-scroll.ts", () => ({}));
  const hook = load("../src/lib/use-drag-scroll.ts", (name) => name === "react"
    ? { useRef: (value: unknown) => ({ current: value }) } : coordinates);
  const api = hook.useDragScroll({ stride });
  const el = { scrollLeft: 0, scrollWidth: 2400, clientWidth: 600,
    style: { scrollSnapType: "", scrollBehavior: "" }, setPointerCapture() {}, releasePointerCapture() {} };
  api.ref.current = el;
  return { el, coordinates,
    drag(from: number, to: number) {
      api.handlers.onPointerDown({ button: 0, pointerType: "mouse", pointerId: 1, clientX: from });
      now += 24;
      api.handlers.onPointerMove({ pointerId: 1, clientX: to });
      api.handlers.onPointerUp({ pointerId: 1 });
      for (let n = 0; frame && n < 30; n++) {
        now += 40; const next = frame; frame = undefined; next(now);
      }
    },
  };
}

test("RTL reports logical progress and clamps elastic overscroll at both ends", () => {
  const h = fixture();
  h.el.scrollLeft = -400;
  assert.deepEqual(h.coordinates.horizontalScrollState(h.el), { rtl: true, max: 1800, position: 400 });
  h.el.scrollLeft = 30;
  assert.equal(h.coordinates.horizontalScrollState(h.el).position, 0);
  h.el.scrollLeft = -1900;
  assert.equal(h.coordinates.horizontalScrollState(h.el).position, 1800);
});

test("RTL momentum stays in the negative range instead of snapping back to the start", () => {
  const h = fixture("rtl", 260);
  h.drag(100, 260);
  assert.ok(h.el.scrollLeft < -160);
  assert.ok(h.el.scrollLeft >= -1800);
  assert.equal(h.el.style.scrollSnapType, "");
  assert.equal(h.el.style.scrollBehavior, "");
});

test("RTL dragging toward the beginning returns to zero without crossing it", () => {
  const h = fixture("rtl", 260);
  h.el.scrollLeft = -900;
  h.drag(600, 300);
  assert.equal(Math.abs(h.el.scrollLeft), 0);
});

test("LTR snapping and unsnapped RTL rails retain forward momentum", () => {
  const ltr = fixture("ltr", 260);
  ltr.drag(600, 450);
  assert.ok(ltr.el.scrollLeft > 150 && ltr.el.scrollLeft <= 1800);
  const rtl = fixture(); rtl.drag(100, 250);
  assert.ok(rtl.el.scrollLeft < -150 && rtl.el.scrollLeft >= -1800);
});

test("rows narrower than the viewport cannot acquire an invalid offset", () => {
  const h = fixture(); h.el.scrollWidth = 300;
  h.drag(100, 240);
  assert.equal(Math.abs(h.el.scrollLeft), 0);
  assert.equal(h.coordinates.horizontalScrollState(h.el).max, 0);
});
