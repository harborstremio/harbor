// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { apiFixture, componentFixture, deferred } from "../scripts/benchmark-name-sync.mjs";
import { createNameSyncSession } from "../src/lib/account/name-sync-session.ts";
import {
  bindNameSyncState,
  getNameSyncState,
  retryNameSync,
} from "../src/lib/account/name-sync-state.ts";

test("edits during initial fetch persist without the old alias overwriting them", async () => {
  const d = deferred();
  const h = componentFixture({ load: () => d.promise });
  h.edit("اسم جديد");
  d.resolve("Original");
  await h.flush();
  assert.equal(h.name(), "اسم جديد");
  assert.deepEqual(h.writes, ["اسم جديد"]);
  assert.equal(h.phases.at(-1), "saved");
  h.dispose();
});

test("unrelated profile rerenders do not cancel account initialization", async () => {
  const d = deferred();
  const h = componentFixture({ load: () => d.promise });
  h.updateAvatar();
  d.resolve("Remote name");
  await h.flush();
  assert.equal(h.name(), "Remote name");
  h.edit("New name");
  await h.flush();
  assert.deepEqual(h.writes, ["New name"]);
  h.dispose();
});

test("failed save remains retryable without another name edit", async () => {
  let fail = true;
  const h = componentFixture({
    save: async () => {
      if (fail) throw new Error("offline");
    },
  });
  await h.flush();
  h.edit("Edited");
  await h.flush();
  assert.equal(h.phases.at(-1), "error");
  fail = false;
  h.retry();
  await h.flush();
  assert.deepEqual(h.writes, ["Edited", "Edited"]);
  assert.equal(h.phases.at(-1), "saved");
  h.dispose();
});

test("failed initialization is not an empty alias and retry preserves edits", async () => {
  let fail = true;
  const h = componentFixture({
    load: async () => {
      if (fail) throw new Error("offline");
      return "Old remote";
    },
  });
  await h.flush();
  h.edit("Edited");
  await h.flush();
  assert.deepEqual(h.writes, []);
  fail = false;
  h.retry();
  await h.flush();
  assert.equal(h.name(), "Edited");
  assert.deepEqual(h.writes, ["Edited"]);
  h.dispose();
});

test("writes serialize and coalesce intervening edits", async () => {
  const d = deferred();
  let server = "Original";
  const h = componentFixture({
    save: async (name: string) => {
      if (name === "First") await d.promise;
      server = name;
    },
  });
  await h.flush();
  h.edit("First");
  await h.flush();
  h.edit("Middle");
  h.edit("Last");
  await h.flush();
  assert.deepEqual(h.writes, ["First"]);
  d.resolve();
  await h.flush();
  assert.deepEqual(h.writes, ["First", "Last"]);
  assert.equal(server, "Last");
  h.dispose();
});

test("disposing during initial load prevents stale profile changes", async () => {
  const d = deferred();
  const h = componentFixture({ load: () => d.promise });
  h.dispose();
  d.resolve("Old account");
  await h.flush();
  assert.equal(h.name(), "Original");
  assert.deepEqual(h.writes, []);
});

test("disposing during save prevents queued follow-up writes", async () => {
  const d = deferred();
  const h = componentFixture({ save: () => d.promise });
  await h.flush();
  h.edit("First");
  await h.flush();
  h.edit("Second");
  h.dispose();
  d.resolve();
  await h.flush();
  assert.deepEqual(h.writes, ["First"]);
});

test("empty aliases initialize from a real local name, not a Guest placeholder", async () => {
  for (const [name, expected] of [
    ["Local", ["Local"]],
    ["Guest 1234", []],
    ["", []],
  ] as const) {
    const writes: string[] = [];
    const session = createNameSyncSession({
      name,
      load: async () => null,
      save: async (n) => {
        writes.push(n);
      },
      apply() {},
      status() {},
    });
    await session.start();
    assert.deepEqual(writes, expected);
    session.dispose();
  }
});

test("HTTP failures and transport errors propagate instead of reporting success", async () => {
  for (const status of [400, 401, 403, 429, 500]) {
    const h = apiFixture({ fetch: async () => new Response(null, { status }) });
    await assert.rejects(h.api.pushNameToProfileAlias("Edited", "fixture-account"));
    assert.equal(h.requests.length, 1);
  }
  const h = apiFixture({
    fetch: async () => {
      throw new Error("offline");
    },
  });
  await assert.rejects(h.api.pushNameToProfileAlias("Edited", "fixture-account"));
});

test("an expired token refreshes once and saves with the refreshed token", async () => {
  let calls = 0;
  const h = apiFixture({
    fetch: async () => new Response(null, { status: ++calls === 1 ? 401 : 204 }),
    refresh: async ({ setToken }: { setToken: (v: string) => void }) => {
      setToken("refreshed-fixture");
      return true;
    },
  });
  await h.api.pushNameToProfileAlias("Edited", "fixture-account");
  assert.equal(calls, 2);
  assert.equal(
    new Headers(h.requests[1].init.headers).get("authorization"),
    "Bearer refreshed-fixture",
  );
});

test("account changes during refresh cannot send the saved name to the new account", async () => {
  const h = apiFixture({
    fetch: async () => new Response(null, { status: 401 }),
    refresh: async ({ setAccount }: { setAccount: (v: string) => void }) => {
      setAccount("different-account");
      return true;
    },
  });
  await assert.rejects(h.api.pushNameToProfileAlias("Edited", "fixture-account"));
  assert.equal(h.requests.length, 1);
});

test("signed out saves fail, while valid names are normalized and timeout bounded", async () => {
  const h = apiFixture();
  h.setToken(null);
  await assert.rejects(h.api.pushNameToProfileAlias("Edited", "fixture-account"));
  assert.equal(h.requests.length, 0);
  h.setToken("fixture");
  await h.api.pushNameToProfileAlias("  New name  ", "fixture-account");
  assert.deepEqual(JSON.parse(h.requests[0].init.body), { alias: "New name" });
  assert.ok(h.requests[0].init.signal instanceof AbortSignal);
});

test("stale status bindings cannot overwrite or retry a different account", () => {
  let a = 0,
    b = 0;
  const first = bindNameSyncState("a", () => {
    a++;
  });
  const second = bindNameSyncState("b", () => {
    b++;
  });
  first.publish("error");
  first.dispose();
  retryNameSync();
  assert.deepEqual(getNameSyncState(), { accountId: "b", phase: "idle" });
  assert.equal(a, 0);
  assert.equal(b, 1);
  second.dispose();
});
