import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as favoritePolicy from "../src/lib/profile-favorite-actions.ts";
import type { FavoriteMedia } from "../src/lib/providers/favorites-types.ts";

const game: FavoriteMedia = {
  kind: "game",
  id: "game:1",
  name: "Existing game",
  image: null,
  sub: null,
  url: null,
  source: "igdb",
};
const savedFavorites = {
  game: [
    { ...game, id: "game:3", name: "First game", customMetadata: { rank: 1 } },
    { ...game, customMetadata: { rank: 2 } },
  ],
  book: [
    { ...game, kind: "book", id: "book:2", name: "First book", customMetadata: { rating: 5 } },
    { ...game, kind: "book", id: "book:1", name: "Second book" },
  ],
  music: [{ ...game, kind: "music", id: "music:4", name: "Artist" }],
};

// Execute the production mutation and parser; only account, request, and unused
// UI/provider boundaries are replaced. No real account or network is accessed.
function harness(snapshot: unknown) {
  const identity = { handle: "owner", profile: "fixture-profile", token: "fixture-token" };
  let serverSnapshot = structuredClone(snapshot);
  const requests: Array<{ url: string; method: string; body?: unknown }> = [];
  const requestControls = { afterGet: () => {} };
  const unused = () => {
    throw new Error("Unexpected UI or search dependency");
  };
  const mocks: Record<string, unknown> = {
    react: { useCallback: unused, useEffect: unused, useRef: unused, useState: unused },
    "@/lib/i18n": { useT: unused },
    "@/lib/theme-auth": {
      authToken: () => identity.token,
      currentAuthor: () => ({ handle: identity.handle }),
    },
    "@/lib/active-profile-id": { activeProfileId: () => identity.profile },
    "@/lib/config/endpoints": { HARBOR_API_BASE: "https://fixture.invalid" },
    "@/lib/providers/favorites-types": { searchFavorites: unused },
    "@/lib/profile-favorite-actions": favoritePolicy,
    "@/lib/safe-fetch": {
      safeFetch: async (url: string, init: RequestInit) => {
        assert.equal(new Headers(init.headers).get("authorization"), "Bearer fixture-token");
        const method = init.method ?? "GET";
        requests.push({
          url,
          method,
          ...(init.body ? { body: JSON.parse(String(init.body)) } : {}),
        });
        if (method === "GET") {
          assert.equal(url, "https://fixture.invalid/themes/api/social/u/owner");
          requestControls.afterGet();
        } else {
          assert.equal(method, "PATCH");
          assert.equal(url, "https://fixture.invalid/themes/api/social/me/profile");
          serverSnapshot = { handle: "owner", isOwner: true, ...JSON.parse(String(init.body)) };
        }
        return new Response(JSON.stringify(serverSnapshot));
      },
    },
  };
  const { outputText } = ts.transpileModule(
    readFileSync(new URL("../src/views/profile/use-favorites.ts", import.meta.url), "utf8"),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } },
  );
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    (name: string) => {
      assert.ok(Object.hasOwn(mocks, name), `Unexpected dependency: ${name}`);
      return mocks[name];
    },
    module,
    module.exports,
  );
  return {
    api: module.exports as typeof import("../src/views/profile/use-favorites.ts"),
    identity,
    requests,
    requestControls,
    snapshot: () => serverSnapshot,
  };
}

test("malformed and wrong-owner favorite reads never send a profile mutation", async () => {
  const owner = { handle: "owner", isOwner: true, favorites: savedFavorites };
  for (const snapshot of [
    null,
    {},
    { ...owner, handle: "someone-else" },
    { ...owner, isOwner: false },
    { ...owner, favorites: { ...savedFavorites, book: null } },
    { ...owner, favorites: { ...savedFavorites, music: [{}] } },
    { ...owner, favorites: { ...savedFavorites, game: [game, game] } },
  ]) {
    const h = harness(snapshot);
    await assert.rejects(
      h.api.addFavoriteToMyProfile({ ...game, id: "game:new" }),
      /confirm|safely/,
    );
    assert.deepEqual(
      h.requests.map((request) => request.method),
      ["GET"],
    );
    assert.deepEqual(h.snapshot(), snapshot);
  }
});

test("adding an existing profile item is an acknowledged no-op preserving all kinds and order", async () => {
  const original = { handle: "owner", isOwner: true, favorites: savedFavorites };
  const h = harness(original);
  await h.api.addFavoriteToMyProfile({ ...game, name: "A stale card label" });
  assert.deepEqual(
    h.requests.map((request) => request.method),
    ["GET"],
  );
  assert.deepEqual(h.snapshot(), original);
  assert.equal(h.api.isInOwnProfile(game), true);
});

test("adding a new profile item preserves the existing order and untouched metadata in the PATCH", async () => {
  const h = harness({ handle: "owner", isOwner: true, favorites: savedFavorites });
  const added = { ...game, id: "game:added", name: "Added game" };
  await h.api.addFavoriteToMyProfile(added);
  assert.deepEqual(
    h.requests.map((request) => request.method),
    ["GET", "PATCH"],
  );
  assert.deepEqual(h.requests[1].body, {
    favorites: {
      game: [...savedFavorites.game, added],
      book: savedFavorites.book,
      music: savedFavorites.music,
    },
  });
  assert.equal(h.api.isInOwnProfile(added), true);
});

test("account identity changes during the favorite read prevent its PATCH", async () => {
  const h = harness({ handle: "owner", isOwner: true, favorites: savedFavorites });
  h.requestControls.afterGet = () => {
    h.identity.token = "changed-token";
  };
  await assert.rejects(
    h.api.addFavoriteToMyProfile({ ...game, id: "game:new" }),
    /profile changed/,
  );
  assert.deepEqual(
    h.requests.map((request) => request.method),
    ["GET"],
  );
});
