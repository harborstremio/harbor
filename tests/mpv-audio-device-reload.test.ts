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
  mpv.indexOf("let lastAudioDeviceListSig"),
  mpv.indexOf("const handleEvent = (raw: MpvEvent) => {"),
);

test("audio-device-list churn only schedules a reload after the endpoint set settles", () => {
  // Device state churn on unrelated endpoints (e.g. SteelSeries Sonar virtual
  // devices) must not force a reload; only a lasting list change may.
  assert.match(mpv, /const sig = audioDeviceListSig\(data\);/);
  assert.match(mpv, /else if \(sig !== observedAudioDeviceListSig\)/);
  assert.match(
    mpv,
    /else if \(sig !== lastAudioDeviceListSig\)\s*\{\s*scheduleAudioDeviceReload\(\);/,
  );
  // A change that reverts before the debounce elapses is dropped.
  assert.match(
    mpv,
    /!mustReload && observedAudioDeviceListSig === lastAudioDeviceListSig\) return;/,
  );
  // An empty enumeration stays comparable instead of counting as unusable.
  assert.match(mpv, /return names\.join\("\\n"\);/);
  // An unusable payload falls back to the legacy always-reload behavior.
  assert.match(mpv, /sig == null\)\s*\{\s*\/\/ No usable list payload[^]*?scheduleAudioDeviceReload\(true\);/);
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

test("forced reloads re-anchor A/V when dynaudnorm is active", () => {
  // dynaudnorm keeps ~15s buffered; a reload re-anchors to that buffer head,
  // leaving mpv silent until video catches up. The same-position exact seek
  // restores audio immediately. Live streams must not be re-seeked.
  assert.match(schedule, /snap\.audioNormalize\s*&&\s*!currentIsLive/);
  assert.match(schedule, /name: "time-pos"/);
  assert.match(schedule, /cmd: \["seek", pos, "absolute\+exact"\]/);
});

test("Rust observes audio-device-list so the event reaches the frontend", () => {
  assert.match(mpvRs, /\("audio-device-list", 21, PropertyKind::Node\)/);
});

test("Rust allows the ao-reload command", () => {
  assert.match(mpvRs, /"ao-reload",/);
});

test("refocus reload waits for a long absence and removes both listeners on disposal", () => {
  assert.match(mpv, /const FOCUS_RELOAD_MIN_ABSENT_MS = 60_000/);
  assert.match(mpv, /const onWindowBlur = \(\) => \{\s*lastWindowBlur = Date.now\(\)/);
  // Wake-from-sleep triggers are unconditional: they must not be dropped by
  // the list-settle guard even when no device-list event carried them.
  assert.match(
    mpv,
    /if \(document\.visibilityState !== "visible"\) return;\s*scheduleAudioDeviceReload\(true\)/,
  );
  assert.match(
    mpv,
    /Date.now\(\) - lastWindowBlur < FOCUS_RELOAD_MIN_ABSENT_MS\) return;\s*scheduleAudioDeviceReload\(true\)/,
  );
  for (const [event, callback] of [
    ["blur", "onWindowBlur"],
    ["focus", "onWindowFocusRestore"],
  ]) {
    assert.ok(mpv.includes(`window.addEventListener("${event}", ${callback})`));
    assert.ok(mpv.includes(`window.removeEventListener("${event}", ${callback})`));
  }
});
