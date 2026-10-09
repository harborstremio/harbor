import assert from "node:assert/strict";
import test from "node:test";
import { createMikuDance, createMikuDanceMemory, MIKU_DANCE } from "../src/lib/music/miku-dance";

const routines = MIKU_DANCE.loopFrames.map((_, kind) => kind);
const nextRoutine = (kind: number) => (kind + 1) % routines.length;

function pulse(beat: number, excitement = 0.8, locked = true, period = 500, highlight = locked && excitement >= .5) {
  return { beat, excitement, locked, period, highlight };
}
function fixture(kind = 0, period = 500, repertoire: NonNullable<Parameters<typeof createMikuDance>[1]> = MIKU_DANCE) {
  const memory = createMikuDanceMemory(kind, repertoire);
  const dance = createMikuDance(memory, repertoire);
  dance.selectTrack("first-song");
  let now = 0;
  let state = dance.advance(0, pulse(0, .8, true, period), true, true);
  return {
    memory, dance,
    get now() { return now; },
    get state() { return state; },
    tick(energy = .8, active = true, ready = true, locked = true, highlight = locked && energy >= .5) {
      now += 16;
      return state = dance.advance(16, pulse(now / period, energy, locked, period, highlight), active, ready);
    },
    until(stage: string, limit = 160000) {
      const end = now + limit;
      while (state.stage !== stage && now < end) this.tick();
      assert.equal(state.stage, stage);
      return now;
    },
  };
}

test("an unchanging peak has a bounded dance that still ends on a complete loop", () => {
  for (const period of [300, 400, 500, 750, 850]) for (const kind of routines) {
    const f = fixture(kind, period);
    const started = f.until("dancing");
    assert.ok(started >= MIKU_DANCE.firstWaitMs);
    const ended = f.until("leaving");
    const duration = ended - started;
    const rounding = MIKU_DANCE.loopBeats[kind] * period / 2 + 32;
    assert.ok(Math.abs(duration - MIKU_DANCE.maximumDanceMs) <= rounding, `kind ${kind}, period ${period}: ${duration}ms`);
    const cycles = duration / period / MIKU_DANCE.loopBeats[kind];
    assert.ok(Math.abs(cycles - Math.round(cycles)) < .05, "finish the complete choreography loop");
    f.until("listening");
    assert.equal(f.state.opacity, 0);
    assert.notEqual(f.state.kind, kind);
  }
});

test("one unchanging energetic section earns only one dance, not timer-based repeats", () => {
  const f = fixture();
  let dances = 0, last = "listening";
  for (let i = 0; i < 240000 / 16; i++) {
    const state = f.tick();
    assert.ok(state.opacity === 0 || state.opacity === 1);
    if (state.stage === "dancing" && last !== "dancing") dances++;
    last = state.stage;
  }
  assert.equal(dances, 1);
});

test("a 30-second drop keeps dancing until its energy recedes, then a new drop varies the routine", () => {
  for (const period of [300, 500, 750]) for (const kind of routines) {
    const f = fixture(kind, period);
    f.until("dancing");
    const start = f.now;
    while (f.now - start < 30000) assert.equal(f.tick().stage, "dancing");
    while (f.state.stage === "dancing") f.tick(.35);
    assert.ok(f.now - start < 30000 + Math.max(MIKU_DANCE.sectionLossGraceMs, period * MIKU_DANCE.sectionLossGraceBeats) + MIKU_DANCE.loopBeats[kind] * period + 32);
    f.until("listening");
    const next = f.state.kind;
    assert.notEqual(next, kind);
    for (let i = 0; i < 25000 / 16; i++) assert.equal(f.tick(.35).stage, "listening");
    f.until("dancing");
    assert.equal(f.state.kind, next);
  }
});

