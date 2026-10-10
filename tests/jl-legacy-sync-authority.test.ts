import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

const root = fileURLToPath(new URL("../src", import.meta.url));
const ownerKey = "jl.account.workspace.owner.v1";
const queueKey = "harbor.sync.queue";

// Execute the actual auth, transport, scheduler, engine and roster modules. Only
// browser/storage/network and public build configuration are fixture boundaries.
function harness(configured = false) {
  const values = new Map<string, string>([
    [
      "harbor.profiles.v1",
      JSON.stringify({
        activeId: "p_local",
        profiles: [{ id: "p_local", name: "Local", isPrimary: true, color: "blue", createdAt: 1 }],
      }),
    ],
    [
      "harbor.theme-session.p_local",
      JSON.stringify({
        token: "fixture-community-token",
        refresh: "fixture-community-refresh",
        user: { id: "community-user", username: "fixture" },
      }),
    ],
    ["harbor.theme-session.repaired.v2", "1"],
    [
      queueKey,
      JSON.stringify({ since: 1, items: [{ key: "account:profiles" }, { key: "s_old:home" }] }),
    ],
    ["harbor.sync.idmap", JSON.stringify({ p_local: "s_old" })],
    ["harbor.sync.roster.known", "[]"],
    ["harbor.sync.tombstones", "[]"],
    [
      "harbor.sync.parked.account:profiles",
      JSON.stringify({ value: { profiles: [] }, parkedAt: 1, lostToRev: 3 }),
    ],
  ]);
  let blockedStorage = false;
  const mutations: string[] = [];
  const storage = {
    get length() {
      return values.size;
    },
    key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => {
      if (blockedStorage) throw new Error("storage blocked");
      return values.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      mutations.push(key);
      values.set(key, value);
    },
    removeItem: (key: string) => {
      mutations.push(key);
      values.delete(key);
    },
  };
  const requests: string[] = [];
  let respond: (url: string) => Promise<Response> = async () =>
    Response.json({ docs: [], rev: 0, serverTime: "" });
  const transport = (url: string) => {
    requests.push(url);
    return respond(url);
  };
  let timer = 0;
  const timers = new Map<number, () => void>();
  const events = new Map<string, Set<() => void>>();
  const window = {
    setTimeout: (fn: () => void) => {
      timers.set(++timer, fn);
      return timer;
    },
    clearTimeout: (id: number) => {
      timers.delete(id);
    },
    addEventListener: (name: string, fn: () => void) => {
      if (!events.has(name)) events.set(name, new Set());
      events.get(name)!.add(fn);
    },
    removeEventListener: (name: string, fn: () => void) => {
      events.get(name)?.delete(fn);
    },
    dispatchEvent: (event: Event) => {
      for (const fn of events.get(event.type) ?? []) fn();
    },
  };
  const env = { VITE_JL_SUPABASE_URL: configured ? "https://fixture-jl.invalid" : "" };
  const modules = new Map<string, { exports: any }>();
  function load(file: string): any {
    const filename = path.resolve(root, file);
    if (modules.has(filename)) return modules.get(filename)!.exports;
    const module = { exports: {} };
    modules.set(filename, module);
    const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      transformers: {
        before: [
          (context) => (source) => {
            const visit: ts.Visitor = (node) =>
              ts.isMetaProperty(node)
                ? ts.factory.createIdentifier("testImportMeta")
                : ts.visitEachChild(node, visit, context);
            return ts.visitNode(source, visit) as ts.SourceFile;
          },
        ],
      },
    }).outputText;
    const require = (specifier: string) => {
      if (specifier === "@/lib/config/endpoints")
        return { HARBOR_API_BASE: "https://fixture-community.invalid" };
      if (specifier === "@/lib/safe-fetch") return { safeFetch: transport };
      const next = specifier.startsWith("@/")
        ? path.join(root, specifier.slice(2))
        : path.resolve(path.dirname(filename), specifier);
      return load(next.endsWith(".ts") ? next : next + ".ts");
    };
    new Function(
      "require",
      "module",
      "exports",
      "localStorage",
      "window",
      "document",
      "fetch",
      "testImportMeta",
      compiled,
    )(require, module, module.exports, storage, window, { visibilityState: "visible" }, transport, {
      env,
    });
    return module.exports;
  }
  const scheduler = load("lib/profile-sync/scheduler.ts");
  const engine = load("lib/profile-sync/engine.ts");
  const client = load("lib/profile-sync/client.ts");
  const roster = load("lib/profile-sync/roster-section.ts");
  const store = load("lib/profile-sync/roster-store.ts");
  const sections = load("lib/profile-sync/sections.ts");
  const revs = load("lib/profile-sync/revs.ts");
  let applies = 0;
  store.configureRosterStore({
    read: () => JSON.parse(values.get("harbor.profiles.v1")!).profiles,
    apply: () => {
      applies++;
    },
  });
  roster.registerRosterSection();
  sections.registerSection("home", {
    read: () => ({ rows: ["local"] }),
    write: () => {
      applies++;
    },
  });
  revs.markHydrated("s_old:home");
  return {
    values,
    mutations,
    requests,
    timers,
    scheduler,
    engine,
    client,
    roster,
    store,
    sections,
    auth: load("lib/theme-auth.ts"),
    social: load("lib/social/client.ts"),
    get applies() {
      return applies;
    },
    blockStorage: () => {
      blockedStorage = true;
    },
    respond: (fn: typeof respond) => {
      respond = fn;
    },
  };
}

