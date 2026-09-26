// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const monitorsRs = read("src-tauri/src/monitors.rs");
const mpvRs = read("src-tauri/src/mpv.rs");
const usePlayerMedia = read("src/views/player/hooks/use-player-media.ts");
const engineSection = read("src/views/settings/player-panel/engine-section.tsx");
const displayPicker = read("src/views/settings/player-panel/display-picker.tsx");
const defaults = read("src/lib/settings/defaults.ts");
const playerMpv = read("src/lib/player/mpv.ts");

// The friendly monitor name must come from the DisplayConfig API, which is the
// EDID-derived string Windows Settings shows. EnumDisplayDevicesW is only the
// fallback and often returns the generic "Generic PnP Monitor", which is exactly
// the bug this guards against.
test("monitor name resolves via DisplayConfig first, EnumDisplayDevicesW as fallback", () => {
  assert.match(monitorsRs, /DISPLAYCONFIG_DEVICE_INFO_GET_TARGET_NAME/);
  assert.match(monitorsRs, /monitorFriendlyDeviceName/);
  assert.match(monitorsRs, /fn display_config_for/);
  assert.match(monitorsRs, /fn enum_display_device_for/);
  assert.match(monitorsRs, /fn friendly_name_for/);
  // DisplayConfig result is consulted before the enum fallback.
  assert.match(
    monitorsRs,
    /let \(dc_name, dc_path\) = display_config_for\(device_name\);[\s\S]*let name = \[dc_name, enum_name\]/,
  );
});

test("generic monitor names are rejected so unnamed displays stay distinguishable", () => {
  assert.match(monitorsRs, /fn is_generic_monitor_name/);
  assert.match(monitorsRs, /generic pnp monitor/);
  assert.match(monitorsRs, /generic monitor/);
  assert.match(monitorsRs, /generic non-pnp monitor/);
  assert.match(displayPicker, /monitorCardName/);
});

test("monitor resolution captures both the full monitor and the work-area rects", () => {
  assert.match(monitorsRs, /rcMonitor/);
  assert.match(monitorsRs, /rcWork/);
  assert.match(monitorsRs, /pub work_width: u32/);
  assert.match(monitorsRs, /pub work_height: u32/);
  assert.match(monitorsRs, /pub work_x: i32/);
  assert.match(monitorsRs, /pub work_y: i32/);
});

test("separate mpv window is sized directly and honours the cover-taskbar choice", () => {
  // SetWindowPos on the top-level VO window bypasses mpv's work-area clamp.
  assert.match(mpvRs, /fn size_separate_mpv_window/);
  assert.match(mpvRs, /SetWindowPos/);
  assert.match(mpvRs, /SWP_FRAMECHANGED/);
  assert.match(mpvRs, /pub separate_cover_taskbar: Option<bool>/);
  // Default is to cover the taskbar; the setting drops to the work area.
  assert.match(mpvRs, /args\.separate_cover_taskbar\.unwrap_or\(true\)/);
  assert.match(mpvRs, /m\.work_width, m\.work_height/);
  assert.match(mpvRs, /m\.work_x, m\.work_y/);
});

test("HDR display flip is keyed to the session's target monitor, not always main", () => {
  assert.match(mpvRs, /hdr_monitor/);
  assert.match(mpvRs, /monitor_hdr_active\(m\.hmon\)/);
  assert.match(mpvRs, /fn set_monitor_advanced_color\(\s*hmon:/);
});

test("subtitle surface follows the real embed state, including True HDR separate window", () => {
  assert.match(usePlayerMedia, /const videoInHarborWebview/);
  assert.match(usePlayerMedia, /settings\.playerHdrOpaqueWindow/);
  assert.match(usePlayerMedia, /const mpvNativeWindow/);
  // mpvNativeWindow must suppress Harbor's HTML overlay and mark mpv as rendering.
  assert.match(usePlayerMedia, /subAssNative \|\| mpvNativeWindow/);
  assert.match(usePlayerMedia, /subNativeRender[\s\S]*mpvNativeWindow/);
});

test("embed toggle locks with an explanation when True HDR separate window is on", () => {
  assert.match(engineSection, /lockReason/);
  assert.match(engineSection, /settings\.playerHdrOpaqueWindow/);
  assert.match(engineSection, /cannot be embedded/);
});

test("cover-taskbar toggle and separate-window picker appear only for a separate window", () => {
  assert.match(engineSection, /Cover the taskbar/);
  assert.match(engineSection, /playerSeparateCoverTaskbar/);
  assert.match(engineSection, /\(!settings\.playerMpvEmbed \|\| settings\.playerHdrOpaqueWindow\)/);
});

test("display settings default to auto with taskbar covered", () => {
  assert.match(defaults, /bigPictureDisplay: AUTO_DISPLAY/);
  assert.match(defaults, /playerSeparateDisplay: AUTO_DISPLAY/);
  assert.match(defaults, /playerSeparateCoverTaskbar: true/);
});

test("separate display and cover-taskbar flow through to the mpv start args", () => {
  assert.match(playerMpv, /separateCoverTaskbar/);
  assert.match(playerMpv, /separateDisplay/);
});
