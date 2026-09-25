import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { JSDOM } from "jsdom";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { applyLinear, deltaFn } from "../src/lib/subtitles/text-sync.ts";

async function fixture(run: (f: any) => Promise<void>) {
  const dom = new JSDOM("<!doctype html><div id='app'></div>");
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  let result: any;
  let scope = "session-a";
  let selected: any = { id: "a", selected: true, title: "English", external: true };
  let subtitleText = "Synthetic paused subtitle";
  const listeners = new Set<(s: any) => void>();
  const releases: Array<(value: any) => void> = [];
  const delays: number[] = [];
  const selections: string[] = [];
  const added: any[][] = [];
  const writes: string[] = [];
  let writeBarrier: Promise<void> | undefined;
  let preparations = 0;
  const snapshot = () => ({
    subtitleTracks: selected ? [selected] : [],
    subDelaySec: 2,
    subText: subtitleText,
  });
  const bridge = {
    subscribe(fn: (s: any) => void) {
      listeners.add(fn);
      fn(snapshot());
      return () => listeners.delete(fn);
    },
    setSubDelay(value: number) {
      delays.push(value);
    },
    setSubtitleTrack(id: string) {
      selections.push(id);
      // The mpv bridge clears the cached text during every requested track transition.
      subtitleText = "";
      selected = { ...selected, id, selected: true };
      listeners.forEach((fn) => fn(snapshot()));
    },
    async addSubtitle(path: string, ...metadata: any[]) {
      added.push([path, ...metadata]);
      selected = { id: "preview", selected: true, external: true, externalFilename: path };
      listeners.forEach((fn) => fn(snapshot()));
      return true;
    },
  };
  const deps: Record<string, unknown> = {
    react: React,
    "@tauri-apps/api/core": {
      invoke: async (_command: string, args: { path: string }) => {
        writes.push(args.path);
        await writeBarrier;
      },
    },
    "@tauri-apps/api/path": {
      tempDir: async () => "synthetic-temp",
      appDataDir: async () => "synthetic-data",
      join: async (...parts: string[]) => parts.join("/"),
    },
    "@/lib/player/playback-clock": { getPlaybackPosition: () => 4 },
    "@/lib/subtitles/extract": {
      getCuesAnySource: () => new Promise((resolve) => releases.push(resolve)),
    },
    "@/lib/subtitles/serialize": { toSrt: () => "", toVtt: () => "" },
    "@/lib/subtitles/text-sync": { applyLinear, deltaFn },
    "@/lib/player-prefs": { writePlayerPrefs() {} },
  };
  const code = ts.transpileModule(
    readFileSync(new URL("../src/views/player/hooks/use-text-sync.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const output: any = {};
  new Function("require", "exports", code)((id: string) => {
    if (!(id in deps)) throw new Error(id);
    return deps[id];
  }, output);
  function Fixture() {
    result = output.useTextSync(bridge, "title", undefined, {
      scopeKey: scope,
      beforeEnter: () => preparations++,
    });
    return null;
  }
  const root = createRoot(document.querySelector("#app")!);
  const render = () => React.act(async () => root.render(React.createElement(Fixture)));
  try {
    await render();
    await run({
      get api() {
        return result;
      },
      releases,
      delays,
      selections,
      added,
      writes,
      holdWrites() {
        let release!: () => void;
        writeBarrier = new Promise<void>((resolve) => {
          release = resolve;
        });
        return release;
      },
      get subtitleText() {
        return subtitleText;
      },
      get selectedId() {
        return selected?.id;
      },
      enableSyntheticPreview() {
        Object.assign(dom.window, { __TAURI_INTERNALS__: {} });
      },
      get preparations() {
        return preparations;
      },
      changeTrack: async () =>
        React.act(async () => {
          selected = { ...selected, id: "b" };
          listeners.forEach((fn) => fn(snapshot()));
        }),
      changeSource: async () => {
        scope = "session-b";
        await render();
      },
      clearTrack: async () =>
        React.act(async () => {
          selected = null;
          listeners.forEach((fn) => fn(snapshot()));
        }),
    });
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
  }
}

const cues = { ok: true, source: { cues: [{ start: 1, end: 2, text: "Test" }], format: "srt" } };

test("reopening live sync preserves adjustments and prepares only once", async () =>
  fixture(async (f) => {
    let entering: Promise<void>;
    await React.act(async () => {
      entering = f.api.enter("source-a");
    });
    await React.act(async () => {
      f.releases[0](cues);
      await entering!;
    });
    await React.act(async () => f.api.nudgeBy(1));
    await React.act(async () => {
      void f.api.enter("source-a");
    });
    assert.equal(f.api.syncMode, "active");
    assert.equal(f.api.nudge, 3);
    assert.equal(f.releases.length, 1);
    assert.equal(f.preparations, 1);
    assert.equal(f.api.focusRevision, 1);
  }));

test("changing selected track rejects an old extraction result", async () =>
  fixture(async (f) => {
    let entering: Promise<void>;
    await React.act(async () => {
      entering = f.api.enter("source-a");
    });
    await f.changeTrack();
    await React.act(async () => {
      f.releases[0](cues);
      await entering!;
    });
    assert.equal(f.api.syncMode, "idle");
    assert.deepEqual(f.delays, []);
  }));

test("changing playback scope invalidates live sync without applying to the next source", async () =>
  fixture(async (f) => {
    let entering: Promise<void>;
    await React.act(async () => {
      entering = f.api.enter("source-a");
    });
    await f.changeSource();
    await React.act(async () => {
      f.releases[0](cues);
      await entering!;
    });
    assert.equal(f.api.syncMode, "idle");
    assert.deepEqual(f.delays, []);
  }));

test("closing live sync while loading prevents delayed reopening", async () =>
  fixture(async (f) => {
    let entering: Promise<void>;
    await React.act(async () => {
      entering = f.api.enter("source-a");
    });
    await React.act(async () => f.api.exit());
    await React.act(async () => {
      f.releases[0](cues);
      await entering!;
    });
    assert.equal(f.api.syncMode, "idle");
  }));

test("repeated entry while loading does not start duplicate extraction", async () =>
  fixture(async (f) => {
    let entering: Promise<void>;
    await React.act(async () => {
      entering = f.api.enter("source-a");
      void f.api.enter("source-a");
    });
    assert.equal(f.releases.length, 1);
    await React.act(async () => {
      f.releases[0](cues);
      await entering!;
    });
    assert.equal(f.api.syncMode, "active");
  }));

test("old loading result cannot replace a newer source tool session", async () =>
  fixture(async (f) => {
    let first: Promise<void>;
    let second: Promise<void>;
    await React.act(async () => {
      first = f.api.enter("source-a");
    });
    await f.changeSource();
    await React.act(async () => {
      second = f.api.enter("source-b");
    });
    await React.act(async () => {
      f.releases[0](cues);
      await first!;
    });
    assert.equal(f.api.syncMode, "loading");
    await React.act(async () => {
      f.releases[1](cues);
      await second!;
    });
    assert.equal(f.api.syncMode, "active");
  }));

test("cancel restores the original delay without clearing the unchanged paused subtitle", async () =>
  fixture(async (f) => {
    let entering: Promise<void>;
    await React.act(async () => {
      entering = f.api.enter("source-a");
    });
    await React.act(async () => {
      f.releases[0](cues);
      await entering!;
    });
    await React.act(async () => f.api.nudgeBy(1));
    await React.act(async () => f.api.discard());
    assert.equal(f.api.syncMode, "idle");
    assert.equal(f.subtitleText, "Synthetic paused subtitle");
    assert.deepEqual(f.selections, []);
    assert.deepEqual(f.delays, [2, 3, 2]);
  }));

test("no selected subtitle means no preparation or extraction", async () =>
  fixture(async (f) => {
    await f.clearTrack();
    await React.act(async () => f.api.enter("source-a"));
    assert.equal(f.api.syncMode, "idle");
    assert.equal(f.releases.length, 0);
    assert.equal(f.preparations, 0);
  }));

test("cancel still restores the original track after a generated preview selected another track", async () =>
  fixture(async (f) => {
    f.enableSyntheticPreview();
    let entering: Promise<void>;
    await React.act(async () => {
      entering = f.api.enter("source-a");
    });
    await React.act(async () => {
      f.releases[0](cues);
      await entering!;
    });
    await React.act(async () => f.api.syncFromHere(0));
    await React.act(async () => f.api.syncFromHere(0));
    await React.act(async () => new Promise((resolve) => setTimeout(resolve, 280)));
    assert.equal(f.selectedId, "preview");
    assert.equal(f.api.syncMode, "active");
    await React.act(async () => f.api.discard());
    assert.deepEqual(f.selections, ["a"]);
    assert.equal(f.selectedId, "a");
    assert.equal(f.delays.at(-1), 2);
    assert.equal(f.api.syncMode, "idle");
  }));

test("an unreadable subtitle leaves its original offset unchanged on cancel", async () =>
  fixture(async (f) => {
    let entering: Promise<void>;
    await React.act(async () => {
      entering = f.api.enter("source-a");
    });
    await React.act(async () => {
      f.releases[0]({ ok: false, reason: "no-cues" });
      await entering!;
    });
    await React.act(async () => f.api.discard());
    assert.deepEqual(f.delays, [2]);
  }));

test("previews keep official unique files and metadata, and resetting restores the original track", async () =>
  fixture(async (f) => {
    f.enableSyntheticPreview();
    let entering: Promise<void>;
    await React.act(async () => {
      entering = f.api.enter("source-a");
    });
    await React.act(async () => {
      f.releases[0](cues);
      await entering!;
    });
    await React.act(async () => f.api.syncFromHere(0));
    await React.act(async () => f.api.syncFromHere(0));
    await React.act(async () => new Promise((resolve) => setTimeout(resolve, 280)));
    await React.act(async () => f.api.nudgeBy(1));
    await React.act(async () => new Promise((resolve) => setTimeout(resolve, 280)));
    assert.equal(f.added.length, 2);
    assert.notEqual(f.added[0][0], f.added[1][0]);
    assert.match(f.added[0][0], /preview-[0-9a-f-]+\.srt$/);
    assert.deepEqual(f.added[0][4], { provider: "Harbor Live Sync", providerDerived: false });
    await React.act(async () => f.api.reset());
    assert.equal(f.selectedId, "a");
    assert.equal(f.api.syncMode, "active");
    assert.equal(f.delays.at(-1), 0);
  }));

test("a delayed save cannot attach to the next source or reopen the old live session", async () =>
  fixture(async (f) => {
    f.enableSyntheticPreview();
    let entering: Promise<void>;
    await React.act(async () => {
      entering = f.api.enter("source-a");
    });
    await React.act(async () => {
      f.releases[0](cues);
      await entering!;
    });
    const release = f.holdWrites();
    let saving: Promise<unknown>;
    await React.act(async () => {
      saving = f.api.save();
    });
    assert.equal(f.writes.length, 1);
    await f.changeSource();
    let result: unknown;
    await React.act(async () => {
      release();
      result = await saving!;
    });
    assert.deepEqual(result, { ok: false, reason: "cancelled" });
    assert.deepEqual(f.added, []);
    assert.equal(f.api.syncMode, "idle");
  }));
