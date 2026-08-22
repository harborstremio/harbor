// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  createMediaControlsSession,
  createMediaKeyGate,
  dispatchMediaControlAction,
} from "../src/lib/media-session.ts";

test("deduplicates identical media metadata and resets after clear", () => {
  const calls: Array<{ command: string; args?: Record<string, unknown> }> = [];
  const session = createMediaControlsSession(
    () => true,
    async (command, args) => {
      calls.push({ command, args });
    },
  );

  assert.equal(session.update(true, "Show", "S1 E2"), true);
  assert.equal(session.update(true, "Show", "S1 E2"), false);
  assert.equal(session.update(false, "Show", "S1 E2"), true);
  assert.equal(session.clear(), true);
  assert.equal(session.update(false, "Show", "S1 E2"), true);
  assert.deepEqual(
    calls.map(({ command }) => command),
    [
      "media_controls_update",
      "media_controls_update",
      "media_controls_clear",
      "media_controls_update",
    ],
  );
});

test("does not invoke native media controls outside Tauri", () => {
  let invoked = false;
  const session = createMediaControlsSession(
    () => false,
    async () => {
      invoked = true;
    },
  );

  assert.equal(session.update(true, "Movie", ""), false);
  assert.equal(session.clear(), false);
  assert.equal(invoked, false);
});

test("media key gate rejects duplicate browser and SMTC events for 350ms", () => {
  const gate = createMediaKeyGate(350);
  assert.equal(gate(1_000), true);
  assert.equal(gate(1_349), false);
  assert.equal(gate(1_350), true);
});

test("dispatches only applicable media actions through the shared gate", () => {
  const actions: string[] = [];
  let allow = true;
  const state = {
    playing: false,
    playPause: () => actions.push("toggle"),
    next: () => actions.push("next"),
    previous: () => actions.push("previous"),
    hasNext: true,
    hasPrevious: false,
  };

  assert.equal(
    dispatchMediaControlAction("play", state, () => allow),
    true,
  );
  assert.equal(
    dispatchMediaControlAction("pause", state, () => allow),
    false,
  );
  assert.equal(
    dispatchMediaControlAction("next", state, () => allow),
    true,
  );
  assert.equal(
    dispatchMediaControlAction("previous", state, () => allow),
    false,
  );
  allow = false;
  assert.equal(
    dispatchMediaControlAction("playpause", state, () => allow),
    false,
  );
  assert.deepEqual(actions, ["toggle", "next"]);
});

test("registers native media control commands without changing non-Windows behavior", () => {
  const tauriLib = readFileSync(new URL("../src-tauri/src/lib.rs", import.meta.url), "utf8");
  const native = readFileSync(
    new URL("../src-tauri/src/media_controls.rs", import.meta.url),
    "utf8",
  );
  const cargo = readFileSync(new URL("../src-tauri/Cargo.toml", import.meta.url), "utf8");
  const player = readFileSync(new URL("../src/views/player.tsx", import.meta.url), "utf8");
  const keyboard = readFileSync(
    new URL("../src/views/player/hooks/use-keyboard-shortcuts.ts", import.meta.url),
    "utf8",
  );

  assert.match(tauriLib, /mod media_controls;/);
  assert.match(tauriLib, /media_controls::ensure_started_on_setup/);
  assert.match(tauriLib, /media_controls::media_controls_update/);
  assert.match(tauriLib, /media_controls::media_controls_clear/);
  assert.match(native, /#\[cfg\(windows\)\]/);
  assert.match(native, /#\[cfg\(not\(windows\)\)\]/);
  assert.match(cargo, /"Win32_System_WinRT"/);
  assert.match(cargo, /"Media"/);
  assert.match(cargo, /"Foundation"/);
  assert.match(cargo, /"Storage_Streams"/);
  assert.match(player, /updateMediaControls\(playing, src\.meta\.name, subtitle\)/);
  assert.match(player, /clearMediaControls\(\)/);
  assert.match(keyboard, /listen<unknown>\("harbor:\/\/media-key"/);
  assert.match(keyboard, /dispatchMediaControlAction\(event\.payload, mediaRef\.current/);
});
