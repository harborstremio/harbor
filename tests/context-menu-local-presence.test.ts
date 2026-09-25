import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { JSDOM } from "jsdom";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import * as icons from "lucide-react";
import { createRoot } from "react-dom/client";

function harness(presentation: "baseline" | "popout") {
  const dom = new JSDOM(
    "<!doctype html><body><button id='origin'>Origin</button><div id='app'></div>",
    {
      url: "http://localhost/",
    },
  );
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const origin = document.querySelector<HTMLButtonElement>("#origin")!;
  origin.getBoundingClientRect = () =>
    ({ left: 30, right: 80, top: 30, bottom: 60, width: 50, height: 30 }) as DOMRect;
  let surface: any;
  let source: any;
  const writes: unknown[] = [];
  const deps: Record<string, any> = {
    react: React,
    "react/jsx-runtime": jsx,
    "lucide-react": icons,
    "@/lib/i18n": { useT: () => (key: string) => key },
    "@/lib/manual-watched": {
      manualWatchedState: () => false,
      subscribeManualWatched: () => () => {},
    },
    "@/lib/hidden-episodes": {
      isEpisodeHidden: () => false,
      setEpisodeHidden: (...args: unknown[]) => writes.push(args),
    },
    "@/lib/settings": { useSettings: () => ({ settings: { episodeHiding: true } }) },
    "@/lib/profiles": { useProfiles: () => ({ activeId: "fixture" }) },
    "@/lib/resume": { clearResume() {}, readResumeEntry: () => null },
    "@/lib/providers/tmdb": { useTmdbImdbId: () => "tt-fixture" },
    "@/lib/media-context-actions": {
      setContextWatched: () => ({ outcomes: [] }),
      requireMediaActionSuccess() {},
    },
    "@/lib/membership-operations": { captureMembershipProfile: () => ({ activeId: "fixture" }) },
    "@/lib/membership-actions": { membershipFailureMessage: () => "Error" },
    "@/components/lists/list-toast": { emitListToast() {} },
    "@/lib/page-collection-rows": {
      COLLECTION_ROW_PAGES: [{ id: "home", label: "Home" }],
      usePagesForCollection: () => new Set(),
      setCollectionOnPageWithResult: (input: unknown) => {
        writes.push(input);
        return { status: "added" };
      },
    },
    "./menu-presentation": { contextMenuPresentation: presentation },
  };
  const surfaceModule = {
    MenuSurface: (props: any) => {
      surface = props;
      return jsx.jsx("div", { "data-test-menu": true, children: props.children });
    },
  };
  const actionModule = {
    ActionItems: (props: any) => {
      source = props.source;
      return null;
    },
  };
  const cache = new Map<string, any>();
  const load = (path: string): any => {
    if (cache.has(path)) return cache.get(path);
    const module = { exports: {} };
    const output = ts.transpileModule(
      readFileSync(new URL(`../${path}`, import.meta.url), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText;
    new Function("require", "module", "exports", output)(
      (name: string) => {
        if (name.endsWith("/menu-surface")) return surfaceModule;
        if (name.endsWith("/action-items")) return actionModule;
        if (name.endsWith("/use-local-menu-presence"))
          return load("src/components/context-menu/use-local-menu-presence.ts");
        if (name.endsWith("/menu-presentation")) return { contextMenuPresentation: presentation };
        assert.ok(name in deps, `Unexpected dependency ${name}`);
        return deps[name];
      },
      module,
      module.exports,
    );
    cache.set(path, module.exports);
    return module.exports;
  };
  const root = createRoot(document.querySelector("#app")!);
  return {
    root,
    origin,
    writes,
    load,
    get surface() {
      return surface;
    },
    get source() {
      return source;
    },
    async dispose() {
      await React.act(() => root.unmount());
      dom.window.close();
    },
  };
}

test("local episode dismissal disables its semantic source immediately and retains only its exit", async () => {
  const h = harness("popout");
  const { EpisodeWatchedMenu } = h.load("src/components/episode-watched-menu.tsx");
  let closed = 0;
  try {
    await React.act(() =>
      h.root.render(
        jsx.jsx(EpisodeWatchedMenu, {
          metaId: "title",
          meta: { name: "Title" },
          target: { x: 20, y: 20, season: 1, episode: 1, watched: false, origin: h.origin },
          onClose: () => closed++,
        }),
      ),
    );
    await React.act(() => h.surface.onClose(true));
    assert.equal(h.surface.phase, "closing");
    assert.equal(h.source.isValid(), false);
    assert.equal(document.activeElement, h.origin);
    assert.equal(closed, 0);
    const complete = h.surface.onExitComplete;
    await React.act(() => complete());
    await React.act(() => complete());
    assert.equal(closed, 1);
    assert.equal(document.querySelector("[data-test-menu]"), null);
  } finally {
    await h.dispose();
  }
});

test("a replacement episode rejects its old close and exit completion", async () => {
  const h = harness("popout");
  const { EpisodeWatchedMenu } = h.load("src/components/episode-watched-menu.tsx");
  let closed = 0;
  const render = (episode: number) =>
    h.root.render(
      jsx.jsx(EpisodeWatchedMenu, {
        metaId: "title",
        meta: { name: "Title" },
        target: { x: 20, y: 20, season: 1, episode, watched: false, origin: h.origin },
        onClose: () => closed++,
      }),
    );
  try {
    await React.act(() => render(1));
    const oldClose = h.surface.onClose;
    const oldSource = h.source;
    await React.act(() => oldClose(false));
    const oldComplete = h.surface.onExitComplete;
    await React.act(() => render(2));
    await React.act(() => {
      oldComplete();
      oldClose(false);
    });
    assert.equal(h.surface.phase, "open");
    assert.equal(h.source.isValid(), true);
    assert.equal(
      oldSource.isValid(),
      false,
      "old asynchronous actions cannot acquire the new target",
    );
    assert.equal(closed, 0);
  } finally {
    await h.dispose();
  }
});

test("an externally closed page destination retains its geometry, rejects writes, and cannot close a reopened target", async () => {
  const h = harness("popout");
  const { AddToPageMenu } = h.load("src/views/collections/add-to-page-menu.tsx");
  const anchorRef = { current: h.origin };
  let closed = 0;
  const render = (open: boolean, collectionId = "one") =>
    h.root.render(
      jsx.jsx(AddToPageMenu, { collectionId, anchorRef, open, onClose: () => closed++ }),
    );
  try {
    await React.act(() => render(true));
    const initial = h.surface.point;
    assert.equal(document.querySelector(".animate-popover-in"), null);
    await React.act(() => document.querySelector<HTMLButtonElement>("[role='menuitem']")!.click());
    assert.equal(h.writes.length, 1);
    await React.act(() => render(false));
    assert.equal(h.surface.phase, "closing");
    assert.deepEqual(h.surface.point, initial);
    await React.act(() => document.querySelector<HTMLButtonElement>("[role='menuitem']")!.click());
    assert.equal(h.writes.length, 1);
    const oldComplete = h.surface.onExitComplete;
    await React.act(() => render(true, "two"));
    await React.act(() => oldComplete());
    assert.equal(h.surface.phase, "open");
    assert.equal(closed, 0);
    await React.act(() => h.surface.onClose(true));
    assert.equal(closed, 0);
    assert.equal(document.activeElement, h.origin);
    await React.act(() => h.surface.onExitComplete());
    assert.equal(closed, 1);
  } finally {
    await h.dispose();
  }
});

test("baseline local menus keep immediate close and existing inner presentation", async () => {
  const h = harness("baseline");
  let closed = 0;
  const { EpisodeWatchedMenu } = h.load("src/components/episode-watched-menu.tsx");
  const { AddToPageMenu } = h.load("src/views/collections/add-to-page-menu.tsx");
  try {
    await React.act(() =>
      h.root.render(
        jsx.jsx(EpisodeWatchedMenu, {
          metaId: "title",
          meta: { name: "Title" },
          target: { x: 20, y: 20, season: 1, episode: 1, watched: false },
          onClose: () => closed++,
        }),
      ),
    );
    assert.equal(h.surface.phase, undefined);
    await React.act(() => h.surface.onClose(false));
    assert.equal(closed, 1);
    await React.act(() =>
      h.root.render(
        jsx.jsx(AddToPageMenu, {
          collectionId: "one",
          anchorRef: { current: h.origin },
          open: true,
          onClose() {},
        }),
      ),
    );
    assert.ok(document.querySelector(".animate-popover-in"));
    assert.equal(h.surface.phase, undefined);
    await React.act(() =>
      h.root.render(
        jsx.jsx(AddToPageMenu, {
          collectionId: "one",
          anchorRef: { current: h.origin },
          open: false,
          onClose() {},
        }),
      ),
    );
    assert.equal(document.querySelector("[data-test-menu]"), null);
  } finally {
    await h.dispose();
  }
});