test("the next routine and listening break survive track changes and visibility resets", () => {
  const f = fixture();
  f.until("dancing");
  const next = f.memory.next;
  const breakMs = f.memory.remainingMs;
  f.dance.reset();
  assert.equal(f.dance.next, next);
  assert.equal(f.memory.remainingMs, breakMs);
  const replacement = createMikuDance(f.memory);
  for (let now = 0; now < 15000; now += 16) {
    const state = replacement.advance(16, pulse(now / 500), true, true);
    assert.equal(state.stage, "listening", "changing songs must not buy an immediate new dance");
    assert.equal(state.kind, next);
  }
  let state;
  for (let now = 15000; now < 110000; now += 16) {
    state = replacement.advance(16, pulse(now / 500), true, true);
    if (state.stage === "dancing") break;
  }
  assert.equal(state?.stage, "dancing");
  assert.equal(state?.kind, next);
});

test("a new track still gets listening time even when the shared cooldown has expired", () => {
  const memory = createMikuDanceMemory(1);
  memory.remainingMs = 0;
  const dance = createMikuDance(memory);
  for (let now = 0; now < 7500; now += 16) {
    assert.equal(dance.advance(16, pulse(now / 500), true, true).stage, "listening");
  }
});

test("quiet music, missing art, lost rhythm and pause never start a dance", () => {
  for (const [active, ready, energy, locked] of [[true, false, .8, true], [true, true, .3, true], [true, true, .8, false], [false, true, .8, true]] as const) {
    const f = fixture();
    for (let i = 0; i < 150000 / 16; i++) assert.equal(f.tick(energy, active, ready, locked).stage, "listening");
    if (!active || !locked) assert.equal(f.memory.remainingMs, MIKU_DANCE.firstWaitMs);
  }
});

test("pause finishes every gesture through arms-down without a ghost or headphone teleport", () => {
  for (const kind of routines) for (const stopAt of ["preparing", "entering", "dancing", "leaving", "recovering"]) {
    const f = fixture(kind); f.until(stopAt);
    let rested = false, previous = f.state.frame;
    const settleMs = Math.max(1600, (MIKU_DANCE.stopExits[kind]?.everyBeats ?? 0) * 500 + MIKU_DANCE.lowerMs + 64);
    for (let n = 0; n < Math.ceil(settleMs / 16); n++) {
      const state = f.tick(.8, false, true, false);
      assert.ok(state.opacity === 0 || state.opacity === 1, "never dissolve two poses over each other");
      if (state.resting) rested = true;
      if (state.stage === "lowering") assert.ok(Math.abs(state.frame - previous) <= 5, "walk adjacent authored poses to rest");
      previous = state.frame;
    }
    assert.equal(f.state.opacity, 0);
    assert.equal(f.state.stage, "listening");
    if (stopAt !== "recovering") assert.ok(rested, `${stopAt} must explicitly hand over arms-down`);
  }
});

test("both hands visibly rest down before dancing and before returning to headphones", () => {
  const f = fixture();
  const resting = { entering: 0, leaving: 0 };
  for (let now = 0; now < 65000; now += 16) {
    const state = f.tick(now > 20000 ? .35 : .8);
    // Entry poses 21–24 and exit poses 16–19 have both arms fully down.
    if (state.stage === "entering" && state.frame >= 21 && state.frame <= 24) resting.entering += 16;
    const exit = state.frame - MIKU_DANCE.reachFrames - MIKU_DANCE.loopFrames[state.kind];
    if (state.stage === "leaving" && exit >= 16 && exit <= 19) resting.leaving += 16;
  }
  assert.ok(resting.entering >= 64 && resting.entering <= 160);
  assert.ok(resting.leaving >= 48 && resting.leaving <= 160);
});

test("the return follows its own forward-authored gesture rather than reversing the release", () => {
  for (const kind of routines) {
    const f = fixture(kind); f.until("leaving");
    let previous = f.state.frame;
    const start = MIKU_DANCE.reachFrames + MIKU_DANCE.loopFrames[kind];
    assert.ok(previous >= start);
    while (f.state.stage === "leaving") {
      const state = f.tick();
      assert.ok(state.frame >= previous);
      assert.ok(state.frame < start + MIKU_DANCE.exitFrames);
      previous = state.frame;
    }
    assert.equal(previous, start + MIKU_DANCE.exitFrames - 1);
  }
});

