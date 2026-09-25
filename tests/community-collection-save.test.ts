import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import ts from "typescript";
import { JSDOM } from "jsdom";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import * as icons from "lucide-react";
import { createRoot } from "react-dom/client";
import * as contextMenu from "../src/lib/context-menu.tsx";
import * as membership from "../src/lib/membership-operations.ts";
import { executeContextAction } from "../src/lib/context-actions.ts";
import * as collectionAuthor from "../src/lib/collection-author.ts";

const endpoint = new URL("../src/lib/config/endpoints.ts", import.meta.url).href;
const hook = registerHooks({
  load(url, context, next) {
    return url === endpoint
      ? {
          format: "module-typescript",
          shortCircuit: true,
          source: `import.meta.env = {};\n${readFileSync(new URL(url), "utf8")}`,
        }
      : next(url, context);
  },
});
const collections = await import("../src/lib/collections.ts");
const membershipActions = await import("../src/lib/membership-actions.ts");
hook.deregister();

const source = {
  id: "fixture-public-collection",
  name: "Fixture collection",
  handle: "fixture-author",
  displayName: "Fixture Author",
  numbered: true,
  shared: true,
  coverImage: "https://fixture.invalid/cover.png",
  bgImage: "https://fixture.invalid/background.png",
  items: [{ id: "tt-fixture", type: "movie", name: "Fixture movie" }],
  createdAt: 1,
  updatedAt: 2,
};
const key = "harbor.collections.fixture-profile";
const initial = JSON.stringify([
  { id: "existing", name: "Existing fixture", items: [], custom: { preserved: true } },
]);
const unexpected = () => {
  throw new Error("Unexpected operation outside the isolated collection save");
};
const empty = () => null;

