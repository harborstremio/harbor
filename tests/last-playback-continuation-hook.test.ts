import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { JSDOM } from "jsdom";
import * as React from "react";
import { createRoot } from "react-dom/client";

test("continuation runner owns pending work across actor changes and rejects stale completions", async () => {
  const dom = new JSDOM("<!doctype html><div id='app'></div>");
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  let actorId = "one";
  let result: any;
  const releases: Array<() => void> = [];
  const opened: string[] = [];
  const capture = () => ({ profileId: actorId, storageProfileId: actorId, accountId: actorId });
  const dependencies: Record<string, unknown> = {
    react: React,
    "@/lib/auth": { useAuth: () => ({ user: { _id: actorId } }) },
    "@/lib/profiles": { useProfiles: () => ({ activeProfile: { id: actorId } }) },
    "@/lib/view": { useView: () => ({}) },
    "@/lib/playback-history": {
      capturePlaybackActor: capture,
      isPlaybackActorCurrent: (actor: any) => actor.profileId === actorId,
      readLastActualPlayback: () => ({ id: actorId }),
      subscribePlayback: () => () => {},
    },
    "@/lib/player-actions": { currentPlayerActions: () => null },
    "@/lib/player/continue-playback": {
      continueActualPlayback: async (_target: unknown, options: any, services: any) => {
        await new Promise<void>((resolve) => releases.push(resolve));
        if (!services.isCurrent(options.actor)) throw new Error("stale");
        opened.push(options.actor.profileId);
        return "player-opened";
      },
    },
  };
  const source = readFileSync(
    new URL("../src/hooks/use-last-playback-continuation.ts", import.meta.url),
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
  function Fixture() {
    result = exports.useLastPlaybackContinuation();
    return null;
  }
  const root = createRoot(document.querySelector("#app")!);
  let unmounted = false;
  try {
    await React.act(async () => root.render(React.createElement(Fixture)));
    let first!: Promise<unknown>;
    await React.act(async () => {
      first = result.continuePlayback(result.target).catch((error: Error) => error.message);
    });
    assert.equal(result.pending, true);
    await assert.rejects(result.continuePlayback(result.target), /already opening/);
    actorId = "two";
    await React.act(async () => root.render(React.createElement(Fixture)));
    assert.equal(result.pending, false);
    let second!: Promise<unknown>;
    await React.act(async () => {
      second = result.continuePlayback(result.target);
    });
    await React.act(async () => {
      releases[0]();
      assert.equal(await first, "stale");
    });
    assert.equal(result.pending, true, "old finally cannot clear new actor's operation");
    await React.act(async () => {
      releases[1]();
      assert.equal(await second, "player-opened");
    });
    assert.equal(result.pending, false);
    assert.deepEqual(opened, ["two"]);
    let third!: Promise<unknown>;
    await React.act(async () => {
      third = result.continuePlayback(result.target).catch((error: Error) => error.message);
    });
    await React.act(async () => root.unmount());
    unmounted = true;
    releases[2]();
    assert.equal(await third, "stale");
    assert.deepEqual(opened, ["two"]);
  } finally {
    if (!unmounted) await React.act(async () => root.unmount());
    dom.window.close();
  }
});
