import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { animePlayEpisode } from "../src/views/detail/anime-play-episode.ts";
import { buildStreamIds } from "../src/lib/streams/stream-ids.ts";
import * as identityCore from "../src/lib/streams/anime-identity-core.ts";

const source = readFileSync(new URL("../src/views/detail.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("detail.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let playBody = "";
let prefetchBody = "";
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "smartPlay") {
    playBody = (node.initializer as ts.CallExpression).arguments[0].getText(ast);
  }
  if (ts.isCallExpression(node) && node.expression.getText(ast) === "useEffect" &&
      node.arguments[0]?.getText(ast).includes("prefetchSegments(playMeta,")) {
    prefetchBody = node.arguments[0].getText(ast);
  }
  ts.forEachChild(node, visit);
}
visit(ast);

function callback(body: string, context: Record<string, unknown>) {
  assert.ok(body, "real detail callback was found");
  const compiled = ts.transpileModule(`return (${body});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return new Function(...Object.keys(context), compiled)(...Object.values(context));
}

const episode = (patch: Record<string, unknown> = {}): any => ({
  id: 4, number: 4, seasonNumber: 1, title: "Trust", synopsis: "Episode description",
  thumbnail: "still.jpg", airdate: null, length: 24, streamId: "kitsu:399:4",
  imdbId: "tt2560140", imdbSeason: 3, imdbEpisode: 4, absoluteNumber: 41,
  tvdbEpisodeId: 123, sourceMetaId: "kitsu:399", ...patch,
});

test("the real hero play and prefetch preserve a saved episode absent from the loaded list", async () => {
  const requested: any[] = [];
  const context = {
    loading: false, isSeries: true, isAnime: true, idAnime: true, animeCanonicalId: "kitsu:310",
    animeEpisodes: [episode({ imdbSeason: 1, streamId: "kitsu:310:4" })],
    lastPlay: { season: 3, episode: 4 }, playMeta: { id: "kitsu:310", type: "series" },
    inSession: false, settings: { instantPlay: false }, animePlayEpisode,
    openPicker: (_meta: unknown, ep: unknown) => requested.push(ep),
    prefetchSegments: (_meta: unknown, ep: unknown) => requested.push(ep),
  };
  await callback(playBody, context)(true);
  callback(prefetchBody, context)();
  assert.equal(requested.length, 2);
  for (const target of requested) {
    assert.equal(target?.season, 3);
    assert.equal(target?.episode, 4);
    assert.equal(target?.imdbSeason, 3);
    assert.equal(target?.kitsuStreamId, undefined);
  }
  assert.deepEqual(requested[0], requested[1]);
});

test("a provider coordinate match retains the actual entry, IDs and episode metadata", () => {
  const target = animePlayEpisode([episode()], { season: 3, episode: 4 }, true, "kitsu:310");
  assert.equal(target?.name, "Trust");
  assert.equal(target?.season, 1);
  assert.equal(target?.kitsuStreamId, "kitsu:399:4");
  assert.equal(target?.imdbSeason, 3);
  assert.equal(target?.absoluteNumber, 41);
  assert.equal(target?.tvdbEpisodeId, 123);
  assert.equal(target?.sourceMetaId, "kitsu:399");
});

test("external IDs prefer provider numbering instead of a conflicting entry-local match", () => {
  const target = animePlayEpisode([episode()], { season: 1, episode: 4 }, false, "kitsu:399");
  assert.equal(target?.kitsuStreamId, undefined);
  assert.equal(target?.imdbSeason, 1);
  assert.equal(target?.sourceMetaId, "kitsu:399");
});

test("native entry-relative resume keeps its cour mapping and preserves season zero", () => {
  const target = animePlayEpisode([episode()], { season: 1, episode: 4 }, true, "kitsu:399");
  assert.equal(target?.imdbSeason, 3);
  assert.equal(target?.kitsuStreamId, "kitsu:399:4");
  const special = animePlayEpisode([episode({ seasonNumber: 0, imdbSeason: 0 })], { season: 0, episode: 4 }, true, null);
  assert.equal(special?.season, 0);
});

test("an unloaded native first season does not invent a provider mapping", () => {
  const target = animePlayEpisode([], { season: 1, episode: 17 }, true, "kitsu:399");
  assert.equal(target?.episode, 17);
  assert.equal(target?.imdbSeason, undefined);
  assert.equal(target?.absoluteNumber, undefined);
});

test("fresh play keeps the first loaded episode and permits an empty one-off list", () => {
  assert.equal(animePlayEpisode([episode()], null, true, null)?.kitsuStreamId, "kitsu:399:4");
  assert.equal(animePlayEpisode([], null, true, null), undefined);
});

test("missing later-season resume reaches the existing sibling identity resolver", async () => {
  const identitySource = readFileSync(new URL("../src/lib/streams/anime-identity.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(identitySource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: any = {};
  new Function("require", "exports", compiled)((name: string) => {
    if (name.endsWith("/anizip")) return { aniZipByKitsu: async (id: number) => ({
      mappings: { imdb_id: "tt2560140" }, episodes: { "4": { seasonNumber: id === 310 ? 1 : 3, episodeNumber: 4 } },
    }) };
    if (name.endsWith("/anime-mapping")) return {
      kitsuToAnidb: async () => 3100, findSiblingAnidbEntries: async () => [3990],
      externalToKitsu: async () => 399,
    };
    if (name.endsWith("/kitsu")) return { kitsuSearchAnime: async () => [] };
    if (name.endsWith("anime-identity-core")) return identityCore;
    if (name.endsWith("stream-ids")) return { buildStreamIds };
    if (name.endsWith("/debug")) return { dlog() {} };
    if (name.endsWith("/anime-franchise-root")) return {};
    throw new Error(`Unexpected dependency: ${name}`);
  }, exports);
  const target = animePlayEpisode([], { season: 3, episode: 4 }, true, "kitsu:310");
  const ids = await exports.buildStreamIdsWithIdentity("kitsu:310", target, "tt2560140");
  assert.equal(ids[0], "kitsu:399:4");
  assert.ok(ids.includes("tt2560140:3:4"));
  assert.ok(!ids.includes("tt2560140"));
});
