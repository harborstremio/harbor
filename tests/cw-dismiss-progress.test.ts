// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import ts from "typescript";
import type { LibraryItem } from "../src/lib/stremio";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// Run the real dismissal module with isolated storage and no cloud/network writes.
function harness(seed?: string, onChange = () => {}) {
  let privateProfile: string | null = null;
  const data = new Map<string, string>();
  if (seed) data.set("harbor.cw.dismissed.v1", seed);
  const resume = new Map<string, { ms: number; t: number }>();
  const key = (id: string, s?: number, e?: number) => `${id}|${s}|${e}`;
  const mocks: Record<string, unknown> = {
    "./cw-profile": { privateCwProfileId: () => privateProfile },
    react: {
      useSyncExternalStore: (subscribe: (notify: () => void) => () => void) => {
        subscribe(onChange);
        return 0;
      },
    },
    "./resume": {
      readResumeEntry: (id: string, s?: number, e?: number) => resume.get(key(id, s, e)),
      clearResume: (id: string, s?: number, e?: number) => resume.delete(key(id, s, e)),
    },
    "./storage-recovery": {
      setItemWithRecovery: (k: string, v: string) => data.set(k, v),
    },
    "./stremio": {
      episodeFromVideoId: (id?: string) => {
        const parts = id?.split(":") ?? [];
        return parts.length === 3 ? { season: Number(parts[1]), episode: Number(parts[2]) } : null;
      },
    },
    "./stremio-write-queue": { cloudLibraryPut: () => Promise.resolve() },
  };
  const output = ts.transpileModule(read("src/lib/cw-dismiss.ts"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", "localStorage", output)(
    (name: string) => {
      assert.ok(Object.hasOwn(mocks, name), `Unexpected dependency: ${name}`);
      return mocks[name];
    },
    module,
    module.exports,
    { getItem: (k: string) => data.get(k) ?? null, removeItem: (k: string) => data.delete(k) },
  );
  return {
    api: module.exports as typeof import("../src/lib/cw-dismiss"),
    data,
    setPrivateProfile: (id: string | null) => { privateProfile = id; },
    setResume: (item: LibraryItem, ms: number, t: number) =>
      resume.set(key(item._id, item.state?.season, item.state?.episode), { ms, t }),
    resume,
  };
}

function item(external?: "trakt" | "simkl"): LibraryItem {
  return {
    _id: "tt-test",
    type: "series",
    name: "Test",
    removed: false,
    external,
    _mtime: "2020-01-01T00:00:00Z",
    state: { season: 1, episode: 2, video_id: "tt-test:1:2", timeOffset: 200, duration: 1000 },
  };
}

for (const source of [undefined, "trakt", "simkl"] as const) {
  test(`dismissed ${source ?? "library"} progress stays hidden until it advances`, () => {
    const h = harness();
    const value = item(source);
    h.api.dismissCw(value, null);
    assert.equal(h.api.isCwDismissed(value), true);
    assert.equal(
      h.api.isCwDismissed({ ...value, state: { ...value.state!, timeOffset: 205 } }),
      true,
    );
    assert.equal(
      h.api.isCwDismissed({ ...value, state: { ...value.state!, timeOffset: 300 } }),
      false,
    );
  });
}

test("fresh local resume overrides stale cloud recency for the same episode", () => {
  const h = harness();
  const value = item();
  h.api.dismissCw(value, null);
  h.setResume(value, 300, Date.now() + 1000);
  assert.equal(h.api.isCwDismissed(value), false);
});

test("an older tracker episode cannot undo dismissal, while later episodes and fresh rewatches can", () => {
  const h = harness();
  const current = item("simkl");
  h.api.dismissCw(current, null);
  const older = { ...current, state: { ...current.state!, episode: 1, video_id: "tt-test:1:1" } };
  assert.equal(h.api.isCwDismissed(older), true);
  const later = { ...current, state: { ...current.state!, episode: 3, video_id: "tt-test:1:3" } };
  assert.equal(h.api.isCwDismissed(later), false);
  h.setResume(older, 100, Date.now() + 1000);
  assert.equal(h.api.isCwDismissed(older), false);
});

test("external dismissal clears resume and persists its progress checkpoint", () => {
  const h = harness();
  const value = item("simkl");
  h.setResume(value, 400, Date.now() - 1000);
  h.api.dismissCw(value, null);
  assert.equal(h.resume.size, 0);
  const saved = h.data.get("harbor.cw.dismissed.v1")!;
  assert.equal(JSON.parse(saved)[value._id].p, 0.4);
  const reloaded = harness(saved);
  assert.equal(reloaded.api.isCwDismissed(value), true);
  assert.equal(
    reloaded.api.isCwDismissed({ ...value, state: { ...value.state!, timeOffset: 600 } }),
    false,
  );
});

test("a different episode resurfaces and legacy dismissal records remain readable", () => {
  const h = harness(JSON.stringify({ "tt-test": { t: Date.now(), v: "tt-test:1:2" } }));
  assert.equal(h.api.isCwDismissed(item()), true);
  const value = item();
  value.state = { ...value.state!, episode: 3, video_id: "tt-test:1:3" };
  assert.equal(h.api.isCwDismissed(value), false);
});

// Keep the real hook's stored advancement results across renders. Episode fetching
// is deliberately idle: dismissing a visible card must not wait for another fetch.
function advanceHarness(
  api: typeof import("../src/lib/cw-dismiss"),
  advanced: Map<string, LibraryItem>,
  extra: LibraryItem[],
) {
  const state = [{ privacyOwner: null, profileId: null, simklSession: null, simklEnabled: false },
    advanced, extra, new Set<string>(), 0];
  let slot = 0;
  const mocks: Record<string, unknown> = {
    "@/lib/profiles": { useProfiles: () => ({ activeProfile: null, profiles: [] }) },
    react: {
      useState: () => [state[slot++], () => {}],
      useRef: (current: unknown) => ({ current }),
      useEffect: () => {},
      useSyncExternalStore: () => null,
    },
    "@/lib/cw-dismiss": api,
    "@/lib/settings": { useSettings: () => ({ settings: { cwHideCaughtUp: false, cwSources: { simkl: false } } }) },
    "@/lib/providers/jikan": { franchiseDedupKey: (name: string) => name.toLowerCase() },
  };
  const output = ts.transpileModule(read("src/views/home/hooks/use-cw-advance.ts"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", output)(
    (name: string) => mocks[name] ?? {},
    module,
    module.exports,
  );
  const hook = (module.exports as typeof import("../src/views/home/hooks/use-cw-advance"))
    .useCwAdvance;
  return (items: LibraryItem[]) => {
    slot = 0;
    return hook(items, "", true);
  };
}

for (const kind of ["advanced", "resurfaced"] as const) {
  test(`dismissing the ${kind} up-next card hides the displayed episode immediately`, () => {
    let updates = 0;
    const h = harness(undefined, () => updates++);
    const previous = item();
    const visible: LibraryItem = {
      ...previous,
      upNext: true,
      state: { ...previous.state!, episode: 3, video_id: "tt-test:1:3", timeOffset: 0 },
    };
    const advanced = new Map<string, LibraryItem>();
    const extra: LibraryItem[] = [];
    if (kind === "advanced") advanced.set(visible._id, visible);
    else extra.push(visible);
    const render = advanceHarness(h.api, advanced, extra);
    const inputs = kind === "advanced" ? [previous] : [];
    assert.deepEqual(render(inputs), [visible]);

    h.api.dismissCw(visible, null);
    assert.equal(h.api.isCwDismissed(previous), true, "an older source cannot undo the dismissal");
    assert.deepEqual(render(inputs), [], "stored display results must respect dismissal");
    assert.ok(updates > 0, "the row subscribes to dismissal changes");

    h.setResume(visible, 100, Date.now() + 1000);
    assert.deepEqual(render(inputs), [visible], "new playback can restore the same episode");
    h.api.dismissCw(visible, null);
    const newer = { ...visible, state: { ...visible.state!, episode: 4, video_id: "tt-test:1:4" } };
    if (kind === "advanced") advanced.set(newer._id, newer);
    else extra[0] = newer;
    assert.deepEqual(render(inputs), [newer], "a later episode is not permanently hidden");
  });
}

test("external backfills preserve dismissals and save true remote progress only when newer", async () => {
  for (const provider of ["trakt", "simkl"]) {
    const source = read(`src/lib/${provider}/playback.ts`);
    let dismissed = true;
    let existing: { ms: number; t: number } | undefined;
    const writes: unknown[][] = [];
    const session = {};
    const remoteTime = Date.parse("2026-09-13T10:00:00Z");
    const mocks: Record<string, unknown> = {
      "./session": { getSession: () => session },
      "./client": {
        [`${provider}Request`]: async () => [
          {
            progress: 45,
            paused_at: new Date(remoteTime).toISOString(),
            movie: { title: "Fixture", ids: { imdb: "tt123456" } },
          },
        ],
      },
      "@/lib/cw-dismiss": { isCwDismissed: () => dismissed },
      "@/lib/resume": {
        readResumeEntry: () => existing,
        saveResumeMs: (...args: unknown[]) => writes.push(args),
        saveResumeBatch: (entries: any[]) => entries.forEach((e) => writes.push([e.id, e.ms, e.season, e.episode, undefined, e.pct, e.source])),
      },
    };
    const module = { exports: {} as Record<string, () => Promise<LibraryItem[]>> };
    const output = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    new Function("require", "module", "exports", output)(
      (name: string) => {
        assert.ok(Object.hasOwn(mocks, name));
        return mocks[name];
      },
      module,
      module.exports,
    );
    const fetchItems =
      module.exports[provider === "trakt" ? "fetchTraktPlaybackItems" : "fetchSimklPlaybackItems"];
    await fetchItems();
    assert.equal(writes.length, 0, `${provider}: dismissed progress must not be backfilled`);
    dismissed = false;
    existing = { ms: 1000, t: remoteTime + 1000 };
    await fetchItems();
    assert.equal(writes.length, 0, `${provider}: preserve newer local progress`);
    existing = { ms: 1000, t: remoteTime - 1000 };
    await fetchItems();
    assert.equal(writes.length, 1);
    assert.equal(writes[0][5], 0.45);
    assert.equal(writes[0][6], provider);
  }
});

test("source toggles preserve the shared-profile protection on desktop and mobile", () => {
  for (const path of ["src/views/home.tsx", "src/views/mobile/mobile-cw-row.tsx"]) {
    const source = read(path);
    assert.match(source, /!hideSharedCw/);
    assert.match(
      source,
      /settings\.cwSources\.trakt \|\| settings\.cwSources\.simkl \|\| settings\.cwSources\.publicmetadb/,
    );
  }
});

test("episode artwork is opt-in and changing candidates retries the first image", () => {
  assert.match(read("src/lib/settings/defaults.ts"), /cwPreferEpisodeStill: false/);
  const card = read("src/components/continue-card.tsx");
  assert.match(card, /upNext \|\| !settings\.cwPreferEpisodeStill/);
  assert.match(card, /if \(still && !seen\.has\(still\)\) out\.unshift\(still\)/);
  assert.match(card, /setImgIdx\(0\);\s*\}, \[candidates\]\)/);
});


