import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = ts.transpileModule(
  readFileSync(new URL("../../src/lib/music/queue-order.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } },
).outputText;
const { MusicQueueOrder, queueTrackKey } = await import(
  "data:text/javascript;base64," + Buffer.from(source).toString("base64")
);
const q = ["a", "b", "c"].map((id) => ({ id, connectorId: "local" }));
const off = { shuffle: true, repeat: "off" };
test("shuffle exhausts once with Repeat off", () => {
  const o = new MusicQueueOrder();
  let at = 0;
  const seen = [q[0].id];
  for (let i = 0; i < 3; i++) {
    const n = o.next(q, at, off, true, null, () => 0);
    if (!n) break;
    seen.push(n.id);
    at = q.indexOf(n);
  }
  assert.deepEqual(seen, ["a", "b", "c"]);
  assert.equal(o.next(q, at, off, true), null);
});
test("repeat all starts a fresh shuffled cycle without immediate repeat", () => {
  const o = new MusicQueueOrder();
  o.next(q, 0, off, true, null, () => 0);
  o.next(q, 1, off, true, null, () => 0);
  assert.equal(
    o.next(q, 2, { ...off, repeat: "all" }, true, null, () => 0),
    q[0],
  );
});
test("shuffle Previous and Next traverse heard history", () => {
  const o = new MusicQueueOrder();
  assert.equal(
    o.next(q, 0, off, true, null, () => 0.99),
    q[2],
  );
  assert.equal(o.previous(q, 2, true), q[0]);
  assert.equal(o.next(q, 0, off, false), q[2]);
});
test("repeat one only repeats on automatic advance", () => {
  const o = new MusicQueueOrder();
  assert.equal(o.next(q, 0, { shuffle: false, repeat: "one" }, true), q[0]);
  assert.equal(o.next(q, 0, { shuffle: false, repeat: "one" }, false), q[1]);
});
test("play next has priority over shuffle", () =>
  assert.equal(
    new MusicQueueOrder().next(q, 0, off, false, q[2], () => 0),
    q[2],
  ));
test("removed history entries do not break Previous", () => {
  const o = new MusicQueueOrder();
  o.next(q, 0, off, true, null, () => 0.99);
  assert.equal(o.previous([q[2]], 0, true), null);
});
test("provider identity and source fallback are stable", () => {
  assert.notEqual(queueTrackKey(q[0]), queueTrackKey({ ...q[0], connectorId: "soundcloud" }));
  assert.equal(
    queueTrackKey(q[0]),
    queueTrackKey({
      id: "replacement",
      connectorId: "youtube",
      collectionOrigin: { id: "a", connectorId: "local" },
    }),
  );
});
test("single track ends with shuffle on, repeats only when asked", () => {
  const o = new MusicQueueOrder();
  assert.equal(o.next([q[0]], 0, off, true), null);
  assert.equal(o.next([q[0]], 0, { ...off, repeat: "all" }, true), q[0]);
});
test("new play intent resets previous session history", () => {
  const o = new MusicQueueOrder();
  o.next(q, 0, off, true, null, () => 0);
  o.reset();
  assert.equal(o.previous(q, 1, true), null);
  assert.equal(
    o.next(q, 0, off, true, null, () => 0),
    q[1],
  );
});
