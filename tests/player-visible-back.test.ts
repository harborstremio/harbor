import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import ts from "typescript";
import * as departure from "../src/lib/player/leave-confirm.ts";

function load(file: string, dependencies: Record<string, unknown>) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  const empty = () => null;
  new Function("require", "module", "exports", output)(
    (name: string) => dependencies[name] ?? new Proxy({}, { get: () => empty }),
    module,
    module.exports,
  );
  return module.exports as any;
}

/** Read the real PlayerView binding, so testing only the guard cannot miss a bypassing wire. */
function visibleCloseBinding(
  closePlayer: () => void,
  requestClosePlayer: () => Promise<void>,
  name = "closePlayer",
  backFromPlayer = closePlayer,
) {
  const source = readFileSync(new URL("../src/views/player.tsx", import.meta.url), "utf8");
  const file = ts.createSourceFile(
    "player.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let initializer: ts.ObjectLiteralExpression | undefined;
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(file) === "overlayProps" &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    )
      initializer = node.initializer;
    ts.forEachChild(node, visit);
  };
  visit(file);
  assert.ok(initializer, "expected the PlayerView overlay prop composition");
  const property = initializer.properties.find((value) => value.name?.getText(file) === name);
  assert.ok(
    property && (ts.isShorthandPropertyAssignment(property) || ts.isPropertyAssignment(property)),
  );
  const value = ts.isShorthandPropertyAssignment(property) ? property.name : property.initializer;
  return new Function(
    "closePlayer",
    "requestClosePlayer",
    "backFromPlayer",
    `return (${value.getText(file)});`,
  )(closePlayer, requestClosePlayer, backFromPlayer);
}

test("visible shell Back and room Leave keep Harbor's direct cleanup binding without a new warning", async () => {
  const dom = new JSDOM("<body><div id='app'></div>", { url: "http://localhost/" });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const root = createRoot(document.getElementById("app")!);
  let exits = 0;
  let route = "player";
  const originalPosition = 158.6;
  const rawClose = () => {
    exits++;
    route = "home";
  };
  const dependencies: Record<string, unknown> = {
    react: React,
    "react/jsx-runtime": jsx,
    "@/lib/player/leave-confirm": departure,
    "@/lib/fullscreen-state": {
      isAnyFullscreen: async () => false,
      exitAnyFullscreen: async () => {},
    },
    "@/lib/player-shells/registry": {
      getPlayerShell: () => ({
        Component: ({ onBack }: { onBack: () => void }) =>
          jsx.jsx("button", { onClick: onBack, children: "Back" }),
      }),
    },
    "./room-layer": {
      RoomLayer: ({ onLeave }: { onLeave: () => void }) =>
        jsx.jsx("button", { onClick: onLeave, children: "Leave room" }),
    },
  };
  const { requestPlayerClose } = load("src/views/player/request-player-close.ts", dependencies);
  const requestClose = () =>
    requestPlayerClose({
      drawMode: false,
      setDrawMode: () => {},
      closePlayer: rawClose,
      playerEscExitsFullscreen: false,
      playerConfirmLeave: true,
    });
  dependencies["./shell-layer"] = load("src/views/player/shell-layer.tsx", dependencies);
  const { PlayerOverlayLayers } = load("src/views/player/player-overlay-layers.tsx", dependencies);
  const snap = {
    status: "paused",
    positionSec: originalPosition,
    durationSec: 360,
    subtitleTracks: [],
  };
  try {
    await React.act(() =>
      root.render(
        jsx.jsx(PlayerOverlayLayers, {
          snap,
          shellSnap: snap,
          snapRef: { current: snap },
          bridgeRef: { current: null },
          src: { meta: { id: "fixture-a", name: "Fixture A" }, episode: { season: 2, episode: 3 } },
          cast: {},
          liveOverlay: {},
          syncMode: "idle",
          participants: [],
          strokes: [],
          closePlayer: visibleCloseBinding(rawClose, requestClose),
          onBack: visibleCloseBinding(rawClose, requestClose, "onBack"),
        }),
      ),
    );
    for (const label of ["Back", "Leave room"]) {
      const button = [...document.querySelectorAll("button")].find(
        (item) => item.textContent === label,
      )!;
      assert.ok(button);
      const before = exits;
      route = "player";
      await React.act(() => button.click());
      assert.equal(exits, before + 1);
      assert.equal(route, "home");
      assert.equal(departure.getLeaveConfirm().open, false);
    }
  } finally {
    departure.closeLeaveConfirm();
    await React.act(() => root.unmount());
    dom.window.close();
  }
});

test("the native sports Back adapter restores preview while explicit Close still owns cleanup", async () => {
  const source = readFileSync(new URL("../src/views/player.tsx", import.meta.url), "utf8");
  const file = ts.createSourceFile(
    "player.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let callback: ts.Node | undefined;
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(file) === "backFromPlayer" &&
      node.initializer &&
      ts.isCallExpression(node.initializer)
    ) {
      callback = node.initializer.arguments[0];
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  assert.ok(callback);
  const calls: unknown[] = [];
  const sourcePlayer = { sportsDocked: false, url: "fixture://sports", position: 42 };
  const close = () => {
    calls.push("close");
  };
  const actualBack = new Function(
    "src",
    "setDockMinimized",
    "replacePlayerSrc",
    "exitAnyFullscreen",
    "closePlayer",
    `return (${callback.getText(file)});`,
  )(
    sourcePlayer,
    (value: boolean) => calls.push(["minimized", value]),
    (value: unknown) => calls.push(["replace", value]),
    async () => calls.push("exit-fullscreen"),
    close,
  );
  const guardedClose = async () => {
    assert.fail("sports Back must use its official preview path");
  };
  await visibleCloseBinding(close, guardedClose, "onBack", actualBack)();
  assert.deepEqual(calls, [
    ["minimized", false],
    ["replace", { ...sourcePlayer, sportsDocked: true }],
    "exit-fullscreen",
  ]);
  visibleCloseBinding(close, guardedClose)();
  assert.equal(calls.at(-1), "close");
});
