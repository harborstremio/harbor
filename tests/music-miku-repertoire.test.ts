import assert from "node:assert/strict";
import test from "node:test";
import { createMikuDance, createMikuDanceMemory, MIKU_DANCE } from "../src/lib/music/miku-dance";
import { MIKU_DANCE as before } from "./fixtures/miku-dance-before-removal";

test("successive tracks cycle only retained sway and reference layouts with their authored exits", () => {
  const retained = [0, 2];
  for (const key of ["rows", "frameWidths", "loopFrames", "loopBeats", "breaksMs", "stopExits"] as const) {
    assert.deepEqual(MIKU_DANCE[key], retained.map(i => before[key][i]), key);
  }
  assert.deepEqual(MIKU_DANCE.loopFrames, [64, 76]);
  assert.deepEqual(MIKU_DANCE.frameWidths, [288, 384]);
  const memory = createMikuDanceMemory();
  const dance = createMikuDance(memory);
  let now = 0;
  const tick = (active = true) => {
    now += 16;
    const state = dance.advance(16, { beat: now / 500, period: 500, locked: true,
      excitement: .8, highlight: true, danceFit: 1 }, active, true);
    assert.ok(state.kind === 0 || state.kind === 1, "removed routine cannot reappear");
    assert.ok(state.opacity === 0 || state.opacity === 1);
    return state;
  };
  const seen: number[] = [];
  for (let track = 0; track < 5; track++) {
    dance.selectTrack(`audible-track-${track}`);
    let state = tick();
    const deadline = now + 35000;
    while (state.stage !== "dancing" && now < deadline) state = tick();
    assert.equal(state.stage, "dancing");
    const kind = state.kind;
    seen.push(kind);
    assert.equal(memory.lastPerformed, kind);
    const start = now, loopFrames = MIKU_DANCE.loopFrames[kind];
    const observed = new Set<number>();
    while (now - start < MIKU_DANCE.loopBeats[kind] * 500 * 2) {
      state = tick();
      assert.equal(state.stage, "dancing");
      assert.equal(state.kind, kind);
      assert.ok(state.frame >= 41 && state.frame < 41 + loopFrames);
      observed.add(state.frame);
    }
    assert.equal(Math.min(...observed), 41);
    assert.equal(Math.max(...observed), 41 + loopFrames - 1);
    const stopDeadline = now + 2500;
    let sawAuthoredExit = false;
    while (state.stage !== "listening" && now < stopDeadline) {
      state = tick(false);
      if (state.stage === "disengaging") {
        sawAuthoredExit = true;
        const stops = MIKU_DANCE.stopExits[kind]!;
        assert.ok(stops.frameOffsets.some(offset => state.frame >= offset && state.frame < offset + stops.frames));
      }
    }
    assert.ok(sawAuthoredExit);
    assert.equal(state.stage, "listening");
    assert.equal(state.kind, (kind + 1) % 2);
  }
  assert.deepEqual(seen, [0, 1, 0, 1, 0]);
});
