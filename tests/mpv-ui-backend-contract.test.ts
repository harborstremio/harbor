// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("bridge updates the React UI for buffering and the HTML5 no-audio fallback", () => {
  const hook = read("src/views/player/hooks/use-player-bridge.ts");

  assert.match(hook, /a\.buffering !== b\.buffering/);
  assert.match(hook, /a\.noAudio !== b\.noAudio/);
  assert.match(hook, /a\.secondarySubText !== b\.secondarySubText/);
});

test("mpv clears source-specific media state and does not revive a paused player", () => {
  const source = read("src/lib/player/mpv.ts");

  assert.match(source, /snap\.chapters = \[\];[\s\S]*snap\.videoWidth = 0;[\s\S]*snap\.videoHeight = 0;/);
  assert.match(source, /name === "video-params\/gamma"\) snap\.hdrGamma = typeof data === "string" \? data : ""/);
  assert.match(source, /snap\.status = observedPaused === true \? "paused" : "playing";/);
});

test("live and on-demand sources never share one mpv buffering profile", () => {
  const source = read("src/lib/player/mpv.ts");

  assert.match(source, /let currentIsLive: boolean \| null = null;/);
  assert.match(source, /if \(mpvStarted && currentIsLive !== nextIsLive\) \{[\s\S]*await invoke\("mpv_stop"\)[\s\S]*mpvStarted = false;/);
  assert.match(source, /currentIsLive = nextIsLive;/);
});

test("a rejected initial mpv load shuts down its untracked native instance", () => {
  const backend = read("src-tauri/src/mpv.rs");

  assert.match(backend, /mpv_argv_command\(&\*mpv_arc, &\["loadfile", &args\.url, "replace"\]\)\.map_err\(\|e\| \{/);
  assert.match(backend, /let _ = mpv_arc\.command\("quit", &\[\]\);/);
});
