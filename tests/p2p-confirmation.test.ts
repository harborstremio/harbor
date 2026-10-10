// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const pickHandlerSource = readFileSync(
  new URL("../src/views/play-picker/use-pick-handler.ts", import.meta.url),
  "utf8",
);

test("confirming the P2P modal always forces the local torrent engine", () => {
  assert.equal(
    pickHandlerSource.match(/setP2pConfirm\(\{\s*stream,\s*forceP2p:\s*true\s*\}\)/g)?.length,
    2,
  );
  assert.doesNotMatch(pickHandlerSource, /setP2pConfirm\(\{\s*stream\s*\}\)/);
});
