import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import * as icons from "lucide-react";
import { JSDOM } from "jsdom";
import { ConfirmableAction } from "../src/components/context-menu/action-items.tsx";
import { executeContextAction } from "../src/lib/context-actions.ts";

for (const kind of ["group", "theme"] as const) {
  test(`${kind} comment confirmation rejects an actor change even when the displayed handle is unchanged`, async () => {
    const dom = new JSDOM("<!doctype html><div id='root'></div>", {
      url: "https://fixture.invalid",
    });
    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      Element: dom.window.Element,
      HTMLElement: dom.window.HTMLElement,
      MutationObserver: dom.window.MutationObserver,
      getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    window.matchMedia = () => ({ matches: true });
    dom.window.HTMLElement.prototype.scrollIntoView = () => {};
    let actorId = "original-author";
    const actor = () => ({ profileId: "fixture", authorId: actorId });
    let targetFactory;
    let writes = 0;
    const noop = () => null;
    const unexpected = () => {
      throw new Error("Unexpected network, native dialog or unrelated action");
    };
    const dependencies = {
      react: React,
      "react/jsx-runtime": jsxRuntime,
      "lucide-react": icons,
      "@/lib/i18n": {
        useT: () => (key, values) =>
          key.replace(/\{(\w+)\}/g, (_, name) => String(values?.[name] ?? name)),
      },
      "@/lib/use-autosize": { useAutosize: noop },
      "./post-body": { PostBody: ({ body }) => body },
      "@/lib/social/group-posts": {
        deleteGroupPost: async () => {
          writes++;
          return { ok: true };
        },
        editGroupPost: unexpected,
        likeGroupPost: unexpected,
        pinGroupPost: unexpected,
      },
      "@/views/profile/profile-bits": { Avatar: noop, timeAgo: () => "just now" },
      "@/views/profile/user-hover-card": { UserHoverCard: ({ children }) => children },
      "@/views/account/verified-badge": { VerifiedBadge: noop },
      "@/lib/context-menu": {
        useContextTarget: (factory) => {
          targetFactory = factory;
          return noop;
        },
        useContextMenu: () => ({ open: unexpected }),
      },
      "@/components/context-menu/content-actions": { copyContextText: unexpected },
      "@/components/context-menu/action-items": { ConfirmableAction },
      "@/lib/membership-operations": {
        captureMembershipProfile: () => ({ activeId: "fixture", settingsLinked: false }),
        isMembershipProfileCurrent: () => true,
      },
      "@/lib/theme-auth": { currentAuthor: () => ({ id: actorId, handle: "same-handle" }) },
      "@/lib/social/action-actor": {
        captureSocialActor: actor,
        isSocialActorCurrent: (expected) => expected.authorId === actorId,
        assertSocialActor: (expected) => {
          if (expected.authorId !== actorId) throw new Error("The active profile changed.");
        },
      },
      "@/lib/social/open-profile": { canOpenProfile: () => false, requestOpenProfile: unexpected },
      "@/components/player/copy-link-button": { copyText: unexpected },
      "../../../../icons": icons,
      "@/views/settings/kit": { ROW_ACTION: "", ROW_ACTION_DANGER: "" },
      "@/views/settings/shared": { ROW_TITLE: "" },
      "./comment-render": { CommentBody: ({ body }) => body },
      "./comment-composer": { CommentComposer: noop },
      "../time-ago": { timeAgo: () => "just now" },
    };
    const path =
      kind === "group"
        ? "../src/views/group/post-item.tsx"
        : "../src/views/settings/theme-panel/custom-themes-section/community-store/comments/comment-item.tsx";
    const output = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    });
    const exports = {};
    new Function("require", "exports", output.outputText)((name) => {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    }, exports);
    const { createRoot } = await import("react-dom/client");
    const root = createRoot(document.getElementById("root")!);
    const item = {
      id: "fixture-comment",
      themeId: "fixture-theme",
      groupId: "fixture-group",
      body: "Fixture body",
      author: kind === "group" ? { handle: "writer", alias: "Writer" } : "Writer",
      authorHandle: "writer",
      canDelete: true,
      createdAt: "2026-09-11",
      at: "2026-09-11",
      liked: false,
      pinned: false,
      likeCount: 0,
    };
    const props =
      kind === "group"
        ? { post: item, groupId: item.groupId, onChanged: unexpected, onRemoved: noop }
        : {
            comment: item,
            onDelete: async () => {
              writes++;
            },
            signedIn: true,
          };
    try {
      await React.act(() =>
        root.render(
          React.createElement(kind === "group" ? exports.PostItem : exports.CommentItem, props),
        ),
      );
      const source = targetFactory();
      const action = source.actions().find((row) => row.confirmation);
      assert.ok(action?.confirmation);
      await React.act(async () => {
        await assert.rejects(executeContextAction(source, action.id), /confirmation/);
      });
      assert.equal(writes, 0);
      actorId = "different-author";
      await React.act(async () => {
        await assert.rejects(
          executeContextAction(source, action.id, { confirmationKey: action.confirmation.key }),
          /available|profile changed/i,
        );
      });
      assert.equal(writes, 0);
      actorId = "original-author";
      await React.act(async () => {
        await executeContextAction(source, action.id, { confirmationKey: action.confirmation.key });
      });
      assert.equal(writes, 1);
      assert.equal(document.querySelector("[role='dialog']"), null);
    } finally {
      await React.act(() => root.unmount());
      dom.window.close();
    }
  });
}
