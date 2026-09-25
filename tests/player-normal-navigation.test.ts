import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { JSDOM } from "jsdom";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import * as icons from "lucide-react";
import { createRoot } from "react-dom/client";
import * as leave from "../src/lib/player/leave-confirm";
import * as back from "../src/lib/back-intercept";
import * as pickerReturn from "../src/lib/picker-return";
import * as dockedNavigation from "../src/lib/player/docked-navigation";
import { isBackKey } from "../src/lib/keyboard-navigation/geometry";
import { findHotkeyMatch, shouldHandleGlobalKeyboardEvent } from "../src/lib/hotkeys";

function harness() {
  const dom = new JSDOM("<body><div id='app'></div>", {
    url: "http://localhost/",
    pretendToBeVisual: true,
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    CustomEvent: dom.window.CustomEvent,
    localStorage: dom.window.localStorage,
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const calls: unknown[] = [];
  let fullscreen = false;
  const dependencies: Record<string, unknown> = {
    react: React,
    "react/jsx-runtime": jsx,
    "lucide-react": icons,
    "@/lib/i18n": { useT: () => (key: string) => key },
    "@/lib/social/open-profile": {
      registerProfileDestination: () => () => {},
      subscribeOpenProfile: () => () => {},
    },
    "@/lib/social/open-group": { subscribeOpenGroup: () => () => {} },
    "./discover": { trackEvent: () => {}, profileFromMeta: () => ({}) },
    "./settings": { useSettings: () => ({ settings: {} }) },
    "./smooth-scroll": {},
    "./together/provider": { useTogether: () => ({ snapshot: { state: "idle" } }) },
    "./fullscreen-state": { beginMarathonAdvance: () => calls.push("advance") },
    "./back-intercept": back,
    "./picker-return": pickerReturn,
    "./player/docked-navigation": dockedNavigation,
    "@/lib/keyboard-navigation": { captureFocusReturn: () => () => {} },
    "@/lib/keyboard-navigation/geometry": { isBackKey },
    // Navigation must remain independent of the player confirmation store.
    "./player/leave-confirm": new Proxy(
      {},
      {
        get: () => () => assert.fail("ordinary navigation invoked a player departure interceptor"),
      },
    ),
    "@/lib/player/leave-confirm": leave,
    "@/lib/picker-cache": { clearOnePickerCache: () => {} },
    "@/lib/playback-history": {
      clearPlayback: () => {},
      readPlayback: () => null,
      savePlayback: (...args: unknown[]) => calls.push(["playback", ...args]),
      streamMatchesEntry: () => false,
    },
    "@/lib/player/playback-clock": { getPlaybackPosition: () => 42 },
    "@/lib/resume": { saveResumeMs: (...args: unknown[]) => calls.push(["resume", ...args]) },
    "@/lib/fullscreen-state": {
      isAnyFullscreen: async () => fullscreen,
      exitAnyFullscreen: async () => calls.push("exit-fullscreen"),
      exitWindowFullscreenOnPlayerClose: async () => calls.push("fullscreen"),
    },
    "../player-utils": { MAX_AUTORETRY_ATTEMPTS: 3 },
  };
  const load = (path: string): any => {
    const module = { exports: {} };
    const output = ts.transpileModule(
      readFileSync(new URL(`../${path}`, import.meta.url), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
        },
      },
    ).outputText;
    new Function("require", "module", "exports", output)(
      (id: string) => {
        assert.ok(id in dependencies, `Unexpected dependency ${id}`);
        return dependencies[id];
      },
      module,
      module.exports,
    );
    return module.exports;
  };
  const root = createRoot(document.querySelector("#app")!);
  return {
    dom,
    root,
    calls,
    load,
    dependencies,
    setFullscreen: (value: boolean) => {
      fullscreen = value;
    },
    async dispose() {
      await React.act(() => leave.closeLeaveConfirm());
      await React.act(() => root.unmount());
      dom.window.close();
    },
  };
}

test("Settings and ordinary routes use the existing view stack without a player leave interceptor", async () => {
  const h = harness();
  const { ViewProvider, useView } = h.load("src/lib/view.tsx");
  let view: any;
  function Probe() {
    view = useView();
    return null;
  }
  try {
    await React.act(() => h.root.render(jsx.jsx(ViewProvider, { children: jsx.jsx(Probe, {}) })));
    const source = {
      url: "fixture://video",
      meta: { id: "fixture", name: "Fixture", type: "movie" },
    };
    await React.act(() => view.openPlayer(source));
    await React.act(() => view.openSettings("player"));
    assert.equal(view.topKind, "settings");
    assert.equal(leave.getLeaveConfirm().open, false);
    await React.act(() => view.goBack());
    assert.equal(view.player, source, "Settings retains the official return-to-player stack");
    await React.act(() => view.goForward());
    assert.equal(view.topKind, "settings");
    await React.act(() => view.goBack());
    await React.act(() => view.setView("library"));
    assert.equal(view.topKind, "library");
    await React.act(() => view.openPlayer(source));
    await React.act(() => view.openProfile("another-person"));
    assert.equal(view.topKind, "profile");
    assert.equal(leave.getLeaveConfirm().open, false);
  } finally {
    await h.dispose();
  }
});

test("the original Settings shortcut ignores playback and respects remapping outside playback", async () => {
  const h = harness();
  document.body.tabIndex = -1;
  document.body.focus();
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const marker = app.indexOf('"globalSettingsOpen"');
  const effect = ts.transpileModule(
    app.slice(
      app.lastIndexOf("  useEffect(() => {", marker),
      app.indexOf("\n  useEffect(() => {", marker),
    ),
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  let opens = 0;
  let dispose = () => {};
  const install = (player: unknown, hotkeys = {}) => {
    dispose();
    new Function(
      "useEffect",
      "window",
      "document",
      "settings",
      "player",
      "openSettings",
      "findHotkeyMatch",
      "shouldHandleGlobalKeyboardEvent",
      effect,
    )(
      (callback: () => () => void) => {
        dispose = callback();
      },
      window,
      document,
      { hotkeys },
      player,
      () => {
        opens++;
      },
      findHotkeyMatch,
      shouldHandleGlobalKeyboardEvent,
    );
  };
  const press = (key: string, extra = {}) => {
    const event = new h.dom.window.KeyboardEvent("keydown", {
      key,
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
      ...extra,
    });
    document.body.dispatchEvent(event);
    return event.defaultPrevented;
  };
  try {
    install({ url: "fixture://video" });
    assert.equal(press("s"), true, "native Save is consumed during playback");
    assert.equal(opens, 0);
    install(null);
    press("s");
    assert.equal(opens, 1);
    press("s", { repeat: true });
    assert.equal(opens, 1);
    install(null, { globalSettingsOpen: "alt+p" });
    assert.equal(press("s"), false);
    press("p", { ctrlKey: false, altKey: true });
    assert.equal(opens, 2);
  } finally {
    dispose();
    await h.dispose();
  }
});

test("cast browser retains its independent original details confirmation and remembered preference", async () => {
  const h = harness();
  const target = { id: "cast-target", name: "Cast target", type: "movie" };
  const opened: unknown[] = [];
  const empty = () => null;
  Object.assign(h.dependencies, {
    "@/components/icons/search-icon": { Search: empty },
    "@/components/ui-icon": { UiIcon: empty },
    "@/lib/queue": { useQueue: () => [] },
    "./cast-modal/episode-picker": { EpisodePicker: empty },
    "./cast-modal/genre-backdrop": { GenreBackdrop: empty },
    "./cast-modal/genre-panel": { GenrePanel: empty },
    "./cast-modal/person-panel": { PersonPanel: empty },
    "./cast-modal/queue-panel": { QueuePanel: empty },
    "./cast-modal/search-panel": { SearchPanel: empty },
    "./cast-modal/title-panel": {
      TitlePanel: ({ onOpenDetail }: any) =>
        jsx.jsx("button", {
          onClick: () => onOpenDetail(target),
          children: "Details",
        }),
    },
  });
  const confirmation = h.load("src/components/player/cast-modal/exit-confirm.tsx");
  h.dependencies["./cast-modal/exit-confirm"] = confirmation;
  const { CastModal } = h.load("src/components/player/cast-modal.tsx");
  const click = (text: string) =>
    React.act(() => {
      const button = [...document.querySelectorAll("button")].find(
        (item) => item.textContent === text,
      );
      assert.ok(button, `expected ${text}`);
      button.click();
    });
  try {
    await React.act(() =>
      h.root.render(
        jsx.jsx(CastModal, {
          open: true,
          onClose: empty,
          meta: target,
          tmdbKey: null,
          onOpenDetail: (meta: unknown) => opened.push(meta),
        }),
      ),
    );
    await click("Details");
    assert.equal(document.querySelector("h3")?.textContent, "Exit this video?");
    assert.deepEqual(opened, []);
    await click("Keep watching");
    assert.deepEqual(opened, []);
    await click("Details");
    await click("Don't ask me again");
    await click("Exit");
    assert.deepEqual(opened, [target]);
    assert.equal(localStorage.getItem(confirmation.SKIP_EXIT_CONFIRM_KEY), "1");
    await click("Details");
    assert.deepEqual(opened, [target, target]);
    assert.equal(document.querySelector("h3"), null);
    assert.equal(
      leave.getLeaveConfirm().open,
      false,
      "cast preference remains independent of Esc preference",
    );
  } finally {
    await h.dispose();
  }
});

test("the original close flow saves progress before PiP, casting, fullscreen and room cleanup", async () => {
  const h = harness();
  const { usePlayerExit } = h.load("src/views/player/hooks/use-player-exit.ts");
  let hook: any;
  function Probe() {
    hook = usePlayerExit({
      src: {
        url: "fixture://episode",
        historyUrl: "fixture://source",
        meta: { id: "show", name: "Show" },
      },
      season: 2,
      episode: 3,
      bridgeRef: { current: null },
      liveUrl: "fixture://episode",
      liveStreamRef: { title: "Episode" },
      inRoom: true,
      isHost: true,
      instantPlay: false,
      captureExitSnapshot: async () => h.calls.push("snapshot"),
      exitPip: async () => h.calls.push("pip"),
      castActiveRef: { current: true },
      stopCast: async () => h.calls.push("cast"),
      publishState: (state: unknown) => h.calls.push(["party-state", state]),
      notifyHostLeaving: () => h.calls.push("party-leave"),
      clearInvite: () => h.calls.push("invite"),
      exitPlayback: () => h.calls.push("exit"),
      openPicker: () => {},
    });
    return null;
  }
  try {
    await React.act(() => h.root.render(jsx.jsx(Probe, {})));
    await hook.closePlayer();
    assert.deepEqual(
      h.calls.map((call) => (Array.isArray(call) ? call[0] : call)),
      [
        "snapshot",
        "resume",
        "playback",
        "pip",
        "cast",
        "fullscreen",
        "party-state",
        "party-leave",
        "invite",
        "exit",
      ],
    );
    assert.deepEqual(h.calls[1], ["resume", "show", 42000, 2, 3]);
    assert.deepEqual(h.calls[2], [
      "playback",
      "show",
      { title: "Show", url: "fixture://source" },
      2,
      3,
    ]);
    assert.deepEqual(h.calls[6], [
      "party-state",
      {
        mediaId: null,
        mediaTitle: null,
        episode: null,
        posterUrl: null,
        positionSeconds: 0,
        playing: false,
      },
    ]);
  } finally {
    await h.dispose();
  }
});

test("official Back confirmation keeps cancellation, remembered preference and fullscreen priority", async () => {
  const h = harness();
  const { requestPlayerClose } = h.load("src/views/player/request-player-close.ts");
  const { LeaveConfirmModal } = h.load("src/components/player/leave-confirm-modal.tsx");
  let exits = 0;
  let remembers = 0;
  const options = {
    drawMode: false,
    setDrawMode: (value: boolean) => h.calls.push(["draw", value]),
    closePlayer: () => {
      exits++;
    },
    playerEscExitsFullscreen: true,
    playerConfirmLeave: true,
    onRememberConfirmLeave: () => {
      remembers++;
    },
  };
  const button = (label: string) =>
    [...document.querySelectorAll("button")].find((el) => el.textContent === label)!;
  try {
    await React.act(() => h.root.render(jsx.jsx(LeaveConfirmModal, {})));
    await React.act(() => requestPlayerClose({ ...options, drawMode: true }));
    assert.deepEqual(h.calls, [["draw", false]]);
    assert.equal(exits, 0);
    h.setFullscreen(true);
    await React.act(() => requestPlayerClose(options));
    assert.deepEqual(h.calls, [["draw", false], "exit-fullscreen"]);
    assert.equal(leave.getLeaveConfirm().open, false);
    h.setFullscreen(false);
    await React.act(() => requestPlayerClose(options));
    assert.equal(exits, 0);
    assert.ok(button("Keep watching"));
    await React.act(() => button("Keep watching").click());
    assert.equal(exits, 0);
    assert.equal(leave.getLeaveConfirm().open, false);
    await React.act(() => requestPlayerClose(options));
    await React.act(() => document.querySelector<HTMLInputElement>("input")!.click());
    await React.act(() => button("Leave").click());
    assert.equal(exits, 1);
    assert.equal(remembers, 1);
    assert.equal(leave.getLeaveConfirm().open, false);
    await React.act(() => requestPlayerClose({ ...options, playerConfirmLeave: false }));
    assert.equal(exits, 2);
    assert.equal(leave.getLeaveConfirm().open, false);
  } finally {
    await h.dispose();
  }
});
