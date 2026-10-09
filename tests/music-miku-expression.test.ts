import assert from "node:assert/strict";
import test from "node:test";
import { createMikuExpression } from "../src/lib/music/miku-expression";

test("headphone listening keeps the eyes closed without periodic looks up", () => {
  const eyes = createMikuExpression();
  eyes.advance(200, true);
  for (let time = 0; time < 120000; time += 20) {
    assert.deepEqual(eyes.advance(20, true), { closure: 1, kind: "enjoy" });
  }
});

test("eyes ease shut in wall time, including at ten frames per second", () => {
  for (const step of [10, 100]) {
    const eyes = createMikuExpression();
    let previous = 0, elapsed = 0;
    while (elapsed < 300) {
      elapsed += step;
      const p = eyes.advance(step, true);
      assert.ok(p.closure >= previous && p.closure <= 1);
      if (elapsed < 180) assert.ok(p.closure > 0 && p.closure < 1);
      else assert.equal(p.closure, 1);
      previous = p.closure;
    }
  }
});

test("a delayed frame does not make her look up", () => {
  const eyes = createMikuExpression();
  eyes.advance(200, true);
  for (const elapsed of [1000, 10000, NaN, -10]) {
    assert.deepEqual(eyes.advance(elapsed, true), { closure: 1, kind: "enjoy" });
  }
});

test("leaving the listening pose or resetting clears the eye overlay", () => {
  const eyes = createMikuExpression();
  eyes.advance(200, true);
  assert.deepEqual(eyes.advance(0, false), { closure: 0, kind: "open" });
  assert.equal(eyes.advance(90, true).closure, .5);
  eyes.reset();
  assert.equal(eyes.advance(0, true).closure, 0);
});
