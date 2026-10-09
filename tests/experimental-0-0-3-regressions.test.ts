// @ts-expect-error Node test types are outside the browser tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are outside the browser tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are outside the browser tsconfig.
import test from "node:test";
import ts from "typescript";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const source = read("src/lib/episode-progress.ts");
const seasonFunction = source
  .slice(
    source.indexOf("export function resumeDefaultSeason"),
    source.indexOf("export function getEpisodeProgress"),
  )
  .replace("export function", "function");
// Exercise the real selection function with isolated local-resume state.
const selectSeason = new Function(
  "lastPlayedEpisode",
  ts.transpile(seasonFunction, { target: ts.ScriptTarget.ES2022 }) +
    "\nreturn resumeDefaultSeason;",
)(() => null);
const seasons = [1, 2, 3].map((seasonNumber) => ({ seasonNumber, episodeCount: 10 }));

test("season selection starts new series at the first regular season", () => {
  assert.equal(selectSeason("series", seasons, new Set()), 1);
});

test("season selection uses later watch progress without a local resume entry", () => {
  assert.equal(selectSeason("series", seasons, new Set(["2:1"])), 2);
});

test("nine watched episodes out of ten do not skip the season finale", () => {
  const watched = new Set(Array.from({ length: 9 }, (_, i) => `1:${i + 1}`));
  assert.equal(selectSeason("series", seasons, watched, 1), 1);
  watched.add("1:10");
  assert.equal(selectSeason("series", seasons, watched, 1), 2);
});

test("explicit valid resume season wins over watched-season inference", () => {
  assert.equal(selectSeason("series", seasons, new Set(["2:1"]), 3), 3);
});

test("HLS reconnect options never retry normal streamed EOF", () => {
  for (const path of ["src-tauri/src/mpv.rs", "src-tauri/src/multiview.rs"]) {
    assert.doesNotMatch(read(path), /reconnect_streamed=1/);
    assert.match(read(path), /reconnect=1/);
  }
  assert.match(read("src-tauri/src/mpv.rs"), /"demuxer-cache-dir"/);
});

test("desktop rule integration retains destination setup and available-channel guards", () => {
  const panel = read("src/views/settings/webhooks-panel.tsx");
  const builder = read("src/views/settings/webhooks-panel/rule-builder.tsx");
  assert.match(panel, /onSetUp=\{\(\) => setTab\("destinations"\)\}/);
  assert.match(panel, /canDesktop=\{settings.webhooks.desktopEnabled\}/);
  for (const channel of ["discord", "telegram", "desktop"]) {
    assert.ok(
      builder.includes(
        `draft.channels.${channel} && can${channel[0].toUpperCase()}${channel.slice(1)}`,
      ),
    );
  }
});
