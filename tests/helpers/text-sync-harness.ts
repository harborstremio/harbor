// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as timing from "../../src/lib/subtitles/text-sync.ts";
import * as serialize from "../../src/lib/subtitles/serialize.ts";
import type { useTextSync } from "../../src/views/player/hooks/use-text-sync.ts";
import { emptySnapshot, type PlayerBridge } from "../../src/lib/player/bridge.ts";

export function textSyncHarness(
  source = readFileSync(
    new URL("../../src/views/player/hooks/use-text-sync.ts", import.meta.url),
    "utf8",
  ),
) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  let slots: unknown[] = [];
  let index = 0;
  let dirty = true;
  const effects = new Map<number, { deps: unknown[]; cleanup?: () => void }>();
  let pending: Array<() => void> = [];
  const timers = new Map<number, () => void>();
  let nextTimer = 0;
  let position = 0;
  let delay = 2;
  let selected = "original";
  const adds: Array<{ path: string; lang?: string }> = [];
  const files = new Map<string, string>();
  let readCues = async () => ({
    ok: true as const,
    source: {
      format: "srt" as const,
      cues: [
        { start: 10, end: 12, text: "Arabic one" },
        { start: 110, end: 112, text: "Arabic two" },
      ],
    },
  });
  const bridge = {
    subscribe(fn: (s: unknown) => void) {
      fn({
        ...emptySnapshot,
        subDelaySec: delay,
        subtitleTracks: [
          { id: selected, selected: true, lang: "ar", title: "Arabic", subId: "fixture" },
        ],
      });
      return () => {};
    },
    setSubDelay(value: number) {
      delay = value;
    },
    setSubtitleTrack(value: string) {
      selected = value;
    },
    async addSubtitle(path: string, lang?: string) {
      adds.push({ path, lang });
      selected = path;
      return true;
    },
  } as unknown as PlayerBridge;
  const deps: Record<string, unknown> = {
    react: {
      useRef(value: unknown) {
        const i = index++;
        return slots[i] ?? (slots[i] = { current: value });
      },
      useState(value: unknown) {
        const i = index++;
        if (!(i in slots)) slots[i] = value;
        return [
          slots[i],
          (next: unknown) => {
            slots[i] = typeof next === "function" ? next(slots[i]) : next;
            dirty = true;
          },
        ];
      },
      useCallback(fn: unknown) {
        return fn;
      },
      useEffect(fn: () => (() => void) | void, values: unknown[]) {
        const i = index++;
        const previous = effects.get(i);
        if (previous && values.every((v, n) => Object.is(v, previous.deps[n]))) return;
        pending.push(() => {
          previous?.cleanup?.();
          effects.set(i, { deps: values, cleanup: fn() || undefined });
        });
      },
    },
    "@tauri-apps/api/core": {
      invoke: async (_: string, args: { path: string; contents: string }) => {
        files.set(args.path, args.contents);
      },
    },
    "@tauri-apps/api/path": {
      appDataDir: async () => "saved",
      tempDir: async () => "temp",
      join: async (...parts: string[]) => parts.join("/"),
    },
    "@/lib/player/playback-clock": { getPlaybackPosition: () => position },
    "@/lib/subtitles/extract": { getCuesAnySource: () => readCues() },
    "@/lib/subtitles/serialize": serialize,
    "@/lib/subtitles/text-sync": timing,
    "@/lib/player-prefs": { writePlayerPrefs() {} },
  };
  const module = { exports: {} as { useTextSync: typeof useTextSync } };
  new Function("require", "module", "exports", "window", compiled)(
    (id: string) => {
      if (!(id in deps)) throw new Error(`Unexpected dependency: ${id}`);
      return deps[id];
    },
    module,
    module.exports,
    {
      __TAURI_INTERNALS__: {},
      setTimeout(fn: () => void) {
        timers.set(++nextTimer, fn);
        return nextTimer;
      },
      clearTimeout(id: number) {
        timers.delete(id);
      },
    },
  );
  let api: ReturnType<typeof useTextSync>;
  function render() {
    while (dirty) {
      dirty = false;
      index = 0;
      pending = [];
      api = module.exports.useTextSync(bridge, "fixture");
      for (const fn of pending) fn();
    }
    return api;
  }
  render();
  return {
    render,
    files,
    adds,
    selected: () => selected,
    delay: () => delay,
    at(value: number) {
      position = value;
    },
    readWith(fn: typeof readCues) {
      readCues = fn;
    },
    timers() {
      const jobs = [...timers.values()];
      timers.clear();
      for (const fn of jobs) fn();
    },
    unmount() {
      for (const e of effects.values()) e.cleanup?.();
      slots = [];
    },
  };
}
