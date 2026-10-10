// @ts-expect-error Node test types are outside the browser tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are outside the browser tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are outside the browser tsconfig.
import test from "node:test";
import ts from "typescript";
import { navigateUnderPreview, previewPageStack } from "../src/lib/player/docked-navigation.ts";

const source = ts.createSourceFile("view.tsx",
  readFileSync(new URL("../src/lib/view.tsx", import.meta.url), "utf8"),
  ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX);

function declaration(name: string): string {
  let text = "";
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) text = node.getText(source);
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) text = `const ${node.getText(source)};`;
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(text, `Missing view declaration: ${name}`);
  return text;
}

function fixture(initial: any[]) {
  const stackRef = { current: initial };
  const forwardStackRef = { current: [] as any[] };
  const events: unknown[] = [];
  const names = ["STACK_MAX", "pushFrame", "pop", "clearForwardStack", "setNavStack", "openMeta", "openEpisodeDetail"];
  const code = ts.transpileModule(names.map(declaration).join("\n"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const scope = {
    stackRef, forwardStackRef, navigateUnderPreview, previewPageStack,
    useCallback: (fn: any) => fn,
    consumeBack: () => false,
    setStack: (value: any) => { stackRef.current = typeof value === "function" ? value(stackRef.current) : value; },
    setForwardStack: (value: any[]) => { forwardStackRef.current = value; },
    trackEvent: (...args: unknown[]) => events.push(args),
    profileFromMeta: () => ({}),
  };
  const nav = new Function(...Object.keys(scope), `${code}\nreturn {openMeta, openEpisodeDetail, pop};`)(...Object.values(scope));
  return { ...nav, stackRef, events };
}

const series = { id: "tt1", type: "series", name: "Fixture series" };
const parent = { kind: "meta", meta: series, episodeHint: { season: 3, episode: 7 }, seasonEntryId: "saved-season" };
const home = { kind: "home" };
const ep = { kind: "episode-detail", seriesId: series.id, season: 3, episode: 7, seriesMeta: series };

test("episode series link restores the original parent then Back leaves the title", () => {
  const h = fixture([home, parent]);
  h.openEpisodeDetail(series.id, 3, 7, series);
  h.openMeta(series);
  assert.deepEqual(h.stackRef.current, [home, parent]);
  assert.equal(h.stackRef.current[1], parent);
  assert.equal(h.events.length, 0);
  h.pop();
  assert.deepEqual(h.stackRef.current, [home]);
});

test("repeated episode visits never grow a series/episode Back loop", () => {
  const h = fixture([home, parent]);
  for (let i = 1; i <= 5; i++) {
    h.openEpisodeDetail(series.id, 3, i, series);
    h.openMeta(series);
    assert.deepEqual(h.stackRef.current, [home, parent]);
  }
});

test("a directly opened episode is replaced by its parent title", () => {
  const h = fixture([home, ep]);
  h.openMeta(series);
  assert.deepEqual(h.stackRef.current.map((f: any) => f.kind), ["home", "meta"]);
  assert.equal(h.events.length, 1);
  h.pop();
  assert.deepEqual(h.stackRef.current, [home]);
});

test("returning from consecutive episode details finds the nearest matching parent", () => {
  const olderParent = { ...parent, seasonEntryId: "older" };
  const h = fixture([home, olderParent, { kind: "person", id: 1 }, parent, ep, { ...ep, episode: 8 }]);
  h.openMeta(series);
  assert.deepEqual(h.stackRef.current, [home, olderParent, { kind: "person", id: 1 }, parent]);
});

test("opening a different title retains ordinary forward navigation", () => {
  const h = fixture([home, parent, ep]);
  h.openMeta({ id: "tt2", type: "movie" });
  assert.equal(h.stackRef.current.length, 4);
  h.pop();
  assert.equal(h.stackRef.current.at(-1), ep);
});

test("returning to a series leaves a docked preview mounted", () => {
  const dock = { kind: "player", src: { sportsDocked: true, url: "fixture-stream" } };
  const h = fixture([home, parent, ep, dock]);
  h.openMeta(series);
  assert.deepEqual(h.stackRef.current, [home, parent, dock]);
  assert.equal(h.stackRef.current.at(-1), dock);
  h.pop();
  assert.deepEqual(h.stackRef.current, [home, dock]);
});

test("canonical anime detail preserves cour playback and returns to the exact Kitsu parent frame", () => {
  const kitsu = { ...series, id: "kitsu:parent" };
  const kitsuParent = { ...parent, meta: kitsu, seasonEntryId: "kitsu:part2" };
  const playback = {
    meta: { ...series, id: "kitsu:part2" },
    episode: { season: 1, episode: 1, kitsuStreamId: "kitsu:part2:1", imdbSeason: 3, imdbEpisode: 13 },
  };
  const h = fixture([home, kitsuParent]);
  h.openEpisodeDetail("tt2560140", 3, 13, kitsu, playback);
  assert.equal(h.stackRef.current.at(-1).playback, playback);
  h.openMeta(kitsu);
  assert.deepEqual(h.stackRef.current, [home, kitsuParent]);
  assert.equal(h.stackRef.current[1], kitsuParent);
  h.pop();
  assert.deepEqual(h.stackRef.current, [home]);
});

test("the same canonical episode opened from another source retains that source", () => {
  const h = fixture([home]);
  const a = { meta: { ...series, id: "kitsu:a" }, episode: { season: 1, episode: 1 } };
  const b = { meta: { ...series, id: "kitsu:b" }, episode: { season: 1, episode: 13 } };
  h.openEpisodeDetail("tt1", 3, 13, series, a);
  h.openEpisodeDetail("tt1", 3, 13, series, b);
  assert.equal(h.stackRef.current.at(-1).playback, b);
});