test("losing tempo confidence mid-song carries the dance to its authored exit without fading", () => {
  const f = fixture(); f.until("dancing");
  const frame = f.state.frame;
  for (let i = 0; i < 180; i++) {
    const state = f.tick(.8, true, true, false);
    assert.equal(state.stage, "dancing");
    assert.equal(state.opacity, 1);
  }
  assert.notEqual(f.state.frame, frame);
  assert.equal(f.tick().stage, "dancing");
  let sawExit = false;
  for (let i = 0; i < 2000 && f.state.stage !== "listening"; i++) {
    const state = f.tick(.8, true, true, false);
    if (state.stage === "leaving") sawExit = true;
    assert.ok(state.opacity === 0 || state.opacity === 1);
  }
  assert.ok(sawExit);
  assert.equal(f.state.stage, "listening");
  assert.equal(f.state.opacity, 0);
});

test("dance atlas accents advance once per measured beat at different tempos", () => {
  for (const period of [300, 500, 750]) for (const kind of routines) {
    const f = fixture(kind, period); f.until("dancing");
    const start = f.now, frames: number[] = [];
    while (f.now - start < period * 2.2) frames.push(f.tick().frame - MIKU_DANCE.reachFrames);
    const perBeat = MIKU_DANCE.loopFrames[kind] / MIKU_DANCE.loopBeats[kind];
    let accents = 0;
    for (let i = 1; i < frames.length; i++) if (Math.floor(frames[i] / perBeat) !== Math.floor(frames[i - 1] / perBeat)) accents++;
    assert.equal(accents, 2, `kind ${kind} must not move in half time at ${period}ms`);
  }
});

test("headphone handoffs stay brisk at different tempos and the dance begins on a drum beat", () => {
  for (const period of [300, 400, 500, 650, 850]) for (const kind of routines) {
    const f = fixture(kind, period);
    const prepare = f.until("preparing");
    const start = f.until("dancing");
    assert.ok(start - prepare >= 650 && start - prepare <= 1350);
    assert.ok(Math.abs(start - Math.round(start / period) * period) <= 17, "the loop must start on the measured pulse");
    const leave = f.until("leaving");
    const rest = f.until("listening");
    assert.ok(rest - leave <= 1650, "return includes a smooth recovery without lingering");
  }
});

test("a frozen or rebased estimator clock cannot freeze or skip the dance's hand poses", () => {
  for (const kind of routines) {
    const f = fixture(kind); f.until("dancing");
    let state = f.state, exit = false;
    for (let i = 0; i < 2000 && state.stage !== "listening"; i++) {
      state = f.dance.advance(16, pulse(0, .8, false), true, true);
      assert.ok(state.opacity === 0 || state.opacity === 1);
      if (state.stage === "leaving") exit = true;
    }
    assert.ok(exit);
    assert.equal(state.stage, "listening");
  }
});

test("the next song differs from the last dance shown even after multiple dances in one song", () => {
  const f = fixture();
  f.until("dancing"); assert.equal(f.state.kind, 0);
  f.until("listening");
  for (let n = 0; n < 23000 / 16; n++) f.tick(.35);
  f.until("dancing"); assert.equal(f.state.kind, 1);
  f.until("listening");
  f.dance.selectTrack("second-song");
  f.until("dancing"); assert.equal(f.state.kind, nextRoutine(1));
  f.until("listening");
  f.dance.selectTrack("third-song");
  f.until("dancing"); assert.equal(f.state.kind, nextRoutine(nextRoutine(1)));
});

test("seeks, skipped songs, source replacements and remounts do not consume unseen routines", () => {
  const f = fixture();
  f.dance.selectTrack("first-song"); assert.equal(f.dance.next, 0);
  f.until("dancing");
  f.until("listening");
  f.dance.selectTrack("second-song"); assert.equal(f.dance.next, 1);
  const reopened = createMikuDance(f.memory);
  reopened.selectTrack("second-song"); assert.equal(reopened.next, 1);
  reopened.selectTrack("second-song-resolved-source"); assert.equal(reopened.next, 1);
  reopened.selectTrack("third-song"); assert.equal(reopened.next, 1);
  reopened.selectTrack("fourth-song"); assert.equal(reopened.next, 1);
});

