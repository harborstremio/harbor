// @ts-nocheck -- Node's built-in test modules are not part of the app TypeScript config.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/views/player/hooks/use-player-bridge.ts", import.meta.url),
  "utf8",
);

test("destroys a player bridge that resolves after its view is cancelled", () => {
  assert.match(source, /if \(cancelled\) \{\s*choose\.destroy\(\);\s*return;\s*\}/);
});
