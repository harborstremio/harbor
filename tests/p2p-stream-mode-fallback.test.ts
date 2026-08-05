// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const at = (p: string) => new URL(`../${p}`, import.meta.url);
const handler = readFileSync(at("src/views/play-picker/use-pick-handler.ts"), "utf8");
const resolve = readFileSync(at("src/lib/streams/resolve.ts"), "utf8");
const picker = readFileSync(at("src/views/play-picker.tsx"), "utf8");

test("a stream with an infoHash can always reach the torrent engine", () => {
  assert.match(
    handler,
    /const allowP2pFallback = streamMode !== "addons" \|\| !!stream\.infoHash;/,
  );
  assert.doesNotMatch(
    handler,
    /const allowP2pFallback = streamMode !== "addons";/,
    "addons mode is a source preference, not a torrent kill switch",
  );
});

test("the P2P consent prompt is not suppressed by the source preference", () => {
  const gate = handler.slice(handler.indexOf("!skipP2pConfirm") - 260, handler.indexOf("!skipP2pConfirm"));
  assert.doesNotMatch(gate, /streamMode !== "addons" &&/);
  assert.match(handler, /engineP2pEligible\(stream\) &&\s*\n\s*\(hasUncachedMarker\(stream\)/);
});

test("addons mode still leaves P2P sources selectable, so they must stay playable", () => {
  assert.match(picker, /if \(addonsOnly\.length > 0\) all = addonsOnly;/);
});

test("only the explicit kill switch disables torrents", () => {
  const gating = readFileSync(at("src/lib/torrent/stremio-stream.ts"), "utf8");
  assert.match(gating, /export function torrentsDisabled\(\)/);
  assert.match(gating, /if \(torrentsDisabled\(\)\) return false;/);
  assert.doesNotMatch(gating, /streamMode/);
});

test("resolve reaches the engine before it falls through to an addon url", () => {
  const forceBlock = resolve.indexOf("if (forceP2p && stream.infoHash");
  const urlBlock = resolve.indexOf('if (stream.url && stream.url !== "#")');
  assert.ok(forceBlock >= 0, "forceP2p branch missing from resolve.ts");
  assert.ok(urlBlock >= 0, "direct url branch missing from resolve.ts");
  assert.ok(forceBlock < urlBlock, "forceP2p must be checked before the direct url");
});
