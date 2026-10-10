import assert from "node:assert/strict";
import test from "node:test";
import {
  startHdrStageSession,
  HDR_COLD_BOOT_TIMEOUT_MS,
  HDR_LIVENESS_TIMEOUT_MS,
} from "../src/lib/player/hdr-stage-session.ts";

const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
function harness(overrides = {}) {
  const calls = [];
  const timers = new Set();
  let ready,
    dead,
    serial = 0;
  const deps = {
    id: () => `stage-${++serial}`,
    open: async (id) => {
      calls.push(["open", id]);
    },
    show: async (id) => {
      calls.push(["show", id]);
      return true;
    },
    close: async (id) => {
      calls.push(["close", id]);
    },
    ready: async (fn) => {
      ready = fn;
      return () => calls.push(["off-ready"]);
    },
    dead: async (fn) => {
      dead = fn;
      return () => calls.push(["off-dead"]);
    },
    confirmed: (value) => calls.push(["confirmed", value]),
    fallback: () => calls.push(["fallback"]),
    schedule: (fn, ms) => {
      const timer = { fn, ms };
      timers.add(timer);
      return () => timers.delete(timer);
    },
    ...overrides,
  };
  const stop = startHdrStageSession(deps);
  return {
    calls,
    timers,
    stop,
    ready: (id = `stage-${serial}`) => ready(id),
    dead: (id = `stage-${serial}`) => dead(id),
    expire: () => {
      assert.equal(timers.size, 1);
      const [timer] = timers;
      timers.delete(timer);
      timer.fn();
      return timer.ms;
    },
  };
}

test("ready hands off only after native show succeeds; stale ready cannot show", async () => {
  let showDone;
  const h = harness({
    show: () =>
      new Promise((resolve) => {
        showDone = resolve;
      }),
  });
  await flush();
  assert.deepEqual(h.calls, [
    ["confirmed", false],
    ["open", "stage-1"],
  ]);
  h.ready("old-stage");
  assert.equal(showDone, undefined);
  h.ready();
  assert.equal(
    h.calls.some(([kind, value]) => kind === "confirmed" && value),
    false,
  );
  showDone(true);
  await flush();
  assert.deepEqual(h.calls.at(-1), ["confirmed", true]);
  assert.equal([...h.timers][0].ms, 8000);
  h.stop();
});

test("native open rejection fails promptly, without waiting 36 seconds", async () => {
  const h = harness({
    open: async () => {
      throw new Error("boot failed");
    },
  });
  await flush();
  assert.equal(h.timers.size, 0);
  assert.equal(h.calls.filter(([kind]) => kind === "fallback").length, 1);
  h.ready();
  assert.equal(
    h.calls.some(([kind]) => kind === "show"),
    false,
  );
});

test("timeouts remain unchanged; retry starts fresh and ignores the prior window", async () => {
  assert.equal(HDR_COLD_BOOT_TIMEOUT_MS, 12000);
  assert.equal(HDR_LIVENESS_TIMEOUT_MS, 8000);
  const h = harness();
  await flush();
  assert.equal(h.expire(), 12000);
  await flush();
  assert.deepEqual(h.calls.slice(-2), [
    ["close", "stage-1"],
    ["open", "stage-2"],
  ]);
  h.ready("stage-1");
  h.dead("stage-1");
  assert.equal(
    h.calls.some(([kind]) => kind === "show" || kind === "fallback"),
    false,
  );
  h.expire();
  await flush();
  h.expire();
  await flush();
  assert.equal(h.calls.filter(([kind]) => kind === "open").length, 3);
  assert.equal(h.calls.filter(([kind]) => kind === "fallback").length, 1);
});

test("lost heartbeat restores main controls and hides old UI before recovery", async () => {
  const h = harness();
  await flush();
  h.ready();
  await flush();
  h.calls.length = 0;
  assert.equal(h.expire(), 8000);
  await flush();
  assert.deepEqual(h.calls, [
    ["confirmed", false],
    ["close", "stage-1"],
    ["open", "stage-2"],
  ]);
  h.stop();
});

test("heartbeats refresh liveness without repeating the native handoff", async () => {
  const h = harness();
  await flush();
  h.ready();
  await flush();
  for (let i = 0; i < 100; i++) h.ready();
  assert.equal(h.calls.filter(([kind]) => kind === "show").length, 1);
  assert.equal(h.timers.size, 1);
  h.stop();
});

test("exit during native open closes the late window and never confirms it", async () => {
  let opened;
  const h = harness({
    open: () =>
      new Promise((resolve) => {
        opened = resolve;
      }),
  });
  await flush();
  h.stop();
  opened();
  await flush();
  h.ready();
  assert.equal(
    h.calls.some(([kind, value]) => kind === "confirmed" && value),
    false,
  );
  assert.deepEqual(h.calls.at(-1), ["close", "stage-1"]);
  assert.equal(h.timers.size, 0);
});

test("exit during show rejects late confirmation", async () => {
  let shown;
  const h = harness({
    show: () =>
      new Promise((resolve) => {
        shown = resolve;
      }),
  });
  await flush();
  h.ready();
  h.stop();
  shown(true);
  await flush();
  assert.equal(
    h.calls.some(([kind, value]) => kind === "confirmed" && value),
    false,
  );
  assert.deepEqual(h.calls.at(-1), ["close", "stage-1"]);
});

test("StrictMode cleanup while subscribing never opens an orphan window", async () => {
  const h = harness();
  h.stop();
  await flush();
  assert.equal(
    h.calls.some(([kind]) => kind === "open"),
    false,
  );
  assert.ok(h.calls.some(([kind]) => kind === "off-ready"));
});

test("crash signal and rejected show restore controls and retain the warning", async () => {
  for (const scenario of ["dead", "rejected", "stale"]) {
    const h = harness({
      show: async () => {
        if (scenario === "rejected") throw new Error("native failure");
        return scenario !== "stale";
      },
    });
    await flush();
    if (scenario === "dead") h.dead();
    else h.ready();
    await flush();
    assert.ok(h.calls.some(([kind]) => kind === "fallback"));
    assert.ok(h.calls.some(([kind, value]) => kind === "confirmed" && !value));
    assert.equal(h.timers.size, 0);
  }
});

test("repeated liveness failures have a bounded recovery budget", async () => {
  const h = harness();
  await flush();
  for (let i = 0; i < 4; i++) {
    h.ready();
    await flush();
    h.expire();
    await flush();
  }
  assert.equal(h.calls.filter(([kind]) => kind === "open").length, 4);
  assert.equal(h.calls.filter(([kind]) => kind === "fallback").length, 1);
});
