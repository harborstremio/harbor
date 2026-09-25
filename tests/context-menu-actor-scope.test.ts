import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import * as lucide from "lucide-react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import ts from "typescript";
import * as menu from "../src/lib/context-menu.tsx";
import * as quickActions from "../src/lib/context-quick-actions.ts";
import * as actions from "../src/lib/context-actions.ts";
import * as content from "../src/lib/context-content.ts";
import * as background from "../src/lib/context-page-background.ts";
import * as navigationPolicy from "../src/chrome/navigation-policy.ts";
import * as back from "../src/lib/app-back.ts";

async function fixture({ presentation = false, pageShare = false, ebookDetails = false } = {}) {
  const dom = new JSDOM("<!doctype html><div id='root'></div>", {
    url: "https://fixture.invalid",
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    MouseEvent: dom.window.MouseEvent,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const listeners = new Set<() => void>();
  let author = { id: "actor-one", handle: "same-handle", alias: "First alias" };
  let user = { _id: "stremio-one" };
  const prepared: unknown[] = [];
  let state!: ReturnType<typeof menu.useContextMenu>;
  const empty = () => null;
  const identity = (key: string) => key;
  const childrenOnly = ({ children }: { children?: React.ReactNode }) => children;
  const player = {
    src: { meta: { id: "player-a", type: "movie", name: "Player A" } },
    magnetUrl: null as string | null,
    streamUrl: "https://controlled.invalid/video",
    canDownload: true,
    canDownloadSubtitle: true,
    canLiveSync: true,
    download() {},
    downloadSubtitle() {},
    toggleFullscreen() {},
    liveSync() {},
  };
  const last = { id: "playback:last:a", label: "Continue last watched", run() {} };
  const navigation = [
    { id: "page:back", label: "Back", run() {} },
    { id: "page:my-profile", label: "Open my profile", run() {} },
    {
      id: "page:go-to",
      label: "Go to",
      children: [
        { id: "page:go:settings", label: "Settings", run() {} },
        { id: "page:go:home", label: "Home", run() {} },
      ],
    },
    { id: "page:refresh", label: "Refresh", run() {} },
  ];
  if (pageShare) navigation.push({ id: "page:share:person:12", label: "Share as link", run() {} });
  const rows = ({ source }: { source: actions.ActionSource }) =>
    React.createElement(
      "div",
      null,
      source.actions().map((action) =>
        React.createElement(
          "button",
          {
            key: action.id,
            "data-context-action": action.id,
            onClick: action.run,
          },
          action.label,
        ),
      ),
    );
  const deps: Record<string, unknown> = {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "lucide-react": lucide,
    "@/lib/context-menu": menu,
    "@/lib/context-quick-actions": quickActions,
    "@/lib/context-actions": actions,
    "@/lib/active-addon": { useActiveAddon: empty },
    "@/components/player/copy-link-button": { copyText: async () => true },
    "@/components/lists/list-toast": { emitListToast: empty },
    "@/lib/deep-link": { shareDeepLink: empty },
    "@/lib/settings": {
      useSettings: () => ({ settings: { navCustomization: {} }, update: empty }),
    },
    "@/chrome/nav-items": { NAV_ITEMS: [], effectiveNavOrder: () => [] },
    "@/chrome/nav-edit-mode": { useNavEditMode: () => false },
    "@/lib/manga-favorites": {
      useIsMangaFavorite: () => false,
      useMangaFavorites: () => ({ toggle: empty }),
    },
    "@/lib/manga-progress": {
      useMangaProgressEntry: empty,
      useReadMangaChapterIds: () => new Set(),
    },
    "@/lib/manga-bookmarks": { useMangaBookmarks: () => [] },
    "@/lib/manga-downloads": {},
    "@/lib/manga/read-intent": {},
    "@/lib/manga-lists": { mangaLists: {} },
    "@/lib/manga/api": {},
    "@/lib/manga/chapter-identity": {},
    "@/lib/auth": {
      useAuth: () => ({
        user: React.useSyncExternalStore(
          (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
          },
          () => user,
        ),
      }),
    },
    "@/lib/debrid/types": {},
    "@/lib/social/link-out": {},
    "@/lib/i18n": { useT: () => identity, t: identity },
    "@/lib/player-actions": {
      usePlayerActions: () => (presentation ? player : null),
      currentPlayerActions: () => (presentation ? player : null),
    },
    "@/lib/playback-history": {},
    "@/lib/together/provider": { useTogether: () => ({ snapshot: { state: "idle" } }) },
    "@/lib/view": {
      useView: () => ({
        topKind: ebookDetails ? "ebook" : pageShare ? "person" : "home",
        topPath: ebookDetails ? "/ebook/book-12" : pageShare ? "/person/12" : "/home",
        ebookId: ebookDetails ? "book-12" : null,
      }),
    },
    "@/lib/watchlist": { useInWatchlist: () => false },
    "@/lib/media-context-actions": {},
    "@/lib/context-watched-state": { useContextWatchedState: () => ({ status: "unknown" }) },
    "@/lib/providers/tmdb": { useTmdbImdbId: empty },
    "@/lib/media-favorites": { useIsFavorite: () => false },
    "@/lib/title-backdrop": {},
    "./context-menu/my-list-submenu": { MyListSubmenu: childrenOnly },
    "./context-menu/use-manual-download": {
      useManualDownload: () => ({
        beginManualDownload: (...args: unknown[]) => prepared.push(args),
        manualDownloadDialog: null,
      }),
    },
    "./context-menu/last-playback-command": {
      LastPlaybackCommand: ({
        children,
        enabled,
        variant,
      }: {
        children: (action: actions.ContextAction | null) => React.ReactNode;
        enabled: boolean;
        variant?: string;
      }) =>
        children(
          presentation && enabled
            ? {
                ...last,
                label: variant === "quick" ? "Resume last" : last.label,
              }
            : null,
        ),
    },
    "./context-menu/player-actions": {},
    "./context-menu/menu-brand-footer": { MenuBrandFooter: empty },
    "@/lib/context-content": content,
    "@/lib/profiles": { useProfiles: () => ({ activeProfile: { id: "same-profile" } }) },
    "@/lib/theme-auth": {
      currentAuthor: () => author,
      subscribeAuthor: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    "./context-menu/menu-surface": {
      MenuSurface: presentation
        ? ({
            children,
            quickActions,
          }: {
            children?: React.ReactNode;
            quickActions?: React.ReactNode;
          }) =>
            React.createElement(
              "section",
              { "data-test-menu": true },
              React.createElement("header", { "data-test-quick": true }, quickActions),
              React.createElement("main", { "data-test-rows": true }, children),
            )
        : childrenOnly,
      useMenuExecution: empty,
      menuItemClass: "menu-item",
    },
    "./context-menu/action-items": {
      ActionItems: presentation ? rows : empty,
      QuickActions: presentation ? rows : empty,
      MenuIcon: empty,
    },
    "./context-menu/content-actions": { contentActions: () => [] },
    "./context-image-viewer": { ContextImageViewer: empty },
    "@/lib/social/external-link-policy": {},
    "@/chrome/context-page-navigation": {
      usePageContextTarget: () =>
        presentation
          ? {
              kind: "actions",
              id: pageShare ? "page:person:12" : "page:home",
              scope: "page-background",
              label: "Page actions",
              actions: () => navigation,
            }
          : null,
    },
    "@/lib/context-page-background": background,
  };
  deps["./content-actions"] = { copyContextText: async () => {} };
  const cache = new Map<string, any>();
  const load = (file: string): any => {
    if (cache.has(file)) return cache.get(file);
    const output = ts.transpileModule(
      readFileSync(new URL(`../${file}`, import.meta.url), "utf8"),
      {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
        },
      },
    ).outputText;
    const module = { exports: {} };
    new Function("require", "module", "exports", output)(
      (name: string) => {
        assert.ok(name in deps, `Unexpected dependency: ${name}`);
        return deps[name];
      },
      module,
      module.exports,
    );
    cache.set(file, module.exports);
    return module.exports;
  };
  if (presentation)
    deps["./context-menu/player-actions"] = load("src/components/context-menu/player-actions.tsx");
  let detailsPage: any;
  if (ebookDetails) {
    Object.assign(deps, {
      "@/components/ui-icon": { UiIcon: empty },
      "@/components/parental-pin-modal": { ParentalPinModal: empty },
      "@/lib/app-reload": { reloadAppWindow: empty },
      "@/lib/parental": { useParental: () => ({ locked: false, hiddenTabs: {} }) },
      "@/lib/profiles": {
        useProfiles: () => ({ activeProfile: { id: "same-profile" } }),
        useActiveKid: empty,
      },
      "@/lib/settings": {
        useSettings: () => ({
          settings: {
            theme: { preset: "fixture" },
            navCustomization: { order: [], hidden: [], renamed: {} },
            hideContent: {},
            showPlaylistsTab: true,
          },
          update: empty,
        }),
      },
      "@/lib/social/open-my-profile": { openMyProfile: empty },
      "@/lib/social/open-profile": { canOpenProfile: () => true },
      "@/lib/social/action-actor": { captureSocialActor: empty, assertSocialActor: empty },
      "@/lib/theme": { activeLayout: () => "sidebar", getThemeById: empty },
      "@/lib/theme-preview": {
        usePreviewNavCustomization: (value: unknown) => value,
        useThemePreview: empty,
      },
      "@/lib/app-back": back,
      "./context-navigation-icon": { ContextNavigationIcon: empty },
      "./nav-items": {
        useAvailableNavItems: () => [{ id: "home", view: "home", label: "Home" }],
      },
      "./navigation-policy": navigationPolicy,
    });
    detailsPage = load("src/chrome/context-page-navigation.tsx");
    deps["@/chrome/context-page-navigation"] = detailsPage;
  }
  const { ContextMenu } = load("src/components/context-menu.tsx");
  function EbookDetailsBackground() {
    const onContextMenu = detailsPage.usePageBackgroundContextMenu();
    return React.createElement("main", {
      id: "ebook-details",
      "data-ebook-page": true,
      onContextMenu,
    });
  }
  function Observe() {
    state = menu.useContextMenu();
    return null;
  }
  const root = createRoot(document.getElementById("root")!);
  await React.act(async () => {
    root.render(
      React.createElement(
        menu.ContextMenuProvider,
        null,
        React.createElement(Observe),
        React.createElement(ContextMenu),
        ebookDetails && React.createElement(EbookDetailsBackground),
      ),
    );
  });
  return {
    prepared,
    openTarget: async (target: menu.ContextMenuTarget) =>
      React.act(async () => state.openAt({ x: 30, y: 30 }, target)),
    navigation,
    player,
    get state() {
      return state.state;
    },
    completeSession: async (session: number) => React.act(async () => state.completeClose(session)),
    open: async () =>
      React.act(async () => {
        state.openAt(
          { x: 30, y: 30 },
          { kind: "meta", meta: { id: "fixture-series", type: "series", name: "Fixture series" } },
        );
      }),
    updateAuthor: async (patch: Partial<typeof author>) =>
      React.act(async () => {
        author = { ...author, ...patch };
        listeners.forEach((listener) => listener());
      }),
    updateStremio: async () =>
      React.act(async () => {
        user = { _id: "stremio-two" };
        listeners.forEach((listener) => listener());
      }),
    finishClose: async () => React.act(async () => state.completeClose(state.state!.session)),
    close: async () => {
      await React.act(async () => root.unmount());
      dom.window.close();
    },
  };
}

test("global menu scope ignores author display updates but invalidates a new ID with the same profile and handle", async () => {
  const h = await fixture();
  try {
    await h.open();
    await h.updateAuthor({ alias: "Changed alias" });
    assert.equal(h.state?.phase, "open");
    await h.updateAuthor({ id: "actor-two" });
    assert.equal(h.state?.phase, "closing", "an author ID change must invalidate title actions");
  } finally {
    await h.close();
  }
});

test("replacement title menus reject an earlier exit completion and retain one preparation-only download command", async () => {
  const h = await fixture();
  try {
    await h.open();
    const oldSession = h.state!.session;
    assert.doesNotMatch(
      document.body.textContent ?? "",
      /Download now|Auto-download|Disable auto-download/,
    );
    assert.match(document.body.textContent ?? "", /View details/);
    assert.equal(
      [...document.querySelectorAll("button")].filter((button) => button.textContent === "Download")
        .length,
      1,
    );
    assert.equal(h.prepared.length, 0, "opening the root does not prepare or download");
    await h.updateAuthor({ id: "actor-two" });
    await h.open();
    const newSession = h.state!.session;
    assert.notEqual(newSession, oldSession);
    await h.completeSession(oldSession);
    assert.equal(h.state?.session, newSession);
    assert.equal(h.state?.phase, "open");
  } finally {
    await h.close();
  }
});

test("changing the Stremio account invalidates a still-open menu in the same local profile", async () => {
  const h = await fixture();
  try {
    await h.open();
    await h.updateStremio();
    assert.equal(h.state?.phase, "closing");
  } finally {
    await h.close();
  }
});

test("non-player root menus place global last playback once above contextual rows, outside the strip", async () => {
  const h = await fixture({ presentation: true });
  try {
    const targets: menu.ContextMenuTarget[] = [
      { kind: "meta", meta: { id: "b", name: "Poster B", type: "movie" } },
      {
        kind: "actions",
        id: "comment:b",
        label: "Comment B",
        actions: () => [{ id: "comment:reply", label: "Reply", run() {} }],
      },
      {
        kind: "actions",
        id: "page:profile",
        scope: "page-background",
        label: "Profile background",
        actions: () => h.navigation,
      },
      {
        kind: "meta",
        meta: { id: "b", name: "Continue B", type: "series" },
        primary: {
          actions: () => [
            { id: "continue:b", label: "Continue watching", run() {} },
            { id: "remove:b", label: "Remove from Continue Watching", run() {} },
          ],
        },
      },
    ];
    for (const target of targets) {
      await h.openTarget(target);
      const last = document.querySelectorAll('[data-context-action="playback:last:a"]');
      assert.equal(last.length, 1);
      assert.equal(last[0].textContent, "Continue last watched");
      assert.ok(last[0].closest("[data-test-rows]"));
      assert.equal(last[0].closest("[data-test-quick]"), null);
      assert.equal(document.querySelector("[data-test-rows] [data-context-action]"), last[0]);
      assert.equal(document.querySelectorAll('[data-context-action="page:my-profile"]').length, 1);
      assert.equal(document.querySelectorAll('[data-context-action="page:go-to"]').length, 1);
      assert.equal(document.querySelectorAll('[data-context-action="page:refresh"]').length, 1);
    }
    assert.ok(document.querySelector('[data-context-action="continue:b"]'));
    assert.ok(document.querySelector('[data-context-action="remove:b"]'));
  } finally {
    await h.close();
  }
});

test("player menu excludes browsing navigation and global last playback while retaining its tools", async () => {
  const h = await fixture({ presentation: true });
  try {
    const target: menu.ContextMenuTarget = { kind: "meta", player: true, meta: h.player.src.meta };
    for (const magnet of [null, "magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567"]) {
      h.player.magnetUrl = magnet;
      await h.openTarget(target);
      for (const id of [
        "page:my-profile",
        "page:go-to",
        "page:refresh",
        "page:back",
        "playback:last:a",
      ])
        assert.equal(!!document.querySelector(`[data-context-action='${id}']`), false, id);
      const quick = [...document.querySelectorAll("[data-test-quick] [data-context-action]")].map(
        (node) => node.getAttribute("data-context-action"),
      );
      assert.deepEqual(
        quick,
        magnet ? ["player:copy-magnet", "player:settings"] : ["player:settings"],
      );
      for (const id of [
        "player:fullscreen",
        "player:download-video",
        "player:download-subtitle",
        "player:live-sync",
        "player:copy-stream",
      ])
        assert.ok(document.querySelector(`[data-context-action='${id}']`), id);
    }
  } finally {
    await h.close();
  }
});

test("page sharing stays behind native editing, registered cards and clicked content", async () => {
  const h = await fixture({ presentation: true, pageShare: true });
  const main = document.createElement("main");
  main.innerHTML = `<input id="field"><button id="card"><span>Registered card</span></button>
    <img id="image" src="https://fixture.invalid/person.jpg" alt="Person">
    <a id="link" href="https://fixture.invalid/source">Source</a><button id="plain">Plain</button>`;
  document.getElementById("root")!.append(main);
  const unregister = menu.registerContextTarget(main.querySelector("#card")!, () => ({
    kind: "actions",
    id: "card:12",
    label: "Registered card",
    actions: () => [{ id: "card:open", label: "Open card", run() {} }],
  }));
  const summon = async (element: Element) => {
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    await React.act(() => element.dispatchEvent(event));
    return event;
  };
  try {
    await summon(main);
    assert.equal(h.state?.target.kind, "actions");
    assert.ok(document.querySelector('[data-context-action="page:share:person:12"]'));
    for (const [selector, kind] of [
      ["#card span", "actions"],
      ["#image", "content"],
      ["#link", "content"],
    ]) {
      await summon(main.querySelector(selector)!);
      assert.equal(h.state?.target.kind, kind);
      assert.equal(document.querySelector('[data-context-action="page:share:person:12"]'), null);
      assert.ok(document.querySelector('[data-context-action="page:go-to"]'));
      assert.ok(document.querySelector('[data-context-action="page:refresh"]'));
    }
    const fieldEvent = await summon(main.querySelector("#field")!);
    assert.equal(fieldEvent.defaultPrevented, false, "editing keeps its native context menu");
    assert.equal(h.state?.phase, "closing");
    await h.finishClose();
    await summon(main.querySelector("#plain")!);
    assert.equal(h.state, null, "an unregistered control is not ambient page background");
  } finally {
    unregister();
    main.remove();
    await h.close();
  }
});

test("the explicit eBook details background shares without changing reader or descendant menus", async () => {
  const h = await fixture({ presentation: true, ebookDetails: true });
  const main = document.getElementById("ebook-details")!;
  main.innerHTML = `<input id="field"><button id="card"><span>Registered card</span></button>
    <img id="image" src="https://fixture.invalid/book.jpg" alt="Book">
    <a id="link" href="https://fixture.invalid/source">Source</a>
    <section id="reader" data-ebook-page><div id="reader-text">Reader text</div></section>`;
  const unregister = menu.registerContextTarget(main.querySelector("#card")!, () => ({
    kind: "actions",
    id: "card:book-12",
    label: "Registered book",
    actions: () => [{ id: "book:open", label: "Open book", run() {} }],
  }));
  const summon = async (element: Element) => {
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    await React.act(() => element.dispatchEvent(event));
    return event;
  };
  const shareSelector = '[data-context-action="page:share:ebook:book-12"]';
  try {
    await summon(main);
    assert.equal(h.state?.target.kind, "actions");
    assert.ok(document.querySelector(shareSelector));
    assert.ok(document.querySelector('[data-context-action="page:go-to"]'));
    for (const [selector, kind] of [
      ["#card span", "actions"],
      ["#image", "content"],
      ["#link", "content"],
    ]) {
      await summon(main.querySelector(selector)!);
      assert.equal(h.state?.target.kind, kind);
      assert.equal(document.querySelector(shareSelector), null);
    }
    const fieldEvent = await summon(main.querySelector("#field")!);
    assert.equal(fieldEvent.defaultPrevented, false);
    await h.finishClose();
    await summon(main.querySelector("#reader")!);
    assert.equal(h.state, null);
    await summon(main.querySelector("#reader-text")!);
    assert.equal(h.state, null, "reader descendants cannot inherit details-page sharing");
  } finally {
    unregister();
    await h.close();
  }
});