for (const scope of ["configured-build", "local", "user-a", "session-only", "unreadable-owner"]) {
  test(`JL ${scope} blocks every legacy writer with a valid remembered community session`, async () => {
    const h = harness(scope === "configured-build");
    if (scope === "local" || scope === "user-a") h.values.set(ownerKey, scope);
    if (scope === "session-only") h.values.set("jl.account.session.v1", "fixture-session");
    if (scope === "unreadable-owner") h.blockStorage();
    const before = new Map(h.values);
    assert.equal(h.auth.currentAuthor().id, "community-user");
    assert.ok(h.auth.authToken() && h.auth.refreshTokenValue());
    assert.equal(h.client.syncArm(), "off");
    h.scheduler.startProfileSync();
    h.scheduler.requestSyncPull();
    h.scheduler.scheduleFlush(0);
    h.scheduler.flushSyncNow();
    h.scheduler.markSectionDirty("profiles");
    h.scheduler.markSectionCleared("home", "p_local");
    assert.equal(h.scheduler.restoreParkedSection("profiles"), false);
    assert.equal((await h.engine.runPull()).ok, false);
    assert.equal((await h.engine.runPush()).ok, false);
    await assert.rejects(h.client.fetchSyncState(), /JL account profiles/);
    await assert.rejects(
      h.client.pushSyncWrites([{ key: "account:profiles", baseRev: 0, clear: true }]),
      /JL account profiles/,
    );
    h.roster.noteProfileDeleted("p_local");
    h.roster.seedRosterFromLocal();
    h.roster.clearRosterSectionState();
    h.engine.resetSyncState();
    const adapter = h.sections.sectionAdapter("profiles");
    adapter.read("");
    assert.equal(adapter.write("", { profiles: [] }), false);
    assert.equal(
      h.store.applyRoster({ replaceWith: [], dropLocalIds: ["p_local"], syncIdByLocalId: {} }),
      false,
    );
    assert.equal(h.timers.size, 0);
    assert.equal(h.requests.length, 0);
    assert.equal(h.applies, 0);
    assert.deepEqual(h.mutations, []);
    assert.deepEqual(h.values, before);
  });
}

test("community API stays available and an unclaimed Harbor workspace retains legacy sync", async () => {
  const h = harness();
  assert.equal(h.client.syncArm(), "ok");
  await h.client.fetchSyncState();
  h.values.set(ownerKey, "local");
  await h.social.socialGet("/themes/fixture");
  assert.equal(h.requests.length, 2);
  assert.ok(h.requests[1].endsWith("/themes/fixture"));
  assert.equal(h.auth.currentAuthor().id, "community-user");
});

test("a legacy pull that completes after JL adoption cannot apply or reset the roster", async () => {
  const h = harness();
  let finish!: (response: Response) => void;
  h.respond(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = h.engine.runPull();
  assert.equal(h.requests.length, 1);
  h.values.set(ownerKey, "user-a");
  const before = new Map(h.values);
  finish(
    Response.json({ docs: [{ key: "account:profiles", rev: 2, value: { profiles: [] } }], rev: 2 }),
  );
  assert.equal((await pending).ok, false);
  assert.equal(h.applies, 0);
  assert.deepEqual(h.mutations, []);
  assert.deepEqual(h.values, before);
});

for (const outcome of ["accepted", "conflict", "rejected"]) {
  test(`a late legacy ${outcome} push preserves the pending queue after JL adoption`, async () => {
    const h = harness();
    let finish!: (response: Response) => void;
    h.respond(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = h.engine.runPush();
    assert.equal(h.requests.length, 1);
    h.values.set(ownerKey, "user-a");
    const before = new Map(h.values);
    const result =
      outcome === "accepted"
        ? { key: "s_old:home", ok: true, rev: 2 }
        : {
            key: "s_old:home",
            ok: false,
            current: { key: "s_old:home", rev: 2, value: { rows: ["remote"] } },
          };
    finish(
      Response.json(
        outcome === "rejected"
          ? { key: "s_old:home", error: "fixture rejection" }
          : { results: [result] },
        { status: outcome === "rejected" ? 422 : 200 },
      ),
    );
    assert.equal((await pending).ok, false);
    assert.equal(h.applies, 0);
    assert.deepEqual(h.mutations, []);
    assert.deepEqual(h.values, before);
  });
}

test("already scheduled legacy timers are inert after JL claims the workspace", async () => {
  const h = harness();
  const stop = h.scheduler.startProfileSync();
  h.scheduler.scheduleFlush(0);
  assert.equal(h.timers.size, 2);
  h.values.set(ownerKey, "local");
  for (const callback of h.timers.values()) callback();
  h.scheduler.flushSyncNow();
  await Promise.resolve();
  assert.equal(h.requests.length, 0);
  assert.equal(h.applies, 0);
  assert.deepEqual(h.mutations, []);
  stop();
});
