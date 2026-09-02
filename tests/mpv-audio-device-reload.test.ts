// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const at = (p: string) => new URL(`../${p}`, import.meta.url);
const mpv = readFileSync(at("src/lib/player/mpv.ts"), "utf8");
const mpvRs = readFileSync(at("src-tauri/src/mpv.rs"), "utf8");

// The mpv bridge is a closure bound to Tauri's invoke/listen and the DOM, so we
// assert the wiring statically the way the other mpv tests do. This mirrors the
// runtime path: mpv fires a property-change for audio-device-list on any device
// topology/default switch, which must trigger an ao-reload on Windows while an
// active stream is playing.
const schedule = mpv.slice(
  mpv.indexOf("const scheduleAudioDeviceReload = () => {"),
  mpv.indexOf("const handleEvent = (raw: MpvEvent) => {"),
);

test("audio-device-list property change is wired to schedule the reload", () => {
  assert.match(mpv, /name === "audio-device-list"\) scheduleAudioDeviceReload\(\)/);
});

test("the reload re-init guard is Windows-only while actively playing", () => {
  assert.match(schedule, /if \(!isWindowsDesktop\(\)\) return;/);
  assert.match(schedule, /if \(!mpvStarted\) return;/);
  assert.match(schedule, /snap\.status !== "playing" && snap\.status !== "paused"/);
});

test("the reload re-asserts the device then forces ao-reload on the current default", () => {
  assert.match(schedule, /applyAudioDevice\(appliedAudioDevice \?\? "auto"\)/);
  assert.match(schedule, /cmd: \["ao-reload"\]/);
  // ao-reload must appear after the Windows gate so it only fires on desktop.
  assert.ok(schedule.indexOf("isWindowsDesktop()") < schedule.indexOf("ao-reload"));
});

test("Rust observes audio-device-list so the event reaches the frontend", () => {
  assert.match(mpvRs, /\("audio-device-list", 21, PropertyKind::Node\)/);
});

test("Rust allows the ao-reload command", () => {
  assert.match(mpvRs, /"ao-reload",/);
});
