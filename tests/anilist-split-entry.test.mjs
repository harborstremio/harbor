// AniList splits a franchise into per-cour entries while Kitsu/MAL keep one
// entry. JoJo's provider season 6 is Kitsu entry 49847, which AniList maps to
// "Steel Ball Run - 1st STAGE" (1 episode). Episode 2 must land on the sequel
// entry that actually aired it, not be silently dropped.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const STAGE_1 = 190327;
const STAGE_2_3 = 210482;

function harness({ firstStatus = "FINISHED", firstEpisodes = 1 } = {}) {
  const profile = "a";
  let session = { userName: "a" };
  const writes = [];
  const queries = [];
  const request = async (query, options) => {
    if (query.startsWith("mutation")) {
      writes.push(options);
      return {
        SaveMediaListEntry: { id: 1, progress: options.progress, status: options.status },
      };
    }
    queries.push(options.id);
    if (options.id === STAGE_1) {
      return {
        Media: {
          id: STAGE_1,
          episodes: firstEpisodes,
          status: firstStatus,
          mediaListEntry: { id: 1, progress: 0, status: "CURRENT" },
          relations: {
            edges: [
              {
                relationType: "SEQUEL",
                node: { id: STAGE_2_3, episodes: 11, status: "RELEASING", mediaListEntry: null },
              },
            ],
          },
        },
      };
    }
    return {
      Media: {
        id: STAGE_2_3,
        episodes: 11,
        status: "RELEASING",
        mediaListEntry: null,
        relations: { edges: [] },
      },
    };
  };
  const source = readFileSync("src/lib/anilist/sync.ts", "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  new Function("require", "exports", "localStorage", code)(
    (id) => {
      const deps = {
        "@/lib/active-profile-id": { activeProfileId: () => profile },
        "@/lib/providers/anime-mapping": { kitsuToAnilist: async () => STAGE_1 },
        "./client": { anilistRequest: request, AnilistApiError: class extends Error {} },
        "./session": { isAuthenticated: () => true, getSession: () => session },
      };
      assert.ok(id in deps, `unexpected import ${id}`);
      return deps[id];
    },
    exports,
    { getItem: () => null, setItem: () => {} },
  );
  return { exports, writes, queries };
}

test("an episode past the mapped entry lands on the sequel cour that aired it", async () => {
  const h = harness();
  await h.exports.syncAnimeProgress("kitsu:49847", 2, "Steel Ball Run");
  assert.equal(h.writes.length, 1, "must not be dropped");
  assert.equal(h.writes[0].mediaId, STAGE_2_3, "2nd & 3rd STAGE owns this episode");
  assert.equal(h.writes[0].progress, 1, "it is that entry's first episode");
  assert.equal(h.writes[0].status, "CURRENT");
});

test("an episode inside the mapped entry still writes to it", async () => {
  const h = harness({ firstEpisodes: 12 });
  await h.exports.syncAnimeProgress("kitsu:49847", 2, "Steel Ball Run");
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].mediaId, STAGE_1);
  assert.equal(h.writes[0].progress, 2);
});

test("an airing entry is never hopped past", async () => {
  const h = harness({ firstStatus: "RELEASING" });
  await h.exports.syncAnimeProgress("kitsu:49847", 2, "Steel Ball Run");
  assert.equal(h.writes.length, 0, "an unpublished count is not proof of a split");
  assert.equal(h.queries.length, 1, "no relation walk without a finished entry");
});

test("the finale of the sequel cour completes that entry", async () => {
  const h = harness();
  await h.exports.syncAnimeProgress("kitsu:49847", 12, "Steel Ball Run");
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].mediaId, STAGE_2_3);
  assert.equal(h.writes[0].progress, 11);
  assert.equal(h.writes[0].status, "COMPLETED");
});