// Render the real hub, card target, detail page and save button. Only unrelated
// views and external boundaries are substituted; save, profile checks, action
// execution, collection state and localStorage serialization stay real.
function loadHub() {
  const { outputText } = ts.transpileModule(
    readFileSync(new URL("../src/views/collections/community-hub.tsx", import.meta.url), "utf8"),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  );
  const dependencies: Record<string, unknown> = {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "lucide-react": icons,
    "@/components/ui-icon": { UiIcon: empty },
    "@/lib/i18n": { useT: () => (text: string) => text },
    "@/lib/view": {
      useScrollMemory: empty,
      useView: () => ({ openMeta: unexpected, openManga: unexpected }),
    },
    "@/components/back-to-top": { BackToTop: empty },
    "@/components/poster": { posterPlate: () => "transparent" },
    "@/components/search/result-poster": { ResultPoster: empty },
    "@/components/together-modal/avatar": { Avatar: empty },
    "@/views/profile/user-hover-card": { UserHoverCard: ({ children }) => children },
    "@/lib/social/open-profile": { requestOpenProfile: unexpected, canOpenProfile: () => true },
    "@/lib/collection-author": collectionAuthor,
    "@/lib/collections": collections,
    "./community-share-button": { useCurrentHandle: () => "fixture-viewer" },
    "@/lib/social/collections-sync": {
      COMMUNITY_COLLECTIONS_EVENT: "fixture:collections-changed",
      fetchCommunityCollections: async () => [structuredClone(source)],
      collectionShareUrl: unexpected,
    },
    "@/lib/collection-publication": { deleteCollectionAcknowledged: unexpected },
    "./community-collection-card": { CommunityCollectionCard: empty },
    "./community-editor": { CommunityCollectionEditor: empty },
    "./community-collection-page": { CommunityCollectionPage: empty },
    "@/components/context-menu/meta-context-button": {
      MetaContextButton: ({ children }) => children,
    },
    "@/lib/context-menu": contextMenu,
    "@/lib/membership-operations": membership,
    "@/components/player/copy-link-button": { copyText: unexpected },
    "@/lib/membership-actions": membershipActions,
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    (name: string) => {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    module,
    module.exports,
  );
  return module.exports as typeof import("../src/views/collections/community-hub.tsx");
}

async function harness(persisted = initial) {
  const dom = new JSDOM("<!doctype html><div id='root'></div>", {
    url: "https://collection-fixture.invalid",
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: dom.window.localStorage,
  });
  localStorage.setItem(
    "harbor.profiles.v1",
    JSON.stringify({
      activeId: "fixture-profile",
      profiles: [{ id: "fixture-profile", settingsLinked: false }],
    }),
  );
  localStorage.setItem(key, persisted);
  const root = createRoot(document.getElementById("root")!);
  const { CommunityCollectionsView } = loadHub();
  await React.act(async () => {
    root.render(React.createElement(CommunityCollectionsView, { active: true }));
  });
  const card = [...document.querySelectorAll("button")].find(
    (node) => node.querySelector("h3")?.textContent === source.name,
  )!;
  assert.ok(card, "The real community card rendered from the fixture response");
  const target = contextMenu.registeredContextTarget(card)!;
  assert.equal(target.kind, "actions");
  if (target.kind !== "actions") throw new Error("Expected collection target");
  const saveId = `community-collection:save:${source.id}`;
  const openDetail = async () => {
    await React.act(() => card.click());
    const button = [...document.querySelectorAll("button")].find((node) =>
      /^(Save to my collections|Saved to your collections)$/.test(node.textContent?.trim() ?? ""),
    );
    assert.ok(button, "The real collection detail save button rendered");
    return button;
  };
  return {
    dom,
    target,
    saveId,
    openDetail,
    async close() {
      await React.act(() => root.unmount());
      dom.window.close();
    },
  };
}

for (const entry of ["context menu", "detail button"] as const) {
  test(`${entry}: saves the selected community copy and restores its saved state after reopening`, async () => {
    let persisted: string;
    const h = await harness();
    try {
      if (entry === "context menu") await React.act(() => executeContextAction(h.target, h.saveId));
      else {
        const button = await h.openDetail();
        await React.act(() => button.click());
        assert.equal(button.disabled, true);
      }
      if (entry === "context menu") {
        const savedAction = h.target.actions().find((item) => item.id === h.saveId)!;
        assert.equal(
          savedAction.disabled,
          true,
          "The open menu reads the acknowledged saved state",
        );
        assert.equal(savedAction.label, "Saved to your collections");
        const button = await h.openDetail();
        assert.equal(button.disabled, true, "The detail entry point sees a save from the menu");
      }
      persisted = localStorage.getItem(key)!;
      const stored = JSON.parse(persisted);
      assert.equal(stored.length, 2);
      assert.deepEqual(stored[0], JSON.parse(initial)[0], "Existing data is unchanged");
      const saved = stored[1];
      assert.notEqual(saved.id, source.id);
      assert.equal(saved.sourceHandle, source.handle);
      assert.equal(saved.sourceId, source.id);
      assert.equal(saved.shared, undefined, "Saving a copy never publishes it");
      assert.equal(saved.coverImage, source.coverImage);
      assert.equal(saved.bgImage, source.bgImage);
      assert.equal(saved.numbered, true);
      assert.deepEqual(saved.items, source.items);
      assert.equal(document.querySelector("[role=alert]"), null);
    } finally {
      await h.close();
    }
    const reopened = await harness(persisted!);
    try {
      const action = reopened.target.actions().find((item) => item.id === reopened.saveId)!;
      assert.equal(action.label, "Saved to your collections");
      assert.equal(action.disabled, true);
      const button = await reopened.openDetail();
      assert.equal(button.disabled, true);
      assert.equal(button.textContent?.trim(), "Saved to your collections");
      const profile = membership.captureMembershipProfile()!;
      const repeated = collections.saveCommunityCollectionWithResult(source, profile);
      assert.equal(repeated.result.status, "already-present");
      assert.equal(repeated.id, JSON.parse(persisted!)[1].id);
      assert.equal(
        localStorage.getItem(key),
        persisted,
        "Repeated save does not write another copy",
      );
    } finally {
      await reopened.close();
    }
  });

  test(`${entry}: rejected storage is reported without an optimistic saved state`, async () => {
    const h = await harness();
    try {
      const button = entry === "detail button" ? await h.openDetail() : undefined;
      const realSet = h.dom.window.Storage.prototype.setItem;
      h.dom.window.Storage.prototype.setItem = function (name, value) {
        if (name === key) throw new h.dom.window.DOMException("Fixture full", "QuotaExceededError");
        realSet.call(this, name, value);
      };
      if (entry === "context menu") {
        await assert.rejects(executeContextAction(h.target, h.saveId), /Could not save the change/);
        assert.equal(h.target.actions().find((item) => item.id === h.saveId)?.disabled, false);
      } else {
        await React.act(() => button!.click());
        assert.match(
          document.querySelector("[role=alert]")!.textContent!,
          /Could not save the change/,
        );
        assert.equal(button!.disabled, false);
      }
      assert.equal(localStorage.getItem(key), initial);
      assert.deepEqual(
        collections.readCollections().map((item) => item.id),
        ["existing"],
      );
      h.dom.window.Storage.prototype.setItem = realSet;
      if (entry === "context menu") await React.act(() => executeContextAction(h.target, h.saveId));
      else {
        await React.act(() => button!.click());
        assert.equal(
          document.querySelector("[role=alert]"),
          null,
          "A successful retry clears the error",
        );
        assert.equal(button!.disabled, true);
      }
      assert.equal(
        JSON.parse(localStorage.getItem(key)!).length,
        2,
        "Retry saves exactly one copy",
      );
    } finally {
      await h.close();
    }
  });
}
