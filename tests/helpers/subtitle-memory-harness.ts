// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as memory from "../../src/lib/subtitles/subtitle-memory.ts";
import { normalizeLang } from "../../src/lib/subtitles/language.ts";
import { emptySnapshot, type PlayerSnapshot, type TrackInfo } from "../../src/lib/player/bridge.ts";

export function subtitleTrack(id: string): TrackInfo {
  return {
    id,
    kind: "subtitle",
    label: `Subtitle ${id}`,
    title: `Subtitle ${id}`,
    lang: "ar",
    selected: true,
    external: true,
    url: `https://example.test/${id}.srt`,
    subId: `provider:${id}`,
    provider: "Fixture provider",
    release: "Movie.2026.WEB-DL",
    format: "srt",
  };
}

export function restoreHarness(remembered: memory.RememberedSub, tracks: TrackInfo[]) {
  const source = readFileSync(
    new URL("../../src/views/player/hooks/use-track-autoload.ts", import.meta.url),
    "utf8",
  );
  const ast = ts.createSourceFile("autoload.ts", source, ts.ScriptTarget.Latest, true);
  let callback: ts.Node | undefined;
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === "useEffect") {
      const candidate = node.arguments[0];
      if (candidate?.getText(ast).includes("const restoreKey =")) callback = candidate;
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (!callback) throw new Error("Subtitle restore effect not found");
  const compiled = ts.transpileModule(`const effect = ${callback.getText(ast)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const picks: string[] = [];
  const adds: string[] = [];
  const timers: number[] = [];
  const scope = {
    ...memory,
    normalizeLang,
    src: {
      url: "fixture.mkv",
      meta: { id: "fixture" },
      streamRef: { infoHash: "fixture", fileIdx: 0 },
    },
    snap: { ...emptySnapshot, durationSec: 60, subtitleTracks: tracks },
    bridgeRef: {
      current: {
        canAutoSelectSubtitle: () => true,
        setSubtitleTrack: (id: string) => picks.push(id),
        addSubtitle: async (source: string) => {
          adds.push(source);
          return true;
        },
      },
    },
    readRememberedSub: () => remembered,
    settings: {},
    autoSubIdRef: { current: null },
    subRestoreWaitRef: { current: null },
    subRestoreLogRef: { current: null },
    subRestoreSelectRef: { current: null },
    subRestoreAddRef: { current: null },
    subRestoreTimerRef: { current: null },
    bindSubtitleDownloadAuth: async () => undefined,
    markImportedSub() {},
    markAddedSub() {},
    setSubRestoreTick() {},
    window: {
      setTimeout: (_fn: unknown, delay: number) => {
        timers.push(delay);
        return timers.length;
      },
      clearTimeout() {},
    },
    console: { info() {} },
  };
  const run = () =>
    new Function(...Object.keys(scope), `${compiled}\nreturn effect();`)(...Object.values(scope));
  return { run, picks, adds, timers, scope };
}

export function memoryControlsHarness() {
  const source = readFileSync(
    new URL("../../src/views/player/hooks/use-playback-controls.ts", import.meta.url),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const saved = new Map<string, memory.RememberedSub>();
  const cacheRequests: Array<{
    choice: memory.SubChoiceInput;
    playableUrl: string | null;
    cues: unknown;
  }> = [];
  let cache: (
    input: (typeof cacheRequests)[number],
  ) => Promise<memory.SubChoiceInput | null> = async (input) => ({
    ...input.choice,
    source: `cached-${input.choice.id}.srt`,
    imported: true,
  });
  const timers = new Map<number, () => void>();
  let timerId = 0;
  const module = {
    exports: {} as {
      usePlaybackControls: (params: unknown) => {
        rememberSubChoice: (choice: memory.SubChoiceInput | null) => void;
      };
    },
  };
  let refs: Array<{ current: unknown }> = [];
  let refIndex = 0;
  let cleanups: Array<() => void> = [];
  const deps: Record<string, unknown> = {
    react: {
      useCallback: (fn: unknown) => fn,
      useEffect(effect: () => (() => void) | void) {
        const cleanup = effect();
        if (cleanup) cleanups.push(cleanup);
      },
      useRef: (value: unknown) => refs[refIndex++] ?? (refs[refIndex - 1] = { current: value }),
    },
    "@/lib/player/playback-clock": {},
    "@/lib/player-prefs": { writePlayerPrefs() {} },
    "@/lib/subtitles/subtitle-memory": {
      ...memory,
      readRememberedSub: (key: string) => saved.get(key),
      writeRememberedSub: (key: string, sub: memory.RememberedSub) => {
        const record = { ...sub, updatedAt: Date.now() };
        saved.set(key, record);
        return record;
      },
    },
    "@/lib/player/imported-subs": { hasImportedSubTitle: () => false },
    "@/lib/subtitles/selected-subtitle-cache": {
      cacheSelectedSubtitle: (input: (typeof cacheRequests)[number]) => {
        cacheRequests.push(input);
        return cache(input);
      },
    },
  };
  const window = {
    setTimeout(fn: () => void) {
      const id = ++timerId;
      timers.set(id, fn);
      return id;
    },
    clearTimeout(id: number) {
      timers.delete(id);
    },
  };
  new Function("require", "module", "exports", "window", compiled)(
    (id: string) => {
      if (!(id in deps)) throw new Error(`Unexpected dependency: ${id}`);
      return deps[id];
    },
    module,
    module.exports,
    window,
  );
  function mount(engineTrack: TrackInfo, reactTrack = engineTrack) {
    refs = [];
    refIndex = 0;
    cleanups = [];
    let current = engineTrack;
    const listeners = new Set<(snapshot: PlayerSnapshot) => void>();
    const bridge = {
      subscribe(fn: (snapshot: PlayerSnapshot) => void) {
        listeners.add(fn);
        fn({ ...emptySnapshot, subtitleTracks: [current] });
        return () => listeners.delete(fn);
      },
      getSelectedTrackUrl: () => `prepared-${current.id}.srt`,
      getSelectedTrackCues: () => [{ start: 0, end: 1, text: `Subtitle ${current.id}` }],
    };
    const snapRef = { current: { ...emptySnapshot, subtitleTracks: [reactTrack] } };
    const controls = module.exports.usePlaybackControls({
      bridgeRef: { current: bridge },
      snapRef,
      metaId: "fixture",
      mediaKey: "fixture||",
      subtitleStreamKey: "torrent:fixture:0",
    });
    const instanceCleanups = cleanups;
    return {
      ...controls,
      snapRef,
      unmount() {
        for (const cleanup of instanceCleanups) cleanup();
      },
      listenerCount: () => listeners.size,
      select(track: TrackInfo) {
        current = track;
        for (const listener of listeners) listener({ ...emptySnapshot, subtitleTracks: [current] });
      },
    };
  }
  return {
    mount,
    saved,
    cacheRequests,
    timers,
    cacheWith(fn: typeof cache) {
      cache = fn;
    },
  };
}
