import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { findAction } from "../src/lib/context-actions.ts";
import {
  resolveContextNavigation,
  resolveSidebarNavigation,
} from "../src/chrome/navigation-policy.ts";

function compile(source: string) {
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
}

test("player menu Settings retains PIN-aware navigation and discards old-session PIN approval", async () => {
  const dom = new JSDOM("<div id='root'></div>", { url: "https://fixture.invalid" });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const root = createRoot(document.querySelector("#root")!);
  let locked = true;
  let kid = false;
  let actor = {};
  let source = { id: "player-a" };
  let pin: any = null;
  let navigation: any;
  const destinations: string[] = [];
  const settings = {
    theme: { preset: "default" },
    navCustomization: { order: [], hidden: [] as string[], renamed: {} },
    showPlaylistsTab: true,
    hideContent: {},
    hotkeys: {},
  };
  const profile = { id: "test-profile" };
  const view = () => ({
    topKind: "player",
    player: source,
    chromeHidden: true,
    canGoBack: true,
    view: "home",
    setView: (destination: string) => destinations.push(destination),
    goBack() {},
  });
  const noop = () => {};
  const deps: Record<string, any> = {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "lucide-react": { ArrowLeft: noop, Lock: noop, RefreshCw: noop, UserRound: noop },
    "@/components/ui-icon": { UiIcon: noop },
    "@/components/parental-pin-modal": {
      ParentalPinModal: ({ mode }: any) => {
        pin = mode;
        return React.createElement("div", { "data-fixture-pin": true });
      },
    },
    "@/lib/app-reload": { reloadAppWindow: noop },
    "@/lib/context-menu": {},
    "@/lib/context-content": {},
    "@/components/player/copy-link-button": { copyText: async () => true },
    "@/components/lists/list-toast": { emitListToast: noop },
    "@/lib/deep-link": { shareDeepLink: noop },
    "@/lib/i18n": { useT: () => (text: string) => text },
    "@/lib/parental": { useParental: () => ({ locked, hiddenTabs: {}, unlock: async () => true }) },
    "@/lib/profiles": { useActiveKid: () => kid, useProfiles: () => ({ activeProfile: profile }) },
    "@/lib/settings": { useSettings: () => ({ settings }) },
    "@/lib/social/open-my-profile": { openMyProfile: noop },
    "@/lib/social/open-profile": { canOpenProfile: () => true },
    "@/lib/theme-auth": { currentAuthor: () => null, subscribeAuthor: () => noop },
    "@/lib/social/action-actor": { captureSocialActor: () => actor, assertSocialActor: noop },
    "@/lib/theme": { activeLayout: () => "sidebar", getThemeById: () => null },
    "@/lib/theme-preview": {
      useThemePreview: () => null,
      usePreviewNavCustomization: (value: unknown) => value,
    },
    "@/lib/view": { useView: view },
    "@/lib/playback-history": {
      capturePlaybackActor: () => actor,
      isPlaybackActorCurrent: (value: unknown) => value === actor,
    },
    "@/lib/app-back": {
      hasLocalBackCapability: () => false,
      requestAppBack: noop,
      subscribeLocalBackCapability: () => noop,
    },
    "./context-navigation-icon": { ContextNavigationIcon: noop },
    "./nav-items": {
      useAvailableNavItems: () => [
        { id: "settings", view: "settings", label: "Settings", pinGated: true },
        { id: "kids", view: "kids", label: "Kids" },
      ],
    },
    "./navigation-policy": { resolveSidebarNavigation, resolveContextNavigation },
  };
  const exports: any = {};
  new Function(
    "require",
    "exports",
    compile(
      readFileSync(new URL("../src/chrome/context-page-navigation.tsx", import.meta.url), "utf8"),
    ),
  )((id: string) => {
    if (!(id in deps)) throw new Error(id);
    return deps[id];
  }, exports);
  function Probe() {
    navigation = exports.usePageContextTarget({ includePlayer: true });
    return React.createElement(exports.PageContextNavigationDialogs);
  }
  const render = () => React.act(() => root.render(React.createElement(Probe)));
  const openSettings = () =>
    React.act(async () => {
      const action = findAction(navigation.actions(), "page:go:settings");
      if (action && !action.disabled) await action.run?.();
    });
  const hasPin = () => !!document.querySelector("[data-fixture-pin]");
  try {
    await render();
    await openSettings();
    assert.equal(hasPin(), true);
    assert.deepEqual(destinations, []);
    await React.act(() => pin.onCancel());
    assert.equal(hasPin(), false);
    await openSettings();
    const staleSessionApproval = pin.onUnlock;
    source = { id: "player-b" };
    await render();
    assert.equal(hasPin(), false, "a replacement player invalidates the pending PIN owner");
    await React.act(staleSessionApproval);
    assert.deepEqual(destinations, []);
    await openSettings();
    const staleActorApproval = pin.onUnlock;
    actor = {};
    await render();
    assert.equal(hasPin(), false);
    await React.act(staleActorApproval);
    assert.deepEqual(destinations, []);
    await openSettings();
    await React.act(() => pin.onUnlock());
    assert.deepEqual(
      destinations,
      ["settings"],
      "successful PIN requests the existing guarded destination once",
    );
    locked = false;
    await render();
    await openSettings();
    assert.deepEqual(destinations, ["settings", "settings"]);
    kid = true;
    await render();
    await openSettings();
    assert.equal(destinations.length, 2, "kid navigation cannot gain Settings from the menu");
    kid = false;
    settings.navCustomization.hidden = ["settings"];
    await render();
    await openSettings();
    assert.equal(destinations.length, 2, "hidden Settings does not become a raw fallback");
  } finally {
    await React.act(() => root.unmount());
    dom.window.close();
  }
});
