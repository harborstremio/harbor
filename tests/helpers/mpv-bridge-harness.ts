// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as snapshots from "../../src/lib/player/bridge.ts";
import * as selection from "../../src/lib/player/subtitle-selection.ts";
import * as cleanups from "../../src/lib/player/prepared-subtitle-cleanups.ts";
import * as seeds from "../../src/lib/subtitles/seed-batch.ts";
import * as failures from "../../src/lib/player/mpv-failure.ts";
import type { PlayerBridge, PlayerSnapshot } from "../../src/lib/player/bridge.ts";

export function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

export async function flushBridge() {
  for (let i = 0; i < 40; i += 1) await Promise.resolve();
}

export function playerSnapshotChanged() {
  const source = readFileSync(
    new URL("../../src/views/player/hooks/use-player-bridge.ts", import.meta.url),
    "utf8",
  );
  const ast = ts.createSourceFile("hook.ts", source, ts.ScriptTarget.Latest, true);
  const comparator = ast.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === "snapChangedIgnoringClock",
  );
  if (!comparator) throw new Error("Player snapshot comparator not found");
  const compiled = ts.transpileModule(comparator.getText(ast), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return new Function(`${compiled}; return snapChangedIgnoringClock;`)() as (
    a: PlayerSnapshot,
    b: PlayerSnapshot,
  ) => boolean;
}

export function mpvBridgeHarness(prefs = { volume: 0.35, muted: false }) {
  const source = readFileSync(new URL("../../src/lib/player/mpv.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const handlers = new Map<string, (event: { payload: unknown }) => void>();
  const commands: Array<{ command: string; args: Record<string, unknown> }> = [];
  const errors: string[] = [];
  const properties = new Map<string, unknown>([
    ["sid", "no"],
    ["secondary-sid", "no"],
  ]);
  let reset: () => Promise<void> = async () => {};
  let write: (name: string, value: unknown) => Promise<void> = async () => {};
  let nativeInvoke: ((command: string, args: Record<string, unknown>) => Promise<unknown>) | null =
    null;
  let prepare: (input: { url: string }) => Promise<unknown> = async ({ url }) => ({
    playableUrl: url,
    format: "srt",
    cues: [{ start: 0, end: 1, text: "fixture" }],
    cleanup() {},
  });
  const dependencies: Record<string, unknown> = {
    "@tauri-apps/api/core": {
      invoke: async (command: string, args: Record<string, unknown> = {}) => {
        commands.push({ command, args });
        if (nativeInvoke) return nativeInvoke(command, args);
        if (command === "mpv_set_property") {
          await write(String(args.name), args.value);
          properties.set(String(args.name), args.value);
        }
        if (command === "mpv_get_property") return properties.get(String(args.name)) ?? "";
      },
    },
    "@tauri-apps/api/event": {
      listen: async (name: string, handler: (event: { payload: unknown }) => void) => {
        handlers.set(name, handler);
        return () => handlers.delete(name);
      },
    },
    "@/lib/subtitles/prepare": { prepareSubtitle: (input: { url: string }) => prepare(input) },
    "@/lib/subtitles/provider-auth": { subtitleTrackDownloadHeaders: () => undefined },
    "@/lib/subtitles/prepared-registry": { takePreparedSubtitle: () => null },
    "@/lib/subtitles/limit-signal": { markLimitReached() {} },
    "./mpv-failure": failures,
    "@/lib/platform": {
      isWindowsDesktop: () => true,
      isLinuxDesktop: () => false,
      isMacDesktop: () => false,
    },
    "@/lib/tauri-unlisten": { makeSafeTauriUnlisten: (fn: unknown) => fn },
    "./mpv-properties": {
      resetMpvSubtitleFpsForTransition: () => reset(),
      invalidateMpvSubtitleFpsContext() {},
      markMpvSubtitleFpsSessionRecreated() {},
    },
    "./subtitle-fps": { SUBTITLE_FPS_TRANSITION_FAILED_EVENT: "selection-failed" },
    "@/lib/perf/playback-trace": { finishPlaybackTrace() {}, markPlaybackTrace() {} },
    "./prepared-subtitle-cleanups": cleanups,
    "./subtitle-selection": selection,
    "@/lib/subtitles/seed-batch": seeds,
    "@/lib/subtitles/provider-url": { isSafeProviderSubtitleUrl: () => true },
    "./bridge": {
      ...snapshots,
      initialPlayerSnapshot: () => ({ ...snapshots.emptySnapshot, ...prefs }),
    },
  };
  const module = { exports: {} as { createMpvBridge: () => PlayerBridge } };
  new Function("require", "module", "exports", "window", "console", compiled)(
    (id: string) => {
      if (!(id in dependencies)) throw new Error(`Unexpected dependency: ${id}`);
      return dependencies[id];
    },
    module,
    module.exports,
    { dispatchEvent: (event: Event) => errors.push(event.type) },
    { warn() {}, info() {} },
  );
  const bridge = module.exports.createMpvBridge();
  let snapshot: PlayerSnapshot = snapshots.emptySnapshot;
  bridge.subscribe((next) => {
    snapshot = next;
  });
  return {
    bridge,
    commands,
    errors,
    snapshot: () => snapshot,
    emit(name: string, data: unknown) {
      properties.set(name, data);
      handlers.get("mpv://event")?.({ payload: { event: "property-change", name, data } });
    },
    resetWith(fn: typeof reset) {
      reset = fn;
    },
    writeWith(fn: typeof write) {
      write = fn;
    },
    prepareWith(fn: typeof prepare) {
      prepare = fn;
    },
    invokeWith(fn: NonNullable<typeof nativeInvoke>) {
      nativeInvoke = fn;
    },
    picks: () =>
      commands
        .filter(({ command, args }) => command === "mpv_set_property" && args.name === "sid")
        .map(({ args }) => args.value),
  };
}
