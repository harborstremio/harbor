import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

function load() {
  const code = ts.transpileModule(
    readFileSync(new URL("../src/lib/music/spotify-devices.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const calls: { command: string; args: unknown }[] = [];
  const mocks: Record<string, unknown> = {
    "@tauri-apps/api/core": {
      invoke: async (command: string, args: unknown) => {
        calls.push({ command, args });
        return null;
      },
    },
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(
    (id: string) => mocks[id],
    module,
    module.exports,
  );
  return { api: module.exports as typeof import("../src/lib/music/spotify-devices"), calls };
}

const device = (over: Partial<{ id: string; restricted: boolean }>) => ({
  id: "abc",
  name: "Kitchen",
  kind: "Speaker",
  active: false,
  restricted: false,
  volumePercent: 40,
  ...over,
});

test("a restricted device can never be chosen as a target", () => {
  const { api } = load();
  const kept = api.selectableSpotifyDevices([
    device({ id: "one" }),
    device({ id: "two", restricted: true }),
    device({ id: "   " }),
  ]);
  assert.deepEqual(
    kept.map((entry) => entry.id),
    ["one"],
  );
});

test("clearing the target sends null, so playback returns to Harbor", async () => {
  const { api, calls } = load();
  await api.setSpotifyPlaybackTarget(null);
  assert.deepEqual(calls, [{ command: "music_spotify_set_device", args: { device: null } }]);
});

test("choosing a device names it to the one command that stores it", async () => {
  const { api, calls } = load();
  await api.setSpotifyPlaybackTarget("kitchen-id");
  assert.equal(calls[0].command, "music_spotify_set_device");
  assert.deepEqual(calls[0].args, { device: "kitchen-id" });
});
