// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  artFileProblem,
  artObjectPath,
  createCustomArtStore,
  encodeObjectPath,
  isArtRef,
  resolveArt,
  slotsFromRows,
  type ArtRow,
} from "../src/lib/jl/sports/custom-art.ts";

const OWNER = "11111111-2222-3333-4444-555555555555";

test("art refs: team, athlete and college keys only", () => {
  assert.ok(isArtRef("team:ncaaf:2483"));
  assert.ok(isArtRef("athlete:nba:3975"));
  assert.ok(isArtRef("college:ncaa:2483"));
  assert.ok(!isArtRef("team:ncaaf"));
  assert.ok(!isArtRef("team:NCAAF:2483"));
  assert.ok(!isArtRef("team:ncaaf:../../x"));
  assert.ok(!isArtRef("channel:espn"));
});

test("rows become slots; slot rows beat legacy rows, channel art is left out", () => {
  const rows: ArtRow[] = [
    { kind: "team", ref_id: "team:ncaaf:2483", storage_path: `${OWNER}/old.png` },
    { kind: "hero", ref_id: "team:ncaaf:2483", storage_path: `${OWNER}/team:ncaaf:2483/hero.jpg` },
    { kind: "wordmark", ref_id: "team:ncaaf:2483", label: "Oregon Ducks", storage_path: "p/w.png" },
    { kind: "player", ref_id: "athlete:nfl:1", storage_path: "p/a.png" },
    { kind: "channel", ref_id: "team:nfl:12", storage_path: "p/c.png" },
    { kind: "hero", ref_id: "bogus", storage_path: "p/x.png" },
  ];
  const slots = slotsFromRows(rows);
  assert.deepEqual([...slots.keys()], ["team:ncaaf:2483", "athlete:nfl:1"]);
  assert.equal(
    slots.get("team:ncaaf:2483")?.get("hero")?.path,
    `${OWNER}/team:ncaaf:2483/hero.jpg`,
  );
  assert.equal(slots.get("team:ncaaf:2483")?.get("wordmark")?.label, "Oregon Ducks");
  assert.equal(slots.get("athlete:nfl:1")?.get("hero")?.path, "p/a.png");
});

test("object paths are <owner>/<ref>/<kind>.<ext>, escaped per segment for URLs", () => {
  const path = artObjectPath(OWNER, "team:ncaaf:2483", "story", "webp");
  assert.equal(path, `${OWNER}/team:ncaaf:2483/story.webp`);
  assert.equal(encodeObjectPath(path), `${OWNER}/team%3Ancaaf%3A2483/story.webp`);
});

test("missing slots borrow the hero; a wordmark never does", () => {
  const have: Record<string, string> = { hero: "H" };
  const lookup = (_ref: string, kind: string) => have[kind] ?? null;
  assert.deepEqual(resolveArt(lookup, "team:nfl:12", "hero"), {
    url: "H",
    kind: "hero",
    borrowed: false,
  });
  for (const kind of ["story", "card", "wallpaper"] as const)
    assert.deepEqual(resolveArt(lookup, "team:nfl:12", kind), {
      url: "H",
      kind: "hero",
      borrowed: true,
    });
  assert.equal(resolveArt(lookup, "team:nfl:12", "wordmark"), null);
  have.card = "C";
  assert.equal(resolveArt(lookup, "team:nfl:12", "card")?.url, "C");
  assert.equal(
    resolveArt(() => null, "team:nfl:12", "card"),
    null,
  );
});

test("file checks: type and size", () => {
  assert.equal(artFileProblem({ type: "image/png", size: 1000 }), null);
  assert.match(artFileProblem({ type: "image/gif", size: 1000 }) ?? "", /PNG/);
  assert.match(artFileProblem({ type: "image/jpeg", size: 40 * 1024 * 1024 }) ?? "", /15 MB/);
  assert.match(artFileProblem({ type: "image/webp", size: 0 }) ?? "", /empty/);
});

type Call = { base: "rest" | "storage"; path: string; init: RequestInit };