test("changing songs during a dance finishes the outgoing hands before selecting the next routine", () => {
  for (const kind of routines) for (const stopAt of ["preparing", "entering", "dancing", "leaving", "recovering"]) {
    const f = fixture(kind); f.until(stopAt);
    const before = f.state;
    const next = f.memory.lastPerformed === null ? kind : nextRoutine(f.memory.lastPerformed);
    f.dance.selectTrack("second-song");
    let state = f.dance.advance(0, pulse(0), true, true);
    assert.equal(state.kind, before.kind, "selecting a song must not change the visible model pose sheet");
    assert.equal(state.opacity, before.opacity, "no instant fade or headphone teleport");
    for (let n = 0; n < 180 && state.stage !== "listening"; n++) state = f.tick();
    assert.equal(state.stage, "listening");
    assert.equal(state.kind, next);
    assert.ok(f.memory.remainingMs >= MIKU_DANCE.firstWaitMs);
    f.until("dancing"); assert.equal(f.state.kind, next);
  }
});

test("every routine follows the current drum pulse when a passage slows down or speeds up", () => {
  for (const kind of routines) {
    const f = fixture(kind, 500);
    f.until("dancing");
    let beat = f.now / 500, state = f.state;
    const perBeat = MIKU_DANCE.loopFrames[kind] / MIKU_DANCE.loopBeats[kind];
    for (const period of [750, 60000 / 110, 60000 / 180]) {
      let accents = 0, previous = Math.floor((state.frame - MIKU_DANCE.reachFrames) / perBeat);
      const duration = period * 8;
      for (let ms = 0; ms < duration; ms += 16) {
        beat += 16 / period;
        state = f.dance.advance(16, pulse(beat, .8, true, period), true, true);
        assert.equal(state.stage, "dancing");
        const accent = Math.floor((state.frame - MIKU_DANCE.reachFrames) / perBeat);
        if (accent !== previous) accents++;
        previous = accent;
      }
      assert.ok(Math.abs(accents - 8) <= 1, `${kind}: ${accents} accents over8beats at${60000 / period}BPM`);
    }
  }
});

test("unplayed source candidates and rapid skips cannot flip the next routine back to the previous dance", () => {
  for (const kind of routines) {
    const f = fixture(kind); f.until("dancing");
    for (const track of ["next-song", "next-song-source-fallback", "skipped-song", "audible-song"]) f.dance.selectTrack(track);
    let state = f.state;
    for (let n = 0; n < 180 && state.stage !== "listening"; n++) state = f.tick();
    assert.equal(state.stage, "listening");
    assert.equal(state.kind, nextRoutine(kind));
    f.until("dancing"); assert.equal(f.state.kind, nextRoutine(kind));
  }
});


test("every approved routine gets a turn before the cycle repeats across songs", () => {
  const f = fixture();
  const seen: number[] = [];
  for (let song = 0; song <= routines.length * 2; song++) {
    f.dance.selectTrack(`song-${song}`);
    f.until("dancing");
    seen.push(f.state.kind);
    assert.equal(f.memory.lastPerformed, f.state.kind);
    f.until("listening");
  }
  assert.deepEqual(seen, Array.from({ length: routines.length * 2 + 1 }, (_, i) => i % routines.length));
});

// The longer reference routine has a short arms-down exit every two beats.
const referenceRepertoire = {
  loopFrames: [64, 76], loopBeats: [2, 8], breaksMs: [16000, 18000],
  stopExits: [null, { everyBeats: 2, frameOffsets: [117, 158, 178, 198], frames: 20 }],
};

