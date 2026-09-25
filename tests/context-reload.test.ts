import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import * as ReactDOM from "react-dom";
import { createRoot } from "react-dom/client";
import * as icons from "lucide-react";
import { JSDOM } from "jsdom";
import ts from "typescript";
import * as navigation from "../src/chrome/navigation-policy.ts";
import * as back from "../src/lib/app-back.ts";
import { contextNavigationFooter } from "../src/lib/context-quick-actions.ts";
import { executeContextAction } from "../src/lib/context-actions.ts";
import * as content from "../src/lib/context-content.ts";

function load(file: string, dependencies: Record<string, unknown>, nativeWindow?: unknown) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", "window", output)(
    (name: string) => {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    module,
    module.exports,
    nativeWindow ?? globalThis.window,
  );
  return module.exports as any;
}

test("root Refresh and the original File menu reload the same window without navigating or synthesizing keys", async () => {
  const dom = new JSDOM("<!doctype html><div id='root'></div>", {
    url: "https://fixture.invalid/settings",
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  let reloads = 0;
  let keys = 0;
  let navigations = 0;
  dom.window.addEventListener("keydown", () => keys++);
  const reload = load(
    "src/lib/app-reload.ts",
    {},
    {
      location: { reload: () => reloads++ },
    },
  );
  const empty = () => null;
  const identity = (key: string) => key;
  const settings = {
    navCustomization: { order: [], hidden: [], renamed: {} },
    hideContent: {},
    showPlaylistsTab: true,
    theme: { preset: "fixture" },
  };
  const view = {
    view: "settings",
    topKind: "settings",
    canGoBack: false,
    goBack: () => navigations++,
    setView: () => navigations++,
  };
  const parental = { locked: false, hiddenTabs: {} };
  const dependencies = {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "react-dom": ReactDOM,
    "lucide-react": icons,
    "@/components/ui-icon": { UiIcon: empty },
    "@/components/icons/harbor-mark": { HarborMark: empty },
    "@/components/parental-pin-modal": { ParentalPinModal: empty },
    "@/lib/i18n": { useT: () => identity },
    "@/lib/settings": { useSettings: () => ({ settings, update: empty }) },
    "@/lib/view": { useView: () => view },
    "@/lib/playback-history": {
      capturePlaybackActor: () => "fixture",
      isPlaybackActorCurrent: (actor: string) => actor === "fixture",
    },
    "@/lib/parental": { useParental: () => parental },
    "@/lib/profiles": {
      useProfiles: () => ({ activeProfile: { id: "fixture" } }),
      useActiveKid: empty,
    },
    "@/lib/theme": { activeLayout: () => "sidebar", getThemeById: empty },
    "@/lib/theme-preview": {
      usePreviewNavCustomization: (value: unknown) => value,
      useThemePreview: empty,
    },
    "@/lib/social/open-my-profile": { openMyProfile: empty },
    "@/lib/social/open-profile": { canOpenProfile: () => true },
    "@/lib/theme-auth": { currentAuthor: empty, subscribeAuthor: () => empty },
    "@/lib/social/action-actor": { captureSocialActor: empty, assertSocialActor: empty },
    "@/lib/app-back": back,
    "@/lib/app-reload": reload,
    "@/lib/context-menu": {},
    "@/lib/context-content": content,
    "@/components/player/copy-link-button": { copyText: async () => true },
    "@/components/lists/list-toast": { emitListToast: empty },
    "@/lib/deep-link": { shareDeepLink: empty },
    "./context-navigation-icon": { ContextNavigationIcon: empty },
    "./navigation-policy": navigation,
    "./nav-items": {
      useAvailableNavItems: () => [
        { id: "home", view: "home", label: "Home" },
        { id: "settings", view: "settings", label: "Settings" },
      ],
    },
    "@/lib/build-info": { APP_VERSION: "fixture" },
    "@/lib/window": { close: empty, openUrl: empty },
    "@/lib/fullscreen-state": { toggleWindowFullscreen: empty },
    "@/lib/updater/use-update": { checkForUpdate: empty },
    "@/lib/config/endpoints": { HARBOR_BUGS_BASE: "https://fixture.invalid" },
  };
  const page = load("src/chrome/context-page-navigation.tsx", dependencies);
  const { HybridMenuBar } = load("src/chrome/hybrid-menu-bar.tsx", dependencies);
  let target: ReturnType<typeof page.usePageContextTarget>;
  function Probe() {
    target = page.usePageContextTarget();
    return React.createElement(HybridMenuBar);
  }
  const root = createRoot(dom.window.document.getElementById("root")!);
  try {
    await React.act(async () => root.render(React.createElement(Probe)));
    const oldTarget = target;
    const footer = contextNavigationFooter(target.actions(), []);
    assert.deepEqual(
      footer.map((row) => row.id),
      ["page:my-profile", "page:go-to", "page:refresh"],
    );
    assert.equal(footer[2].label, "Refresh");
    assert.equal(footer[2].shortcut, "Ctrl+R");
    assert.notEqual(footer[1].group, footer[2].group);
    assert.equal(target.actions().find((row) => row.id === "page:back").disabled, true);
    assert.equal(
      footer[1].children?.some((row) => row.id === "page:refresh"),
      false,
    );
    await executeContextAction(target, "page:refresh");
    assert.equal(reloads, 1);
    const file = [...dom.window.document.querySelectorAll("button")].find(
      (button) => button.textContent === "File",
    )!;
    await React.act(async () => file.click());
    const originalReload = [...dom.window.document.querySelectorAll("button")].find(
      (button) => button.textContent === "ReloadCtrl+R",
    )!;
    assert.ok(originalReload);
    await React.act(async () => originalReload.click());
    assert.equal(reloads, 2);
    assert.equal(keys, 0);
    assert.equal(navigations, 0);
    view.topKind = "home";
    await React.act(async () => root.render(React.createElement(Probe)));
    await assert.rejects(executeContextAction(oldTarget, "page:refresh"), /no longer available/);
    await executeContextAction(target, "page:refresh");
    assert.equal(reloads, 3);
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
  }
});

test("person and eBook page sharing follows the captured page and preserves navigation boundaries", async () => {
  const dom = new JSDOM("<div id='root'></div>", { url: "https://fixture.invalid/person/12" });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const empty = () => null;
  const copies: string[] = [];
  const toasts: string[] = [];
  let copySucceeds = true;
  const view = {
    topKind: "person",
    personId: 12 as number | null,
    ebookId: null as string | null,
    chromeHidden: false,
    canGoBack: true,
    goBack: empty,
    setView: empty,
  };
  const settings = {
    navCustomization: { order: [], hidden: [], renamed: {} },
    hideContent: {},
    showPlaylistsTab: true,
    theme: { preset: "fixture" },
  };
  const page = load("src/chrome/context-page-navigation.tsx", {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "lucide-react": icons,
    "@/components/ui-icon": { UiIcon: empty },
    "@/components/parental-pin-modal": { ParentalPinModal: empty },
    "@/components/player/copy-link-button": {
      copyText: async (value: string) => {
        copies.push(value);
        return copySucceeds;
      },
    },
    "@/components/lists/list-toast": { emitListToast: (value: string) => toasts.push(value) },
    "@/lib/deep-link": {
      shareDeepLink: (type: string, id: string) =>
        `harbor://detail/${encodeURIComponent(type)}/${encodeURIComponent(id)}`,
    },
    "@/lib/i18n": { useT: () => (value: string) => value },
    "@/lib/settings": { useSettings: () => ({ settings }) },
    "@/lib/view": { useView: () => view },
    "@/lib/parental": { useParental: () => ({ locked: false, hiddenTabs: {} }) },
    "@/lib/profiles": {
      useProfiles: () => ({ activeProfile: { id: "fixture" } }),
      useActiveKid: empty,
    },
    "@/lib/theme": { activeLayout: () => "sidebar", getThemeById: empty },
    "@/lib/theme-preview": {
      usePreviewNavCustomization: (value: unknown) => value,
      useThemePreview: empty,
    },
    "@/lib/social/open-my-profile": { openMyProfile: empty },
    "@/lib/social/open-profile": { canOpenProfile: () => true },
    "@/lib/theme-auth": { currentAuthor: empty, subscribeAuthor: () => empty },
    "@/lib/social/action-actor": { captureSocialActor: empty, assertSocialActor: empty },
    "@/lib/playback-history": { capturePlaybackActor: empty, isPlaybackActorCurrent: () => true },
    "@/lib/app-back": back,
    "@/lib/app-reload": { reloadAppWindow: empty },
    "@/lib/context-menu": {},
    "@/lib/context-content": content,
    "./context-navigation-icon": { ContextNavigationIcon: empty },
    "./navigation-policy": navigation,
    "./nav-items": {
      useAvailableNavItems: () => [{ id: "home", view: "home", label: "Home" }],
    },
  });
  let target: ReturnType<typeof page.usePageContextTarget>;
  function Probe() {
    target = page.usePageContextTarget();
    return null;
  }
  const root = createRoot(document.getElementById("root")!);
  const render = () => React.act(() => root.render(React.createElement(Probe)));
  const share = () => target.actions().find((row) => row.label === "Share as link");
  try {
    await render();
    assert.equal(target.scope, "page-background");
    assert.ok(share(), "the actual person page exposes its existing official share action");
    assert.deepEqual(
      contextNavigationFooter(target.actions(), []).map((row) => row.id),
      ["page:my-profile", "page:go-to", "page:refresh"],
      "page sharing must not enter the navigation footer of a clicked card or image",
    );
    const personTarget = target;
    const personAction = share().id;
    await executeContextAction(target, personAction);
    assert.deepEqual(copies, ["harbor://detail/person/12"]);
    view.personId = 34;
    await render();
    await assert.rejects(executeContextAction(personTarget, personAction), /no longer available/);
    assert.equal(copies.length, 1, "an old person menu cannot share the replacement person");
    view.topKind = "ebook";
    view.ebookId = "book:a/b";
    await render();
    await executeContextAction(target, share().id);
    assert.equal(copies.at(-1), "harbor://detail/ebook/book%3Aa%2Fb");
    assert.deepEqual(toasts, ["Link copied", "Link copied"]);
    copySucceeds = false;
    await assert.rejects(executeContextAction(target, share().id), /Could not copy/);
    assert.equal(toasts.length, 2, "clipboard failure cannot report success");
    view.ebookId = null;
    await render();
    assert.equal(share(), undefined, "an eBook browsing page has no book to share");
    view.topKind = "home";
    await render();
    assert.equal(share(), undefined);
    view.chromeHidden = true;
    await render();
    assert.equal(target, null);
  } finally {
    await React.act(() => root.unmount());
    dom.window.close();
  }
});
