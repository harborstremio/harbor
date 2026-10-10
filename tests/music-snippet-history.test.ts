import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { musicTrackIdentity } from "../src/lib/music/track-identity.ts";
import { unheardSnippetCandidates } from "../src/lib/music/snippet-candidates.ts";
import type { MusicTrack } from "../src/lib/music/types.ts";

const track = (id: string, title = id, artist = "Artist"): MusicTrack => ({ id, title, artist, artwork: "", durationSeconds: 180, durationLabel: "3:00", connectorId: "catalog" });
function moduleOf(file: string, dependencies: Record<string, unknown>) {
  const source = readFileSync(new URL(`../src/lib/music/${file}.ts`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} as any };
  new Function("require", "module", "exports", "window", code)((key: string) => {
    assert.ok(key in dependencies, `Unexpected dependency: ${key}`); return dependencies[key];
  }, module, module.exports, { __TAURI_INTERNALS__: {} });
  return module.exports;
}
function harness(files = new Map<string, string>()) {
  let profile = "first", writes = 0;
  const affinity = { [musicTrackIdentity(track("full-play"))]: { plays: 1, at: 1 } };
  const local = moduleOf("local-store", {
    "@tauri-apps/plugin-fs": {
      BaseDirectory: { AppData: 1 }, exists: async (path: string) => files.has(path), mkdir: async () => {},
      readTextFile: async (path: string) => files.get(path),
      writeTextFile: async (path: string, value: string) => { writes++; files.set(path, value); },
    },
  }) as typeof import("../src/lib/music/local-store.ts");
  const history = moduleOf("snippet-history", {
    "../active-profile-id": { activeProfileId: () => profile },
    "./listening-affinity": { hydrateListeningAffinity: async () => {}, readListeningAffinity: () => affinity },
    "./local-store": local, "./track-identity": { musicTrackIdentity },
  }) as typeof import("../src/lib/music/snippet-history.ts");
  return { history, local, files, affinity, get writes() { return writes; }, setProfile: (value: string) => { profile = value; } };
}

test("a seen/quickly skipped snippet is excluded immediately and after app restart", async () => {
  const h = harness(); await h.history.hydrateSnippetHistory();
  const shown = track("shown"), unseen = track("unseen");
  h.history.recordSnippetsSeen([shown]);
  assert.deepEqual(unheardSnippetCandidates([shown, unseen], null, [], h.history.snippetHeardKeys()), [unseen]);
  await h.local.flushLocalJson();
  const reopened = harness(h.files); await reopened.history.hydrateSnippetHistory();
  assert.deepEqual(unheardSnippetCandidates([shown, unseen], null, [], reopened.history.snippetHeardKeys()), [unseen]);
  assert.equal(h.affinity[musicTrackIdentity(shown)], undefined, "dismissal is not a listened-song affinity signal");
});

test("batch scroll retirement leaves unseen buffered cards available and deduplicates writes", async () => {
  const h = harness(), tracks = Array.from({ length: 8 }, (_, i) => track(`song-${i}`));
  h.history.recordSnippetsSeen(tracks.slice(0, 4));
  await h.local.flushLocalJson();
  assert.equal(h.writes, 1);
  h.history.recordSnippetsSeen(tracks.slice(0, 4));
  await h.local.flushLocalJson();
  assert.equal(h.writes, 1, "replaying/backtracking does not rewrite history");
  assert.deepEqual(unheardSnippetCandidates(tracks, null, [], h.history.snippetHeardKeys()), tracks.slice(4));
});

test("seen recordings stay excluded across provider identities while profiles stay separate", async () => {
  const h = harness(), original = track("catalog:1", "The Song");
  h.history.recordSnippetsSeen([original]);
  const other = { ...track("youtube:2", "Uploader - Audio", "Uploader"), collectionOrigin: { id: original.id, title: original.title, artist: original.artist } };
  assert.deepEqual(unheardSnippetCandidates([other], null, [], h.history.snippetHeardKeys()), []);
  h.setProfile("second"); await h.history.hydrateSnippetHistory();
  assert.deepEqual(unheardSnippetCandidates([original], null, [], h.history.snippetHeardKeys()), [original]);
  h.setProfile("first");
  assert.ok(h.history.snippetHeardKeys().has(musicTrackIdentity(original)));
  await h.local.flushLocalJson();
});

test("existing listened-preview history is retained with newly dismissed cards", async () => {
  const old = track("old"), skipped = track("skipped");
  const files = new Map([["music-store/snippets-first.json", JSON.stringify({ [musicTrackIdentity(old)]: 1 })]]);
  const h = harness(files); await h.history.hydrateSnippetHistory();
  h.history.recordSnippetsSeen([skipped]);
  assert.deepEqual(unheardSnippetCandidates([old, skipped, track("full-play")], null, [], h.history.snippetHeardKeys()), []);
  await h.local.flushLocalJson();
  assert.equal(Object.keys(JSON.parse(files.get("music-store/snippets-first.json")!)).length, 2);
});