test("the eight-beat dance pauses at the next gesture without accelerating or skipping its short exit", () => {
  for (const period of [300, 500, 850]) for (const beat of [.1, 1.5, 2.1, 3.5, 4.1, 5.5, 6.1, 7.5]) {
    const f = fixture(1, period, referenceRepertoire);
    f.until("dancing");
    const start = f.now;
    while (f.now - start < beat * period) f.tick();
    let state = f.state, previous = state.frame, advanced = 0, duration = 0;
    let exitStart = -1, exitEnd = -1, rested = false;
    const expectedOffset = referenceRepertoire.stopExits[1]!.frameOffsets[(Math.floor(beat / 2) + 1) % 4];
    while (state.stage !== "listening" && duration < 3000) {
      state = f.tick(.8, false, true, false); duration += 16;
      assert.ok(state.opacity === 0 || state.opacity === 1);
      if (state.stage === "dancing") {
        advanced += (state.frame - previous + 76) % 76;
        assert.ok(Math.abs(advanced - duration / period * 76 / 8) < 1.1, "the last gesture stays at its measured tempo");
        previous = state.frame;
      }
      if (state.stage === "disengaging") {
        if (exitStart < 0) exitStart = state.frame;
        if (exitEnd >= 0) assert.ok(state.frame >= exitEnd && state.frame <= exitEnd + 1, "show consecutive authored arm poses");
        exitEnd = state.frame;
      }
      if (state.resting) rested = true;
    }
    assert.equal(state.stage, "listening"); assert.ok(rested);
    assert.equal(exitStart, expectedOffset);
    assert.equal(exitEnd, expectedOffset + 19);
    assert.ok(duration >= MIKU_DANCE.lowerMs && duration <= period * 2 + MIKU_DANCE.lowerMs + 32);
    assert.equal(state.kind, 0);
  }
});

test("rapid song changes cannot rush an eight-beat dance or restart its arms-down exit", () => {
  const f = fixture(1, 850, referenceRepertoire); f.until("dancing");
  f.dance.selectTrack("fast-next-song");
  let state = f.state, previous = state.frame, advanced = 0, duration = 0, exitStart = -1;
  while (state.stage !== "listening" && duration < 3000) {
    duration += 16;
    if (duration % 160 === 0) f.dance.selectTrack(`resolved-source-${duration}`);
    state = f.dance.advance(16, pulse(duration / 300, .8, true, 300), true, true);
    if (state.stage === "dancing") {
      advanced += (state.frame - previous + 76) % 76;
      assert.ok(Math.abs(advanced - duration / 850 * 76 / 8) < 1.1);
      previous = state.frame;
    }
    if (state.stage === "disengaging" && exitStart < 0) exitStart = state.frame;
    if (state.stage !== "listening") assert.equal(state.kind, 1);
    assert.ok(state.opacity === 0 || state.opacity === 1);
  }
  assert.equal(exitStart, 158);
  assert.equal(state.stage, "listening"); assert.equal(state.kind, 0);
  assert.equal(f.memory.lastPerformed, 1);
  assert.ok(duration >= 2200 && duration <= 2412, "finish two slow beats and lower despite incoming fast drums");
});

test("the eight-beat dance uses its full headphone return when the music leaves a highlight", () => {
  const f = fixture(1, 500, referenceRepertoire); f.until("dancing");
  let state = f.state;
  for (let n = 0; n < 1000 && state.stage !== "listening"; n++) {
    state = f.tick(.35);
    assert.notEqual(state.stage, "disengaging", "quiet passage keeps the normal headphone handoff");
    if (state.stage === "leaving") assert.ok(state.frame >= 117 && state.frame <= 157);
  }
  assert.equal(state.stage, "listening");
  assert.equal(f.memory.next, 0);
});

test("a delayed render crossing a stop boundary still shows the matching first exit pose", () => {
  const f = fixture(1, 500, referenceRepertoire); f.until("dancing");
  const start = f.now;
  while (f.now - start < 900) f.tick();
  const state = f.dance.advance(250, pulse((f.now + 250) / 500), false, true);
  assert.equal(state.stage, "disengaging");
  assert.equal(state.frame, 158, "do not consume the arms-down animation during the missed render");
  assert.equal(state.opacity, 1);
});

test("a busy render cannot leave the dance behind the drum clock", () => {
  for (const kind of routines) for (const period of [300, 500, 850]) {
    const f = fixture(kind, period); f.until("dancing");
    const beats = MIKU_DANCE.loopBeats[kind], frames = MIKU_DANCE.loopFrames[kind];
    const startBeat = Math.floor(f.now / period);
    let now = f.now, state = f.state;
    for (const gap of [16, 680, 16, 930, 16, 360, 16]) {
      now += gap;
      state = f.dance.advance(gap, pulse(now / period, .8, true, period), true, true);
      const expected = ((now / period - startBeat) % beats) / beats * frames;
      const actual = state.frame - MIKU_DANCE.reachFrames;
      const error = Math.abs(((actual - expected + frames * 1.5) % frames) - frames / 2);
      assert.equal(state.stage, "dancing");
      assert.ok(error < 1.01, `${kind} at ${period}ms: lagged by ${error} poses after ${gap}ms`);
    }
  }
});

