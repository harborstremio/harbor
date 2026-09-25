import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { parseMagnet } from "../src/lib/torrent/magnet.ts";
import { magnetFromHash } from "../src/lib/debrid/types.ts";

function load(path: string, dependencies: Record<string, unknown>) {
  const code = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const output: any = {};
  new Function("require", "exports", code)((id: string) => {
    if (!(id in dependencies)) throw new Error(id);
    return dependencies[id];
  }, output);
  return output;
}

test("player magnet uses only a supported active-source hash or magnet", () => {
  const actions = load("src/lib/player-actions.ts", {
    react: React,
    "./torrent/magnet": { parseMagnet },
    "./debrid/types": { magnetFromHash },
  });
  const hash = "0123456789abcdef0123456789abcdef01234567";
  assert.equal(actions.playerMagnetUrl(hash), `magnet:?xt=urn:btih:${hash}`);
  assert.equal(
    actions.playerMagnetUrl(`magnet:?xt=urn:btih:${hash}&tr=https://tracker.invalid`),
    `magnet:?xt=urn:btih:${hash}&tr=https://tracker.invalid`,
  );
  for (const invalid of [
    null,
    "",
    "not-a-hash",
    "https://stream.invalid/video.mp4",
    "magnet:?dn=no-hash",
  ])
    assert.equal(actions.playerMagnetUrl(invalid), null);
});

test("published player tools refresh after source and subtitle capability changes", () => {
  const actions = load("src/lib/player-actions.ts", {
    react: React,
    "./torrent/magnet": { parseMagnet },
    "./debrid/types": { magnetFromHash },
  });
  const first = {
    download() {},
    toggleFullscreen() {},
    canDownload: true,
    downloadSubtitle() {},
    canDownloadSubtitle: true,
    streamUrl: "a",
    infoHash: null,
    magnetUrl: "magnet:a",
    liveSync() {},
    canLiveSync: true,
  };
  actions.setPlayerActions(first);
  actions.setPlayerActions({ ...first, magnetUrl: null, canLiveSync: false });
  assert.equal(actions.currentPlayerActions().magnetUrl, null);
  assert.equal(actions.currentPlayerActions().canLiveSync, false);
  actions.setPlayerActions(null);
  assert.equal(actions.currentPlayerActions(), null);
});

test("player menu has a source-scoped magnet strip and separate subtitle and stream tools", async () => {
  const copied: string[] = [];
  const opened: string[] = [];
  let settings = 0;
  let synced = 0;
  let current: any = {
    streamUrl: "https://media.invalid/a",
    magnetUrl: "magnet:a",
    canDownload: true,
    canDownloadSubtitle: true,
    canLiveSync: true,
    download() {},
    downloadSubtitle() {},
    toggleFullscreen() {},
    liveSync() {
      synced++;
    },
  };
  const icons = Object.fromEntries(
    ["AudioLines", "Download", "ExternalLink", "Link2", "Magnet", "Maximize", "Settings"].map(
      (key) => [key, () => null],
    ),
  );
  const { playerContextSources } = load("src/components/context-menu/player-actions.tsx", {
    "react/jsx-runtime": jsxRuntime,
    "lucide-react": icons,
    "@/lib/i18n": { t: (text: string) => text },
    "./content-actions": {
      copyContextText: async (text: string) => {
        copied.push(text);
      },
    },
    "@/lib/social/link-out": {
      openLinkOut: async (url: string) => {
        opened.push(url);
      },
    },
  });
  const source = playerContextSources(
    () => current,
    () => ({
      id: "page:go:settings",
      label: "Settings",
      run: () => {
        settings++;
      },
    }),
  );
  assert.deepEqual(
    source.quick.actions().map((a: any) => a.label),
    ["Copy magnet", "Settings"],
  );
  assert.equal(
    source.rows.actions().some((a: any) => /magnet|Back|Resume/.test(a.label)),
    false,
  );
  await source.quick.actions()[0].run();
  assert.deepEqual(copied, ["magnet:a"]);
  current = {
    ...current,
    streamUrl: "https://media.invalid/b",
    magnetUrl: null,
    canLiveSync: false,
  };
  assert.deepEqual(
    source.quick.actions().map((a: any) => a.label),
    ["Settings"],
  );
  const live = source.rows.actions().find((a: any) => a.label === "Live sync");
  assert.equal(live.disabled, true);
  assert.equal(live.reason, "Select a subtitle track first.");
  assert.equal(synced, 0);
  await source.rows
    .actions()
    .find((a: any) => a.label === "Copy stream link")
    .run();
  await source.rows
    .actions()
    .find((a: any) => a.label === "Open in browser")
    .run();
  assert.equal(copied[1], "https://media.invalid/b");
  assert.deepEqual(opened, ["https://media.invalid/b"]);
  await source.quick.actions()[0].run();
  assert.equal(settings, 1);
  current = null;
  assert.equal(source.quick.isValid(), false);
  assert.deepEqual(source.rows.actions(), []);
});

test("player Settings preserves the current navigation command's permission, PIN and availability", async () => {
  let pinRequests = 0;
  let navigations = 0;
  let available: any = undefined;
  const icons = Object.fromEntries(
    ["AudioLines", "Download", "ExternalLink", "Link2", "Magnet", "Maximize", "Settings"].map(
      (key) => [key, () => null],
    ),
  );
  const { playerContextSources } = load("src/components/context-menu/player-actions.tsx", {
    "react/jsx-runtime": jsxRuntime,
    "lucide-react": icons,
    "@/lib/i18n": { t: (text: string) => text },
    "./content-actions": { copyContextText: async () => {} },
    "@/lib/social/link-out": { openLinkOut: async () => {} },
  });
  const source = playerContextSources(
    () => ({}),
    () => available,
  );
  assert.deepEqual(source.quick.actions(), [], "hidden/kid navigation must not gain Settings");
  const lockIcon = React.createElement("span", null, "locked");
  available = {
    id: "page:go:settings",
    label: "Settings",
    icon: lockIcon,
    reason: "PIN required",
    run: () => {
      pinRequests++;
    },
  };
  const gated = source.quick.actions()[0];
  assert.equal(gated.id, "player:settings");
  assert.equal(gated.icon, lockIcon);
  assert.equal(gated.reason, "PIN required");
  await gated.run();
  assert.equal(pinRequests, 1);
  assert.equal(navigations, 0, "the player menu cannot bypass the supplied PIN operation");
  available = { ...available, disabled: true };
  assert.equal(source.quick.actions()[0].disabled, true);
  available = {
    ...available,
    disabled: false,
    run: () => {
      navigations++;
    },
  };
  await source.quick.actions()[0].run();
  assert.equal(navigations, 1, "unlocked navigation retains the shared departure dispatcher");
  available = undefined;
  assert.deepEqual(source.quick.actions(), [], "policy changes are read while the menu is open");
});
