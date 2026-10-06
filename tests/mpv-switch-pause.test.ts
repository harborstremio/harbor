// @ts-nocheck Node-only native bridge harness is outside the browser tsconfig.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { emptySnapshot } from "../src/lib/player/bridge.ts";

test("mpv source replacement retains paused intent through file-loaded and can resume", async () => {
  const events = new Map();
  const calls = [];
  const modules = {
    "@tauri-apps/api/core": {
      invoke: async (name, args) => {
        calls.push({ name, args });
      },
    },
    "@tauri-apps/api/event": {
      listen: async (name, handler) => {
        events.set(name, handler);
        return () => {};
      },
    },
    "./subtitle-load": { subtitleDownloadArgs: (url) => ({ url }) },
    "./mpv-failure": { mpvFailureSnapshot: (snap) => snap },
    "@/lib/platform": {
      isLinuxDesktop: () => false,
      isMacDesktop: () => true,
      isWindowsDesktop: () => false,
    },
    "@/lib/tauri-unlisten": { makeSafeTauriUnlisten: (off) => off },
    "./bridge": { emptySnapshot },
  };
  const source = readFileSync(new URL("../src/lib/player/mpv.ts", import.meta.url), "utf8");
  const exports = {};
  runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      require: (name) => {
        assert.ok(name in modules, name);
        return modules[name];
      },
      window: { dispatchEvent() {} },
      Event,
      console,
    },
  );
  const bridge = exports.createMpvBridge({ anime4k: false, hdrToSdr: true });
  let status;
  bridge.subscribe((snap) => {
    status = snap.status;
  });
  await bridge.load({ url: "https://example.org/a.mp4" });
  bridge.pause();
  await bridge.load({ url: "https://example.org/b.mp4", startAtSec: 42 });
  events.get("mpv://event")({ payload: { event: "file-loaded" } });
  assert.equal(status, "paused");
  assert.ok(
    calls.some(
      (call) =>
        call.name === "mpv_command" &&
        call.args.cmd?.[0] === "loadfile" &&
        call.args.cmd?.[1] === "https://example.org/b.mp4" &&
        call.args.cmd?.[4] === "start=42",
    ),
  );
  await bridge.play();
  events.get("mpv://event")({ payload: { event: "file-loaded" } });
  assert.equal(status, "playing");
});
