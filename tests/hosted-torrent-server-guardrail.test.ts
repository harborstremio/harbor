// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import "./_localstorage-stub.ts";
import { isHostedTorrentServerUrl } from "../src/lib/torrent/stremio-stream.ts";

const HASH = "0123456789abcdef0123456789abcdef01234567";
const resolveSource = readFileSync(
  new URL("../src/lib/streams/resolve.ts", import.meta.url),
  "utf8",
);
const GUARD = "isHostedTorrentServerUrl(stream.url)";
const URL_BRANCH = 'if (stream.url && stream.url !== "#")';

test("a torrent url pointed at a hosted streaming server is recognised", () => {
  assert.equal(isHostedTorrentServerUrl(`https://streaming.strem.io/${HASH}/0`), true);
  assert.equal(isHostedTorrentServerUrl(`https://strem.io/${HASH}/-1?tr=udp%3A%2F%2Ftracker`), true);
  assert.equal(isHostedTorrentServerUrl(`http://192.168.1.50:11470/${HASH}/2`), true);
});

test("Harbor's own engine and ordinary direct links are left alone", () => {
  assert.equal(isHostedTorrentServerUrl(`http://127.0.0.1:11470/${HASH}/0`), false);
  assert.equal(isHostedTorrentServerUrl(`http://localhost:11470/${HASH}/0`), false);
  assert.equal(isHostedTorrentServerUrl("https://dl.real-debrid.example/d/TOKEN/Movie.mkv"), false);
  assert.equal(isHostedTorrentServerUrl(`https://addon.example/${HASH}/0`), false);
  assert.equal(isHostedTorrentServerUrl("not a url"), false);
  assert.equal(isHostedTorrentServerUrl(undefined), false);
});

test("resolve tries the torrent engine before it hands a hosted server url to the player", () => {
  const guard = resolveSource.indexOf(GUARD);
  const urlBranch = resolveSource.indexOf(URL_BRANCH);
  assert.ok(guard >= 0, "hosted torrent server guardrail missing from resolve.ts");
  assert.ok(urlBranch >= 0, "direct url branch missing from resolve.ts");
  assert.ok(guard < urlBranch, "the guardrail must run before the direct url");
  assert.match(
    resolveSource.slice(guard, urlBranch),
    /const direct = await tryTorrentEngine\(stream, signal, hint\);/,
  );
});

test("the guardrail still falls through to the addon url when the engine declines", () => {
  const guard = resolveSource.indexOf(GUARD);
  const urlBranch = resolveSource.indexOf(URL_BRANCH);
  assert.doesNotMatch(
    resolveSource.slice(guard, urlBranch),
    /code: engineFailureCode\(\)/,
    "a hosted server url must stay reachable when the engine cannot serve the torrent",
  );
});
