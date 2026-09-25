import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { JSDOM } from "jsdom";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { actualPlaybackSnapshot } from "../src/lib/player/actual-playback";
import { initialPlayerSnapshot } from "../src/lib/player/bridge";

test("actual recorder follows decoded clock activity, ignores buffer updates and stale source frames", async () => {
  const dom = new JSDOM("<!doctype html><div id='app'></div>");
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  let position = 0;
  const clock = new Set<() => void>();
  const writes: any[] = [];
  const dependencies: Record<string, unknown> = {
    react: React,
    "@/lib/playback-history": {
      capturePlaybackActor: () => ({ profileId: "one", storageProfileId: "one", accountId: null }),
      playbackSourceKey: (src: any) => src.url,
      recordActualPlayback: (entry: any) => {
        writes.push(entry);
        return true;
      },
    },
    "@/lib/player/actual-playback": { actualPlaybackSnapshot },
    "@/lib/player/playback-clock": {
      getPlaybackPosition: () => position,
      subscribePlaybackClock: (fn: () => void) => {
        clock.add(fn);
        return () => clock.delete(fn);
      },
    },
  };
  const text = readFileSync(
    new URL("../src/views/player/hooks/use-actual-playback.ts", import.meta.url),
    "utf8",
  );
  const code = ts.transpileModule(text, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: any = {};
  new Function("require", "exports", code)((id: string) => {
    if (!(id in dependencies)) throw new Error(id);
    return dependencies[id];
  }, exports);
  function Fixture(props: any) {
    exports.useActualPlayback(props.src, props.snap);
    return null;
  }
  const root = createRoot(document.querySelector("#app")!);
  const source = (name: string) => ({
    meta: { id: "local:same-id", name, type: "movie" },
    title: name,
    url: `C:/fixture/${name}.mp4`,
  });
  const ready = {
    ...initialPlayerSnapshot(),
    status: "playing",
    firstFrameReady: true,
    durationSec: 40,
  };
  const render = async (src: any, snap: any) => {
    await React.act(async () => root.render(React.createElement(Fixture, { src, snap })));
  };
  const tick = async (value: number) => {
    await React.act(async () => {
      position = value;
      clock.forEach((fn) => fn());
    });
  };
  try {
    await render(source("a"), initialPlayerSnapshot());
    await tick(0);
    assert.equal(writes.length, 0);
    await render(source("a"), ready);
    await tick(2);
    assert.equal(writes.at(-1)?.src.title, "a");
    const count = writes.length;
    await tick(2);
    assert.equal(writes.length, count);
    await render(source("b"), ready); // previous source's last rendered snapshot
    await tick(3);
    assert.equal(writes.filter((entry) => entry.src.title === "b").length, 0);
    await render(source("b"), initialPlayerSnapshot());
    await tick(0);
    await render(source("b"), ready);
    await tick(1);
    assert.equal(writes.at(-1)?.src.title, "b");
    assert.equal(writes.at(-1)?.positionMs, 1000);
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
  }
});