test("the reference dance gently re-aligns its accents after a beat-clock rebase", () => {
  for (const period of [300, 500, 850]) for (const offset of [-.35, .35]) {
    const f = fixture(1, period); f.until("dancing");
    let beat = f.now / period, state = f.state;
    // Analysis briefly drops out while the song continues, then reacquires
    // the pulse with a new origin. She must not retain that phase error.
    for (let n = 0; n < 60; n++) {
      beat += 16 / period;
      state = f.dance.advance(16, pulse(beat, .8, false, period, true), true, true);
    }
    beat = ((beat % 1) + offset + 1) % 1;
    let advanced = 0, previous = state.frame;
    for (let n = 0; n < Math.ceil(period * 10 / 16); n++) {
      beat += 16 / period;
      state = f.dance.advance(16, pulse(beat, .8, true, period), true, true);
      assert.equal(state.stage, "dancing");
      const step = (state.frame - previous + 76) % 76;
      assert.ok(step <= 1, "recover gradually without reversing or skipping the hands");
      advanced += step; previous = state.frame;
    }
    const localBeat = (state.frame - MIKU_DANCE.reachFrames) * 8 / 76;
    const error = (beat - localBeat) - Math.round(beat - localBeat);
    assert.ok(Math.abs(error) < 8 / 76 + .02, `${period}ms/${offset}: ${error} beat out of phase`);
    assert.ok(advanced > 80, "keep dancing throughout recovery");
  }
});

test("a tempo correction during hands-down cannot stall or rush the entrance", () => {
  for (const [from, to] of [[300, 850], [850, 300]]) {
    const f = fixture(1, from); f.until("entering");
    while (f.state.frame < 20) f.tick();
    let state = f.state, beat = f.now / from, duration = 0;
    const frames = new Set<number>();
    while (state.stage === "entering" && duration < 2000) {
      duration += 16; beat += 16 / to;
      state = f.dance.advance(16, pulse(beat, .8, true, to), true, true);
      if (state.stage === "entering") frames.add(state.frame);
    }
    assert.equal(state.stage, "dancing");
    assert.ok(duration >= 240 && duration <= 520, `${from}→${to} stretched the last half of the handoff to ${duration}ms`);
    assert.ok(frames.size >= 14, "a faster estimate still shows the moving arm poses");
  }
});

test("the retained shorter groove settles at either half-loop without accelerating the last gesture", () => {
  for (const kind of [0]) for (const period of [300, 500, 850]) for (const phase of [.15, .65]) {
    const f = fixture(kind, period); f.until("dancing");
    const beats = MIKU_DANCE.loopBeats[kind], frames = MIKU_DANCE.loopFrames[kind];
    const start = f.now;
    while (f.now - start < phase * beats * period) f.tick();
    let state = f.state, prior = state.frame, advanced = 0, duration = 0;
    let exitStart = -1, exitEnd = -1;
    const expected = phase < .5 ? 146 : 105;
    while (state.stage !== "listening" && duration < 3000) {
      state = f.tick(.8, false, true, false); duration += 16;
      if (state.stage === "dancing") {
        advanced += (state.frame - prior + frames) % frames;
        assert.ok(Math.abs(advanced - duration / period * frames / beats) < 1.1);
        prior = state.frame;
      }
      if (state.stage === "disengaging") {
        if (exitStart < 0) exitStart = state.frame;
        if (exitEnd >= 0) assert.ok(state.frame >= exitEnd && state.frame <= exitEnd + 1);
        exitEnd = state.frame;
      }
      assert.ok(state.opacity === 0 || state.opacity === 1);
    }
    assert.equal(state.stage, "listening"); assert.ok(state.resting);
    assert.equal(exitStart, expected); assert.equal(exitEnd, expected + 19);
    assert.ok(duration >= MIKU_DANCE.lowerMs && duration <= period * beats / 2 + MIKU_DANCE.lowerMs + 32);
  }
});
