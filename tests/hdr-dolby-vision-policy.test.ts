// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { effectiveHdrToSdr } from "../src/lib/player/hdr-output-policy.ts";

test("automatic HDR output never forces an HDR or Dolby Vision source into SDR", () => {
  assert.equal(effectiveHdrToSdr({ playerHdrAuto: true, playerHdrToSdr: true }), false);
  assert.equal(effectiveHdrToSdr({ playerHdrAuto: false, playerHdrToSdr: true }), true);
  assert.equal(effectiveHdrToSdr({ playerHdrAuto: false, playerHdrToSdr: false }), false);
});

test("Windows mpv uses one D3D11 path and display-targeted HDR metadata", () => {
  const source = readFileSync(new URL("../src-tauri/src/mpv.rs", import.meta.url), "utf8");
  assert.match(source, /set\("hwdec", "d3d11va,auto-safe"\)/);
  assert.match(source, /opt\("gpu-api", "d3d11"\)/);
  assert.match(source, /opt\("gpu-context", "d3d11"\)/);
  assert.match(source, /opt\("target-colorspace-hint", "auto"\)/);
  assert.match(source, /opt\("target-colorspace-hint-mode", "target"\)/);
  assert.match(source, /opt\("allow-delayed-peak-detect", "yes"\)/);
  assert.match(source, /opt\("tone-mapping", "bt\.2446a"\)/);
  assert.doesNotMatch(source, /opt\("d3d11-output-format", "rgb10_a2"\)/);
});

test("the settings UI exposes automatic Dolby Vision/HDR output as recommended", () => {
  const source = readFileSync(
    new URL("../src/views/settings/player-panel/hdr-mode.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /id: "auto"/);
  assert.match(source, /label: t\("Automatic HDR \/ Dolby Vision"\)/);
  assert.match(source, /recommended: true/);
});
