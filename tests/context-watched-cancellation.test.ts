import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import type { Meta } from "../src/lib/cinemeta.ts";

type Reader = typeof import("../src/lib/context-watched-state.ts");
type Providers = typeof import("../src/lib/media-provider-actions.ts");

function loadModule<T>(path: string, mocks: Record<string, unknown>): T {
  const output = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", output)(
    (name: string) => {
      assert.ok(name in mocks, `Unexpected module boundary: ${name}`);
      return mocks[name];
    },
    module,
    module.exports,
  );
  return module.exports as T;
}

const meta: Meta = {
  id: "tt123",
  type: "series",
  name: "Fixture",
  videos: [{ id: "tt123:1:1", season: 1, episode: 1, released: "2020-01-01" }],
};

function harness() {
  let current = true;
  let releaseFirstPage!: (rows: unknown[]) => void;
  const firstPage = new Promise<unknown[]>((resolve) => {
    releaseFirstPage = resolve;
  });
  const reads: string[] = [];
  const disconnected = { isAuthenticated: () => false, getSession: () => null };
  const shared = {
    "./cinemeta": { meta: async () => meta },
    "./auth": { readActiveStremioAuthKey: () => null },
    "./stremio": { ANIME_CLOUD_ID: /^(kitsu|mal|anilist|anidb):/ },
    "./trakt/session": {
      isAuthenticated: () => true,
      getSession: () => ({ username: "fixture", refreshToken: "fixture" }),
    },
    "./trakt/ids": {
      stremioIdToTraktTarget: (id: string) => ({
        ok: true,
        target: { kind: "show", ids: { imdb: id } },
      }),
    },
    "./simkl/session": disconnected,
    "./simkl/ids": {},
    "./simkl/list-status": {},
  };
  const providers = loadModule<Providers>("../src/lib/media-provider-actions.ts", {
    ...shared,
    "./anilist/session": disconnected,
    "./mal/session": disconnected,
    "./stremio-item-lock": {},
    "./stremio-watched-sync": {},
    "./trakt/client": {
      traktRequest: async (path: string) => {
        reads.push(path);
        if (reads.length === 1) return firstPage;
        return [
          {
            show: { ids: { imdb: "tt123" } },
            seasons: [{ number: 1, episodes: [{ number: 1, plays: 1 }] }],
          },
        ];
      },
    },
    "./simkl/client": {},
    "./simkl/watchlist": {},
    "./simkl/history": {},
  });
  const reader = loadModule<Reader>("../src/lib/context-watched-state.ts", {
    ...shared,
    react: {},
    "./aired": { airedOnly: (videos: unknown[]) => videos },
    "./membership-operations": {
      captureMembershipProfile: () => ({ activeId: "fixture" }),
      isMembershipProfileCurrent: () => true,
    },
    "./stremio-watched": {},
    "./media-provider-actions": providers,
    "./anilist/session": disconnected,
    "./mal/session": disconnected,
    "./anilist/sync": {},
    "./anilist/mutations": {},
    "./mal/mutations": {},
    "./manual-watched": {},
    "./movie-watched": {},
    "./watched-flag": {},
    "./episode-progress": {},
  });
  return {
    reads,
    read: () => reader.readContextWatchedSnapshot({ meta }, () => current),
    cancel: () => {
      current = false;
    },
    release: () => releaseFirstPage([{ show: { ids: { imdb: "tt999" } }, seasons: [] }]),
  };
}

test("closing a menu during the first Trakt page stops pagination and discards the snapshot", async () => {
  const h = harness();
  const reading = h.read();
  assert.equal(h.reads.length, 1);
  const rejected = assert.rejects(reading, /menu is no longer open/i);
  h.cancel();
  h.release();
  await rejected;
  assert.equal(h.reads.length, 1);
});

test("an open menu continues past an unrelated first page and returns the matching episode", async () => {
  const h = harness();
  const reading = h.read();
  h.release();
  const snapshot = await reading;
  assert.equal(h.reads.length, 2);
  assert.match(h.reads[1], /page=2/);
  assert.deepEqual(snapshot.providers, [{ provider: "Trakt", watched: new Set(["1:1"]) }]);
});

test("an already closed menu starts no provider request", async () => {
  const h = harness();
  h.cancel();
  await assert.rejects(h.read(), /menu is no longer open/i);
  assert.deepEqual(h.reads, []);
});
