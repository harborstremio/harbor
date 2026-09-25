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
import { executeContextAction } from "../src/lib/context-actions.ts";
import * as domain from "../src/lib/manga-context-actions.ts";
import * as chapterIdentity from "../src/lib/manga/chapter-identity.ts";

function load(file: string, dependencies: Record<string, unknown>): any {
  const code = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(
    (name: string) => {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    module,
    module.exports,
  );
  return module.exports;
}

const entry = (id = "alpha::one", chapterId = "alpha::chapter-three") => ({
  id,
  chapterId,
  title: "Shared title",
  chapterNumber: "3",
  chapterLabel: "Chapter 3",
  sourceId: "alpha",
  page: 7,
  totalPages: 23,
  scroll: 0.4,
  updatedAt: 100,
});

test("manga resume keeps exact manga and provider identities and prefers the saved chapter", () => {
  const saved = entry();
  assert.equal(domain.mangaContextProgress([saved], "beta::one"), undefined);
  assert.equal(domain.mangaContextProgress([{ ...saved, page: NaN }], saved.id), undefined);
  assert.equal(domain.mangaContextProgress([entry("one")], "one", "beta"), undefined);
  assert.equal(domain.mangaContextProgress([saved], saved.id), saved);
  const raw = entry("one");
  assert.equal(domain.mangaContextProgress([raw], "alpha::one", "alpha"), raw);
  const chapters = [
    { id: "beta::chapter-three", chapter: "3" },
    { id: saved.chapterId, chapter: "3" },
    { id: "alpha::chapter-latest", chapter: "400" },
  ];
  assert.equal(domain.mangaResumeChapterIndex(chapters, saved), 1);
  assert.equal(domain.mangaResumeChapterIndex([chapters[0]], saved), -1);
  assert.equal(domain.mangaResumeChapterIndex([{ id: "chapter-three", chapter: "3" }], saved), 0);
  assert.equal(
    domain.mangaResumeChapterIndex([{ id: "chapter-three", chapter: "3" }], {
      ...saved,
      sourceId: "beta",
    }),
    -1,
  );
});

test("catalog-only, removed and local sources never become an invented remote provider", () => {
  const sources = [
    { id: "alpha", name: "A", kind: "suwayomi", baseUrl: "https://a.invalid", builtin: false },
    { id: "local", name: "Local", kind: "local", baseUrl: "/fixture", builtin: false },
  ] as any;
  assert.equal(domain.mangaContextSource("anilist:42", sources, "alpha"), undefined);
  assert.equal(domain.mangaContextSource("missing::one", sources, "alpha"), undefined);
  assert.equal(domain.mangaContextSource("one", sources, "all"), undefined);
  assert.equal(domain.mangaContextSource("local::one", sources, "alpha")?.kind, "local");
});

test("canonical favorites resume a saved raw oneshot chapter only from its recorded source", () => {
  const saved = { ...entry("alpha::one", "oneshot"), chapterNumber: null };
  const chapters = [{ id: "alpha::oneshot", chapter: null }];
  assert.equal(domain.mangaResumeChapterIndex(chapters, saved), 0);
  assert.equal(domain.mangaResumeChapterIndex(chapters, { ...saved, sourceId: "beta" }), -1);
  assert.equal(domain.mangaResumeChapterIndex(chapters, { ...saved, sourceId: undefined }), -1);
});

test("official chapter label normalization remains limited to the saved provider", () => {
  const saved = { ...entry(), chapterId: "alpha::old-release", chapterNumber: "Vol. 2 Ch. 03,5" };
  const chapters = [
    { id: "beta::release", chapter: "3.5" },
    { id: "alpha::release", chapter: "Chapter 03.50" },
  ];
  assert.equal(domain.mangaResumeChapterIndex(chapters, saved), 1);
  assert.equal(domain.mangaResumeChapterIndex([chapters[0]], saved), -1);
});

async function fixture() {
  const dom = new JSDOM("<!doctype html><div id='root'></div>", { url: "https://fixture.invalid" });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    localStorage: dom.window.localStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  (window as any).__TAURI_INTERNALS__ = {};
  let profile = "one";
  let activeSource = "alpha";
  let storageOk = true;
  let sources = [
    { id: "alpha", name: "A", kind: "suwayomi", baseUrl: "https://a.invalid", builtin: false },
    { id: "beta", name: "B", kind: "html", baseUrl: "https://b.invalid", builtin: false },
    { id: "local", name: "Local", kind: "local", baseUrl: "/fixture", builtin: false },
  ];
  const profiles = { useProfiles: () => ({ activeId: profile }) };
  const sourceModule = {
    activeMangaSourceId: () => activeSource,
    listMangaSources: () => sources,
    setActiveMangaSource: (value: string) => {
      activeSource = value;
    },
  };
  const remoteWrites: unknown[][] = [];
  const favorites = load("src/lib/manga-favorites.tsx", {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "./profiles": profiles,
    "./storage-recovery": {
      setItemWithRecovery: (key: string, value: string) => {
        if (storageOk) localStorage.setItem(key, value);
        return storageOk;
      },
    },
    "./manga/api": {
      setMangaInLibrary: async (...args: unknown[]) => {
        remoteWrites.push(args);
        return true;
      },
    },
    "./manga/library-events": { notifyMangaLibraryChanged: () => {} },
    "./manga/sources": sourceModule,
  });
  const resumed: any[] = [];
  const downloads: string[] = [];
  const opened: string[] = [];
  const hook = load("src/lib/use-manga-context.tsx", {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "lucide-react": lucide,
    "@/components/ui-icon": { UiIcon: () => null },
    "./context-menu": menu,
    "./i18n": { useT: () => (key: string) => key },
    "./profiles": profiles,
    "./manga-favorites": favorites,
    "./manga-progress": {
      listMangaProgress: (pid: string) =>
        JSON.parse(localStorage.getItem(`harbor.mangaread.v1.${pid}`) ?? "[]"),
    },
    "./manga/sources": sourceModule,
    "./manga-context-actions": domain,
    "./manga/read-intent": {
      setMangaReadIntent: (item: unknown) => resumed.push(item),
      requestMangaChapterRead: (mangaId: string, chapterId: string) =>
        resumed.push({ mangaId, chapterId }),
    },
    "./manga/api": {
      resumeChapters: async (id: string) => [{ id: `${id.split("::")[0]}::first`, chapter: "1" }],
    },
    "./manga/chapter-identity": chapterIdentity,
    "./view": { useView: () => ({ openManga: (id: string) => opened.push(id) }) },
  });
  const cards = [
    { id: "alpha::one", title: "Shared title" },
    { id: "beta::one", title: "Shared title" },
    { id: "local::book", title: "Local book" },
    { id: "raw", title: "Saved source", sourceId: "alpha" },
    { id: "legacy", title: "Unknown source", sourceId: "" },
  ];
  let lastStore: any;
  function Card({ manga }: { manga: (typeof cards)[number] }) {
    const context = hook.useMangaContext(manga, { open: () => opened.push(manga.id) });
    lastStore = favorites.useMangaFavorites();
    return React.createElement("button", { ref: context.ref, "data-id": manga.id }, manga.title);
  }
  const root = createRoot(document.getElementById("root")!);
  async function render() {
    await React.act(async () =>
      root.render(
        React.createElement(
          favorites.MangaFavoritesProvider,
          null,
          React.createElement(
            hook.MangaContextNavigation.Provider,
            {
              value: {
                resume: (item: unknown) => {
                  resumed.push(item);
                },
                download: (id: string) => downloads.push(id),
              },
            },
            cards.map((manga) => React.createElement(Card, { key: manga.id, manga })),
          ),
        ),
      ),
    );
  }
  await render();
  const target = (id: string) =>
    menu.registeredContextTarget(document.querySelector(`[data-id='${id}']`)) as any;
  return {
    dom,
    target,
    resumed,
    downloads,
    opened,
    remoteWrites,
    render,
    store: () => lastStore,
    failStorage: () => {
      storageOk = false;
    },
    setProfile: async (value: string) => {
      profile = value;
      await render();
    },
    setSource: (value: string) => {
      activeSource = value;
    },
    setCardSource: async (id: string, sourceId: string) => {
      const index = cards.findIndex((card) => card.id === id);
      cards[index] = { ...cards[index], sourceId };
      await render();
    },
    removeSources: () => {
      sources = [];
    },
    close: async () => {
      await React.act(async () => root.unmount());
      dom.window.close();
    },
  };
}

test("registered manga actions persist favorites, read only that manga's progress and invalidate after profile changes", async () => {
  const f = await fixture();
  try {
    localStorage.setItem("harbor.mangaread.v1.one", JSON.stringify([entry()]));
    const a = f.target("alpha::one"),
      b = f.target("beta::one");
    assert.ok(a.actions().find((action: any) => action.id === "manga:resume:alpha::one"));
    assert.ok(!b.actions().some((action: any) => action.id.startsWith("manga:resume:")));
    await React.act(async () => {
      await executeContextAction(a, "manga:favorite:alpha::one");
    });
    assert.equal(JSON.parse(localStorage.getItem("harbor.mangafav.v1.one")!)[0].id, "alpha::one");
    assert.equal(
      a.actions().find((action: any) => action.id.startsWith("manga:favorite:")).label,
      "Remove from favorites",
    );
    assert.equal(
      b.actions().find((action: any) => action.id.startsWith("manga:favorite:")).label,
      "Add to favorites",
    );
    assert.deepEqual(f.remoteWrites[0], ["alpha::one", true, "alpha", "https://a.invalid"]);
    await executeContextAction(a, "manga:resume:alpha::one");
    assert.deepEqual(f.resumed, [entry()]);
    await executeContextAction(b, "manga:download:beta::one");
    assert.deepEqual(f.downloads, ["beta::one"]);
    assert.ok(
      !f
        .target("local::book")
        .actions()
        .some((action: any) => action.id.startsWith("manga:download:")),
    );
    const staleStore = f.store();
    await f.setProfile("two");
    assert.equal(a.isValid(), false);
    await assert.rejects(
      executeContextAction(a, "manga:favorite:alpha::one"),
      /no longer available/,
    );
    assert.equal(staleStore.toggle({ id: "alpha::one" }), false);
    assert.equal(localStorage.getItem("harbor.mangafav.v1.two"), null);
    assert.equal(
      f
        .target("alpha::one")
        .actions()
        .find((action: any) => action.id.startsWith("manga:favorite:")).checked,
      false,
    );
    f.removeSources();
    assert.ok(
      !f
        .target("alpha::one")
        .actions()
        .some((action: any) => action.id.startsWith("manga:download:")),
    );
  } finally {
    await f.close();
  }
});

test("a favorite persistence failure is reported instead of menu success", async () => {
  const f = await fixture();
  try {
    f.failStorage();
    await React.act(async () => {
      await assert.rejects(
        executeContextAction(f.target("alpha::one"), "manga:favorite:alpha::one"),
        /Could not save the change/,
      );
    });
    assert.equal(localStorage.getItem("harbor.mangafav.v1.one"), null);
    assert.equal(f.store().has("alpha::one"), false);
    assert.deepEqual(f.remoteWrites, []);
  } finally {
    await f.close();
  }
});

test("official start-reading action requests the owning provider and carries manga list metadata", async () => {
  const f = await fixture();
  try {
    f.setSource("beta");
    const target = f.target("raw");
    assert.deepEqual(target.manga, { id: "alpha::raw", title: "Saved source", cover: undefined });
    await executeContextAction(target, "manga:start:raw");
    assert.deepEqual(f.resumed, [{ mangaId: "alpha::raw", chapterId: "alpha::first" }]);
    assert.deepEqual(f.opened, ["alpha::raw"]);
    assert.ok(
      !f
        .target("legacy")
        .actions()
        .some((action: any) => action.id.startsWith("manga:start:")),
    );
  } finally {
    await f.close();
  }
});

test("an open menu cannot retarget a reused raw-ID card to another source", async () => {
  const f = await fixture();
  try {
    const original = f.target("raw");
    await f.setCardSource("raw", "beta");
    assert.equal(original.isValid(), false);
    await assert.rejects(
      executeContextAction(original, "manga:favorite:raw"),
      /no longer available/,
    );
    assert.deepEqual(f.remoteWrites, []);
  } finally {
    await f.close();
  }
});

test("saved raw progress uses its own source when another provider is selected", async () => {
  const f = await fixture();
  try {
    localStorage.setItem(
      "harbor.mangaread.v1.one",
      JSON.stringify([entry("raw", "chapter-three")]),
    );
    f.setSource("beta");
    const saved = f.target("raw");
    assert.equal(saved.isValid(), true);
    await executeContextAction(saved, "manga:resume:raw");
    assert.equal(f.resumed[0].sourceId, "alpha");
    await React.act(async () => {
      await executeContextAction(saved, "manga:favorite:raw");
    });
    assert.deepEqual(f.remoteWrites, [["raw", true, "alpha", "https://a.invalid"]]);
    assert.equal(JSON.parse(localStorage.getItem("harbor.mangafav.v1.one")!)[0].sourceId, "alpha");
    await executeContextAction(saved, "manga:download:raw");
    assert.deepEqual(f.downloads, ["raw"]);
    assert.ok(
      !f
        .target("legacy")
        .actions()
        .some((action: any) => /manga:(download|resume):/.test(action.id)),
    );
  } finally {
    await f.close();
  }
});

test("favorites with the same raw ID on two providers remain independent in the existing store", async () => {
  const f = await fixture();
  try {
    await React.act(async () => {
      assert.equal(f.store().toggle({ id: "shared", title: "A", sourceId: "alpha" }), true);
      assert.equal(f.store().toggle({ id: "shared", title: "B", sourceId: "beta" }), true);
    });
    assert.equal(f.store().has("shared", "alpha"), true);
    assert.equal(f.store().has("shared", "beta"), true);
    assert.deepEqual(
      JSON.parse(localStorage.getItem("harbor.mangafav.v1.one")!).map((item: any) => item.id),
      ["alpha::shared", "beta::shared"],
    );
    await React.act(async () => {
      assert.equal(f.store().toggle({ id: "shared", sourceId: "alpha" }), true);
    });
    assert.equal(f.store().has("shared", "alpha"), false);
    assert.equal(f.store().has("shared", "beta"), true);
    await f.setProfile("two");
    localStorage.setItem(
      "harbor.mangafav.v1.one",
      JSON.stringify([
        { id: "legacy-bound", title: "A", sourceId: "alpha", addedAt: 0 },
        { id: "legacy-unknown", title: "Unknown", addedAt: 0 },
      ]),
    );
    await f.setProfile("one");
    assert.equal(f.store().has("legacy-bound", "alpha"), true);
    assert.equal(f.store().has("legacy-bound", "beta"), false);
    assert.equal(f.store().has("legacy-unknown", "alpha"), false);
    assert.equal(f.store().has("legacy-unknown", ""), true);
  } finally {
    await f.close();
  }
});

test("existing chapter downloader keeps provider headers, rejects unsupported pages and does not claim unsaved offline files", async () => {
  const dom = new JSDOM("", { url: "https://fixture.invalid" });
  Object.assign(globalThis, { window: dom.window, localStorage: dom.window.localStorage });
  let urls = ["https://provider.invalid/page1.jpg", "https://provider.invalid/page2.jpg"];
  const fetched: any[] = [],
    written: string[] = [];
  const api = load("src/lib/manga-downloads.ts", {
    react: React,
    "@/lib/manga/api": { chapterPages: async () => urls },
    "@/lib/manga/sources/suwayomi/auth-registry": { isSuwayomiServerUrl: () => false },
    "./manga/plugins/adapter": {
      pageHeadersFor: () => ({ Referer: "https://provider.invalid/reader" }),
    },
    "@tauri-apps/api/path": {
      join: async (...parts: string[]) => parts.join("/"),
      appDataDir: async () => "/fixture",
    },
    "@tauri-apps/plugin-fs": {
      mkdir: async () => {},
      writeFile: async (path: string) => {
        written.push(path);
      },
    },
    "@tauri-apps/plugin-http": {
      fetch: async (...args: unknown[]) => {
        fetched.push(args);
        return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2]).buffer };
      },
    },
  });
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.equal(
      await api.downloadChapter("alpha::one", "alpha::chapter-1", { title: "One", chapter: "1" }),
      true,
    );
    assert.equal(fetched[0][1].headers.Referer, "https://provider.invalid/reader");
    assert.equal(written.length, 2);
    assert.equal(api.mangaDownloadStatus("alpha::chapter-1").status, "done");
    urls = ["https://provider.invalid/page1.jpg", "blob:unsupported"];
    assert.equal(await api.downloadChapter("local::one", "local::chapter-1"), false);
    assert.equal(
      written.length,
      2,
      "unsupported mixed pages must not yield a partial successful chapter",
    );
    urls = ["https://provider.invalid/page1.jpg"];
    const originalSetItem = dom.window.Storage.prototype.setItem;
    dom.window.Storage.prototype.setItem = function (key: string, value: string) {
      if (key === "harbor.manga.downloads.v1") throw new Error("fixture quota");
      return originalSetItem.call(this, key, value);
    };
    assert.equal(await api.downloadChapter("alpha::one", "alpha::chapter-2"), false);
    assert.equal(api.mangaDownloadStatus("alpha::chapter-2").status, "error");
    assert.equal(
      JSON.parse(localStorage.getItem("harbor.manga.downloads.v1")!)["alpha::chapter-2"],
      undefined,
    );
  } finally {
    console.error = originalError;
    dom.window.close();
  }
});