test("private-store migration preserves old dismissals only for profiles that existed at upgrade", () => {
  const h = harness(JSON.stringify({ "tt-test": { t: Date.now(), v: "tt-test:1:2", s: 1, e: 2, p: 0.2 } }));
  h.data.set("harbor.profiles.v1", JSON.stringify({ profiles: [{ id: "alice" }, { id: "bob" }] }));
  h.setPrivateProfile("alice");
  assert.equal(h.api.isCwDismissed(item()), true);
  h.setPrivateProfile("bob");
  assert.equal(h.api.isCwDismissed(item()), true);
  h.setPrivateProfile("new-profile");
  assert.equal(h.api.isCwDismissed(item()), false);
  const advanced = { ...item(), state: { ...item().state!, episode: 3, video_id: "tt-test:1:3" } };
  h.setPrivateProfile("alice");
  assert.equal(h.api.isCwDismissed(advanced), false, "migration retains episode progress for resurfacing");
});

test("migration leaves existing private choices intact, including an empty store", () => {
  const h = harness(JSON.stringify({ "tt-test": Date.now() }));
  h.data.set("harbor.profiles.v1", JSON.stringify({ profiles: [{ id: "alice" }] }));
  h.data.set("harbor.cw.dismissed.private.v1.alice", "{}");
  h.setPrivateProfile("alice");
  assert.equal(h.api.isCwDismissed(item()), false);
  assert.equal(h.data.get("harbor.cw.dismissed.private.v1.alice"), "{}");
});

test("legacy Simkl-only dismissals migrate before the shared store consumes them", () => {
  const h = harness();
  h.data.set("harbor.profiles.v1", JSON.stringify({ profiles: [{ id: "alice" }] }));
  h.data.set("harbor.cw.dismissed.simkl", JSON.stringify(["tt-test"]));
  assert.equal(h.api.isCwDismissed(item("simkl")), true);
  h.setPrivateProfile("alice");
  assert.equal(h.api.isCwDismissed(item("simkl")), true);
});