function fakeAccount(rows: ArtRow[]) {
  let ctx: { userId: string; generation: number } | null = { userId: OWNER, generation: 1 };
  const calls: Call[] = [];
  const listeners = new Set<() => void>();
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const ports = {
    context: () => ctx,
    rest: async (path: string, init: RequestInit = {}) => {
      calls.push({ base: "rest", path, init });
      if (path.startsWith("custom_art?select=")) return json(rows);
      if (init.method === "POST") {
        const body = JSON.parse(String(init.body)) as ArtRow;
        rows = [...rows.filter((r) => !(r.kind === body.kind && r.ref_id === body.ref_id)), body];
        return new Response(null, { status: 201 });
      }
      if (init.method === "DELETE") {
        const ref = decodeURIComponent(/ref_id=eq\.([^&]+)/.exec(path)?.[1] ?? "");
        rows = rows.filter((r) => r.ref_id !== ref);
        return new Response(null, { status: 204 });
      }
      return json({}, 404);
    },
    storage: async (path: string, init: RequestInit = {}) => {
      calls.push({ base: "storage", path, init });
      if (path === "object/sign/media-art") {
        const { paths } = JSON.parse(String(init.body)) as { paths: string[] };
        return json(
          paths.map((p) => ({
            path: p,
            signedURL: `/object/sign/media-art/${p}?token=t`,
            error: null,
          })),
        );
      }
      return json({ Key: path });
    },
    storageUrl: (rel: string) => `https://project.test/storage/v1${rel}`,
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  return {
    ports,
    calls,
    signOut() {
      ctx = null;
      for (const fn of listeners) fn();
    },
    signIn(userId: string) {
      ctx = { userId, generation: 2 };
      for (const fn of listeners) fn();
    },
  };
}

test("store: loads the owner's rows once, signs them, and answers lookups", async () => {
  const account = fakeAccount([
    { kind: "hero", ref_id: "team:ncaaf:2483", storage_path: `${OWNER}/team:ncaaf:2483/hero.jpg` },
  ]);
  const store = createCustomArtStore(account.ports);
  assert.equal(store.url("team:ncaaf:2483", "hero"), null);
  await store.load();
  assert.equal(
    store.url("team:ncaaf:2483", "hero"),
    `https://project.test/storage/v1/object/sign/media-art/${OWNER}/team:ncaaf:2483/hero.jpg?token=t`,
  );
  assert.equal(store.url("team:ncaaf:2483", "card"), null);
  assert.equal(store.status(), "ready");
  // Further lookups don't refetch.
  const before = account.calls.length;
  store.url("team:nfl:12", "hero");
  await store.load();
  assert.equal(account.calls.length, before);
});

test("store: sign-out forgets the art; another account starts empty", async () => {
  const account = fakeAccount([
    { kind: "hero", ref_id: "team:nfl:12", storage_path: `${OWNER}/team:nfl:12/hero.png` },
  ]);
  const store = createCustomArtStore(account.ports);
  await store.load();
  assert.ok(store.url("team:nfl:12", "hero"));
  account.signOut();
  assert.equal(store.url("team:nfl:12", "hero"), null);
  assert.equal(store.status(), "signed-out");
  account.signIn("99999999-0000-0000-0000-000000000000");
  assert.equal(store.url("team:nfl:12", "hero"), null);
});

test("store: upload puts the file in the owner's folder, upserts the row and reloads", async () => {
  const account = fakeAccount([]);
  const store = createCustomArtStore(account.ports);
  await store.load();
  const file = new Blob(["png"], { type: "image/png" });
  await store.upload("team:ncaaf:2483", "wordmark", file, "Oregon Ducks");
  const put = account.calls.find(
    (c) => c.base === "storage" && c.init.method === "POST" && !c.path.startsWith("object/sign"),
  );
  assert.equal(put?.path, `object/media-art/${OWNER}/team%3Ancaaf%3A2483/wordmark.png`);
  assert.equal(new Headers(put?.init.headers).get("x-upsert"), "true");
  const upsert = account.calls.find((c) => c.base === "rest" && c.init.method === "POST");
  assert.equal(upsert?.path, "custom_art?on_conflict=owner,kind,ref_id");
  assert.deepEqual(JSON.parse(String(upsert?.init.body)), {
    kind: "wordmark",
    ref_id: "team:ncaaf:2483",
    label: "Oregon Ducks",
    storage_path: `${OWNER}/team:ncaaf:2483/wordmark.png`,
  });
  assert.ok(store.url("team:ncaaf:2483", "wordmark"));
  assert.deepEqual(store.refs(), ["team:ncaaf:2483"]);

  await store.remove("team:ncaaf:2483", "wordmark");
  assert.equal(store.url("team:ncaaf:2483", "wordmark"), null);
  const removed = account.calls.find((c) => c.base === "storage" && c.init.method === "DELETE");
  assert.deepEqual(JSON.parse(String(removed?.init.body)), {
    prefixes: [`${OWNER}/team:ncaaf:2483/wordmark.png`],
  });
});

test("store: signed out, uploads are refused with a sign-in message", async () => {
  const account = fakeAccount([]);
  account.signOut();
  const store = createCustomArtStore(account.ports);
  await assert.rejects(
    store.upload("team:nfl:12", "hero", new Blob(["x"], { type: "image/png" })),
    /Sign in/,
  );
});
