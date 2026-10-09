import assert from "node:assert/strict";
import test from "node:test";
import { createMikuDance, MIKU_DANCE } from "../src/lib/music/miku-dance";
import { createMikuDance as baselineDance } from "./fixtures/miku-dance-before-duration";

type Signal = { highlight?: boolean; danceFit?: number; excitement?: number; active?: boolean; locked?: boolean };
function fixture(kind = 0, period = 500, create = createMikuDance) {
  const dance = create(kind);
  dance.selectTrack("first");
  let now = 0;
  let state = dance.advance(0, { beat: 0, period, locked: true, excitement: .8, highlight: true, danceFit: 1 }, true, true);
  const tick = (signal: Signal = {}) => {
    now += 16;
    state = dance.advance(16, { beat: now / period, period, locked: signal.locked ?? true,
      excitement: signal.excitement ?? .8, highlight: signal.highlight ?? true, danceFit: signal.danceFit ?? 1 }, signal.active ?? true, true);
    return state;
  };
  while (state.stage !== "dancing" && now < 30000) tick();
  assert.equal(state.stage, "dancing");
  const started = now;
  return { dance, tick, get age() { return now - started; }, get state() { return state; } };
}

test("fit or highlight dips at 5–10 seconds recover without shortening any routine", () => {
  for (const kind of [0, 1]) for (const period of [300, 500, 850]) {
    for (const loss of [{ highlight: false }, { danceFit: .3 }, { highlight: false, danceFit: .3, locked: false }]) {
      const f = fixture(kind, period);
      while (f.age < 35000) {
        const state = f.tick(f.age >= 5000 && f.age < 10000 ? loss : {});
        assert.equal(state.stage, "dancing", `${kind}/${period}: ${f.age} ms`);
      }
    }
  }
});

test("persistent ordinary classifier loss gets at least 20 seconds and ends on a whole loop", () => {
  for (const kind of [0, 1]) for (const period of [300, 500, 850]) {
    const f = fixture(kind, period);
    while (f.state.stage === "dancing" && f.age < 40000) {
      const before = f.age;
      f.tick(before >= 5000 ? { highlight: false, danceFit: .3 } : {});
      if (before < 19968) assert.equal(f.state.stage, "dancing");
    }
    assert.equal(f.state.stage, "leaving");
    assert.ok(f.age >= 19968 && f.age <= 20000 + MIKU_DANCE.loopBeats[kind] * period + 32);
    const cycles = f.age / period / MIKU_DANCE.loopBeats[kind];
    assert.ok(Math.abs(cycles - Math.round(cycles)) < .05);
    assert.equal(f.state.opacity, 1);
    assert.ok(f.state.frame <= MIKU_DANCE.reachFrames + MIKU_DANCE.loopFrames[kind] + 1);
  }
});

test("recovery cancels a scheduled exit before the hands start to leave", () => {
  for (const kind of [0, 1]) {
    const period = 850, loopMs = MIKU_DANCE.loopBeats[kind] * period;
    const startDip = Math.ceil(20000 / loopMs) * loopMs + loopMs * .05;
    const endDip = startDip + 1000;
    const f = fixture(kind, period);
    while (f.age < endDip + loopMs + 5000) {
      const state = f.tick(f.age >= startDip && f.age < endDip ? { highlight: false } : {});
      assert.equal(state.stage, "dancing", `${kind}: pending exit survived recovery at ${f.age}`);
    }
  }
});

test("a clear sustained percussion collapse ends early, even with a lingering highlight", () => {
  for (const kind of [0, 1]) for (const period of [300, 500, 850]) {
    const f = fixture(kind, period);
    while (f.age < 4000) f.tick();
    const droppedAt = f.age;
    while (f.state.stage === "dancing" && f.age < 20000) f.tick({ excitement: .12 });
    assert.equal(f.state.stage, "leaving");
    assert.ok(f.age < 20000);
    assert.ok(f.age - droppedAt <= Math.max(1400, period * 4) + MIKU_DANCE.loopBeats[kind] * period + 32);
  }
});

test("a brief low-intensity fill recovers without a deferred early exit", () => {
  for (const kind of [0, 1]) {
    const f = fixture(kind);
    while (f.age < 30000) {
      const state = f.tick(f.age >= 5500 && f.age < 6200 ? { excitement: .1, highlight: false, danceFit: .3 } : {});
      assert.equal(state.stage, "dancing");
    }
  }
});

test("pause, silence and track changes keep exactly the baseline authored stop poses", () => {
  for (const kind of [0, 1]) for (const period of [300, 500, 850]) for (const reason of ["pause", "silence", "track"]) {
    const current = fixture(kind, period), baseline = fixture(kind, period, baselineDance);
    while (current.age < 5000) { current.tick(); baseline.tick(); }
    if (reason === "track") { current.dance.selectTrack("next"); baseline.dance.selectTrack("next"); }
    const signal = reason === "track" ? {} : { active: false, excitement: 0, highlight: false, locked: false };
    const stoppedAt = current.age;
    while (current.state.stage !== "listening" && current.age - stoppedAt < 3000) {
      assert.deepEqual(current.tick(signal), baseline.tick(signal));
    }
    assert.equal(current.state.stage, "listening");
    assert.ok(current.age - stoppedAt < 2500);
  }
});

test("a recovered transient does not rearm another dance in one continuous section", () => {
  const f = fixture(1);
  let bouts = 1, previous = "dancing";
  while (f.age < 180000) {
    const state = f.tick(f.age >= 5000 && f.age < 10000 ? { highlight: false, danceFit: .3 } : {});
    if (state.stage === "dancing" && previous !== "dancing") bouts++;
    previous = state.stage;
  }
  assert.equal(bouts, 1);
});

test("the old policy reproduces a premature exit from one recovered signal sample", () => {
  const f = fixture(1, 500, baselineDance);
  while (f.age < 5500) f.tick();
  f.tick({ danceFit: .3 });
  while (f.state.stage === "dancing" && f.age < 12000) f.tick();
  assert.equal(f.state.stage, "leaving");
  assert.ok(f.age < 10000);
});

test("the 20-second floor measures elapsed music time through mid-dance tempo changes", () => {
  for (const kind of [0, 1]) for (const nextPeriod of [300, 850]) {
    const f = fixture(kind, 500);
    let age = 0, beat = 0, state = f.state;
    while (state.stage === "dancing" && age < 35000) {
      const period = age < 8000 ? 500 : nextPeriod;
      age += 16; beat += 16 / period;
      state = f.dance.advance(16, { beat, period, locked: true, excitement: .8,
        highlight: age < 5000, danceFit: age < 5000 ? 1 : .3 }, true, true);
      if (age < 20000) assert.equal(state.stage, "dancing");
    }
    assert.equal(state.stage, "leaving");
    assert.ok(age >= 20000 && age <= 20000 + MIKU_DANCE.loopBeats[kind] * nextPeriod + 32);
  }
});
