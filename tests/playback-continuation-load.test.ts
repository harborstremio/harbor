import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { JSDOM } from "jsdom";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { createRoot } from "react-dom/client";
import { playerLoadIdentity } from "../src/lib/player/load-identity";

test("the actual App picker element forwards continuation and remounts for each context request", () => {
  const source = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const file = ts.createSourceFile(
    "App.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let pickerElement: ts.JsxSelfClosingElement | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(file) === "PlayPicker")
      pickerElement = node;
    ts.forEachChild(node, visit);
  };
  visit(file);
  assert.ok(pickerElement);
  const output = ts.transpileModule(
    `export const render = (picker, playerActive, PlayPicker) => (${pickerElement.getText(file)});`,
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const exports: any = {};
  new Function("require", "exports", output)((id: string) => {
    assert.equal(id, "react/jsx-runtime");
    return jsxRuntime;
  }, exports);
  const continuation = {
    id: "actual-a",
    positionMs: 2000,
    sourceKey: "source-a",
    actor: { profileId: "guest" },
  };
  const picker = {
    meta: { id: "title-a" },
    episode: { season: 2, episode: 3 },
    continuation,
    contextRequestId: "request-a",
    autoPlay: true,
  };
  const component = () => null;
  const element = exports.render(picker, false, component);
  assert.equal(element.props.continuation, continuation);
  assert.equal(element.props.episode, picker.episode);
  assert.equal(element.props.autoPlay, true);
  assert.notEqual(
    element.key,
    exports.render(
      { ...picker, continuation: { ...continuation, id: "actual-b" } },
      false,
      component,
    ).key,
  );
  assert.notEqual(
    element.key,
    exports.render({ ...picker, contextRequestId: "request-b" }, false, component).key,
  );
  assert.equal(
    exports.render({ ...picker, intent: "download" }, false, component).props.autoPlay,
    false,
  );
});

test("player load preserves an explicit short position and rejects an actor swap while awaiting resume", async () => {
  const dom = new JSDOM("<!doctype html><div id='app'></div>");
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  let actorCurrent = true;
  let resolveResume = async () => ({ ms: 0, fromRemote: false, finished: false });
  const calls: string[] = [];
  const bridge = {
    load: async () => {
      calls.push("load");
    },
    play: async () => {
      calls.push("play");
    },
    pause: () => {
      calls.push("pause");
    },
  };
  const dependencies: Record<string, unknown> = {
    react: React,
    "@/lib/stremio": { cloudWriteId: () => "fixture" },
    "@/lib/player/resume-start": {
      isResumeStartReady: () => false,
      resolveStartMs: () => resolveResume(),
    },
    "./use-stremio-sync": { videoIdFor: () => "fixture" },
    "@/lib/settings": {
      useSettings: () => ({ settings: { resumePlayback: true, resumePrompt: false } }),
    },
    "@/lib/player/startup-profile": { playbackStartupProfile: () => "local" },
    "@/lib/player/live-src": { isLivePlaybackSrc: () => false },
    "@/lib/player/load-identity": { playerLoadIdentity },
    "@/lib/stream-proxy": { retainStreamProxy: () => {}, releaseStreamProxy: () => {} },
    "@/lib/playback-history": { isPlaybackActorCurrent: () => actorCurrent },
  };
  const source = readFileSync(
    new URL("../src/views/player/hooks/use-bridge-load.ts", import.meta.url),
    "utf8",
  );
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: any = {};
  new Function("require", "exports", code)((id: string) => {
    if (!(id in dependencies)) throw new Error(id);
    return dependencies[id];
  }, exports);
  let result: any;
  function Fixture({ name, positionMs = 2000 }: { name: string; positionMs?: number }) {
    result = exports.useBridgeLoad({
      bridgeRef: { current: bridge },
      inRoomRef: { current: false },
      isHostRef: { current: false },
      bridgeReady: true,
      bridgeKey: "fixture",
      authKey: "fixture",
      src: {
        meta: { id: "local:fixture", name: "Fixture", type: "movie" },
        url: `C:/fixture/${name}.mp4`,
        startPositionMs: positionMs,
        episode: { season: 1, episode: 1, runtime: 2 },
        continuation: { actor: {} },
      },
      transcodedUrl: null,
    });
    return null;
  }
  const root = createRoot(document.querySelector("#app")!);
  try {
    await React.act(async () => root.render(React.createElement(Fixture, { name: "one" })));
    assert.equal(
      result.pendingSeekSec,
      2,
      "explicit positions do not use the ordinary five-second threshold",
    );
    assert.deepEqual(calls, ["load"]);
    resolveResume = async () => ({ ms: 0, fromRemote: true, finished: true });
    await React.act(async () =>
      root.render(React.createElement(Fixture, { name: "near-end", positionMs: 108000 })),
    );
    assert.equal(
      result.pendingSeekSec,
      108,
      "explicit 90% position bypasses ordinary finished restart heuristics",
    );
    assert.deepEqual(calls, ["load", "load"]);
    let release!: () => void;
    resolveResume = () =>
      new Promise((resolve) => {
        release = () => resolve({ ms: 0, fromRemote: false, finished: false });
      });
    await React.act(async () => root.render(React.createElement(Fixture, { name: "two" })));
    actorCurrent = false;
    await React.act(async () => release());
    assert.deepEqual(
      calls,
      ["load", "load"],
      "late resume readiness cannot load another actor's source",
    );
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
  }
});

test("explicit continuation seeks preserve short and near-end positions through the native seek adapter", async () => {
  const dom = new JSDOM("<!doctype html><div id='app'></div>");
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const sought: number[] = [];
  const notified: number[] = [];
  const dependencies: Record<string, unknown> = {
    react: React,
    "@/lib/media-session": { notifyMediaSeeked: (position: number) => notified.push(position) },
  };
  const code = ts.transpileModule(
    readFileSync(
      new URL("../src/views/player/hooks/use-pending-seek-apply.ts", import.meta.url),
      "utf8",
    ),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const output: any = {};
  new Function("require", "exports", code)((id: string) => dependencies[id], output);
  const bridgeRef = {
    current: { seek: (value: number) => sought.push(value), play: async () => {} },
  };
  function Probe({ position, explicit }: { position: number; explicit: boolean }) {
    output.usePendingSeekApply({
      pendingSeekSec: position,
      preserveExactPosition: explicit,
      durationSec: 120,
      clearPendingSeek() {},
      bridgeRef,
      inRoomRef: { current: false },
    });
    return null;
  }
  const root = createRoot(document.querySelector("#app")!);
  try {
    for (const [position, explicit] of [
      [2, true],
      [108, true],
      [2, false],
      [108, false],
      [60, false],
    ] as const) {
      await React.act(async () => root.render(React.createElement(Probe, { position, explicit })));
    }
    assert.deepEqual(sought, [2, 108, 0, 0, 60]);
    assert.deepEqual(notified, sought, "official OS media-session notifications follow every seek");
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
  }
});