test("chapter contexts download only the selected chapter and preserve server/local offline boundaries", async () => {
  const dom = new JSDOM("<!doctype html><div id='root'></div>", { url: "https://fixture.invalid" });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  (window as any).__TAURI_INTERNALS__ = {};
  let profile = "one",
    success = true;
  const downloads: unknown[][] = [];
  const read: string[] = [];
  const states = new Map<string, string>();
  const bookmarks: any[] = [];
  const readChapters = new Set<string>();
  const hook = load("src/lib/use-manga-chapter-context.tsx", {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "lucide-react": lucide,
    "./context-menu": menu,
    "./profiles": { useProfiles: () => ({ activeId: profile }) },
    "./i18n": { useT: () => (key: string) => key },
    "./manga-context-actions": domain,
    "./manga-bookmarks": {
      listMangaBookmarks: () => bookmarks,
      addMangaBookmark: (_pid: string, item: any) => bookmarks.push({ ...item, id: "bookmark" }),
      removeMangaBookmark: () => bookmarks.splice(0),
    },
    "./manga-progress": {
      listReadMangaChapters: () => [...readChapters],
      recordMangaChapterRead: (_pid: string, _mangaId: string, chapterId: string) =>
        readChapters.add(chapterId),
      removeMangaChapterRead: (_pid: string, _mangaId: string, chapterId: string) =>
        readChapters.delete(chapterId),
    },
    "./manga/sources": {
      activeMangaSourceId: () => "remote",
      listMangaSources: () => [
        { id: "remote", kind: "suwayomi", baseUrl: "https://fixture.invalid" },
        { id: "local", kind: "local", baseUrl: "/fixture" },
      ],
    },
    "./manga-downloads": {
      mangaDownloadStatus: (id: string) => ({ status: states.get(id) ?? "idle" }),
      downloadChapter: async (...args: unknown[]) => {
        downloads.push(args);
        return success;
      },
    },
  });
  function Chapter({ id, serverDownloaded = false }: { id: string; serverDownloaded?: boolean }) {
    const ref = hook.useMangaChapterContext(
      { id: "remote::manga", title: "One" },
      {
        id,
        chapter: "3",
        language: "en",
        pages: 10,
        downloaded: serverDownloaded,
      },
      () => {
        read.push(id);
      },
    );
    return React.createElement("button", { ref, "data-chapter": id }, id);
  }
  const root = createRoot(document.getElementById("root")!);
  const render = () =>
    React.act(async () =>
      root.render(
        React.createElement(
          React.Fragment,
          null,
          React.createElement(Chapter, { id: "remote::one" }),
          React.createElement(Chapter, { id: "remote::two" }),
          React.createElement(Chapter, { id: "remote::server", serverDownloaded: true }),
          React.createElement(Chapter, { id: "local::one" }),
        ),
      ),
    );
  const target = (id: string) =>
    menu.registeredContextTarget(document.querySelector(`[data-chapter='${id}']`)) as any;
  try {
    await render();
    await executeContextAction(target("remote::two"), "manga:download-chapter:remote::two");
    assert.deepEqual(downloads, [
      ["remote::manga", "remote::two", { title: "One", cover: undefined, chapter: "3" }],
    ]);
    const downloadAction = (id: string) =>
      target(id)
        .actions()
        .find((action: any) => action.id.startsWith("manga:download-chapter:"));
    assert.equal(downloadAction("remote::server").label, "Saved on your server");
    assert.equal(downloadAction("remote::server").disabled, true);
    assert.equal(downloadAction("local::one"), undefined);
    await executeContextAction(target("remote::two"), "manga:bookmark:remote::two");
    assert.equal(bookmarks[0].chapterId, "remote::two");
    assert.equal(bookmarks[0].sourceId, "remote");
    await executeContextAction(target("remote::two"), "manga:read-flag:remote::two");
    assert.deepEqual([...readChapters], ["remote::two"]);
    await executeContextAction(target("remote::two"), "manga:read-flag:remote::two");
    assert.equal(readChapters.size, 0);
    await executeContextAction(target("remote::two"), "manga:bookmark:remote::two");
    assert.equal(bookmarks.length, 0);
    states.set("remote::one", "done");
    assert.equal(downloadAction("remote::one").label, "Downloaded");
    assert.equal(downloadAction("remote::one").disabled, true);
    success = false;
    await assert.rejects(
      executeContextAction(target("remote::two"), "manga:download-chapter:remote::two"),
      /Manga download failed/,
    );
    const stale = target("remote::two");
    profile = "two";
    await render();
    await assert.rejects(
      executeContextAction(stale, "manga:download-chapter:remote::two"),
      /no longer available/,
    );
    assert.deepEqual(read, []);
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
  }
});
