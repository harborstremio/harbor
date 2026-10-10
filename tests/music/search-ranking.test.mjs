import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = ts.transpileModule(
  readFileSync(new URL("../../src/lib/music/search-ranking.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } },
).outputText;
const { musicSearchTop } = await import(
  "data:text/javascript;base64," + Buffer.from(source).toString("base64")
);
const song = { id: "song", title: "Rich Minion", artist: "Yeat" };
const artist = { kind: "artist", id: "account", name: "Rich Minion" };
const results = { top: artist, artists: [artist], tracks: [song], albums: [], playlists: [] };
test("exact song beats namesake account", () =>
  assert.equal(musicSearchTop(results, "rich minion").id, "song"));
test("artist queries retain artist result without exact song", () =>
  assert.equal(musicSearchTop({ ...results, tracks: [] }, "Rich Minion").kind, "artist"));
test("provider exact song wins ties", () =>
  assert.equal(
    musicSearchTop({ ...results, top: { ...song, id: "official", kind: "track" } }, "Rich Minion")
      .id,
    "official",
  ));
test("remixes are not treated as original recordings", () =>
  assert.equal(
    musicSearchTop(
      { ...results, tracks: [{ ...song, title: "Rich Minion (Remix)" }] },
      "Rich Minion",
    ).kind,
    "artist",
  ));
test("official audio suffix and punctuation do not hide song match", () =>
  assert.equal(
    musicSearchTop(
      { ...results, tracks: [{ ...song, title: "Rich Minion (Official Audio)" }] },
      "  RICH—MINION  ",
    ).kind,
    "track",
  ));
test("source ordering preserved among exact songs", () =>
  assert.equal(
    musicSearchTop({ ...results, tracks: [song, { ...song, id: "reupload" }] }, "rich minion").id,
    "song",
  ));
test("empty and missing results safe", () => {
  assert.equal(musicSearchTop(null, "song"), undefined);
  assert.equal(musicSearchTop(results, ""), artist);
});
