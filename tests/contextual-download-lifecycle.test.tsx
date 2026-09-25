import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { JSDOM } from "jsdom";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { createRoot } from "react-dom/client";
import * as preparation from "../src/lib/download/contextual-preparation";

test("movie and episode preparation is inert; matching picker cancellation restores target and stale callbacks are denied", async () => {
  const dom = new JSDOM("<div id='root'></div><button id='origin'>Origin</button>", {
    url: "http://localhost/",
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  let actor = "one";
  let auth = "fixture-one";
  let topPath = "/home";
  let picker: any = null;
  let panel: any;
  let api: any;
  let mounts = 0;
  const calls: any[] = [];
  const dependencies: Record<string, any> = {
    react: React,
    "react/jsx-runtime": jsx,
    "@/lib/auth": { readActiveStremioAuthKey: () => auth, useAuth: () => ({ authKey: auth }) },
    "@/lib/download/contextual-preparation": preparation,
    "@/lib/membership-operations": {
      captureMembershipProfile: () => actor,
      isMembershipProfileCurrent: (value: string) => value === actor,
    },
    "@/lib/view": {
      useView: () => ({
        topPath,
        picker,
        openPicker: (...args: any[]) => {
          calls.push(args);
          picker = { contextRequestId: args[2].contextRequestId };
          topPath = "/picker";
        },
      }),
    },
    "./manual-download-picker": {
      ManualDownloadPicker: (props: any) => {
        panel = props;
        React.useEffect(() => {
          mounts++;
        }, []);
        return props.visible ? jsx.jsx("div", { "data-panel": true }) : null;
      },
    },
  };
  const output = ts.transpileModule(
    readFileSync(
      new URL("../src/components/context-menu/use-manual-download.tsx", import.meta.url),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const module = { exports: {} as any };
  new Function("require", "module", "exports", output)(
    (id: string) => {
      assert.ok(dependencies[id], `unmocked boundary ${id}`);
      return dependencies[id];
    },
    module,
    module.exports,
  );
  function App() {
    api = module.exports.useManualDownload({ actorKey: actor });
    return api.manualDownloadDialog;
  }
  const root = createRoot(document.querySelector("#root")!);
  const render = () => React.act(() => root.render(jsx.jsx(App, {})));
  await render();
  const origin = document.querySelector<HTMLElement>("#origin")!;
  const movie = { id: "tt-movie", type: "movie", name: "Fixture" };
  await React.act(() => api.beginManualDownload(movie, undefined, origin));
  assert.equal(calls.length, 0);
  assert.equal(panel.meta.id, movie.id);
  assert.equal(panel.visible, true);
  const first = panel;
  await React.act(() => panel.onPick(movie));
  await render();
  assert.equal(panel.visible, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][2].intent, "download");
  assert.equal(calls[0][2].returnTo, "previous");
  assert.equal(calls[0][2].autoPlay, undefined);
  picker = null;
  topPath = "/home";
  await render();
  assert.equal(panel.visible, true);
  assert.equal(
    mounts,
    1,
    "source cancellation retains the preparation component and selection state",
  );
  const ep = {
    season: 2,
    episode: 4,
    videoId: "fixture:episode:2:4",
    sourceMetaId: "fixture:source-series",
  };
  await React.act(() => api.beginManualDownload({ ...movie, type: "series" }, ep, origin));
  assert.deepEqual(panel.episode, ep);
  assert.equal(
    panel.meta.id,
    ep.sourceMetaId,
    "the panel prepares the episode's real source title",
  );
  await React.act(() => first.onPick(movie));
  assert.equal(calls.length, 1, "old replaced preparation cannot launch picker");
  const oldActorPanel = panel;
  actor = "two";
  auth = "fixture-two";
  await render();
  await React.act(() => oldActorPanel.onPick(movie, ep));
  assert.equal(calls.length, 1);
  assert.equal(document.querySelector("[data-panel]"), null);
  await React.act(() => api.beginManualDownload(movie));
  const oldAuthPanel = panel;
  auth = "another-stremio-account";
  await render();
  assert.equal(
    document.querySelector("[data-panel]"),
    null,
    "auth-only switching also hides preparation",
  );
  await React.act(() => oldAuthPanel.onPick(movie));
  assert.equal(calls.length, 1, "auth-only switching rejects delayed source callbacks");
  await React.act(() => root.unmount());
  dom.window.close();
});
