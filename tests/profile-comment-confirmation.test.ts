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

test("profile comment button and menu share contextual confirmation tied to the author and comment", async () => {
  const dom = new JSDOM("<!doctype html><div id='root'></div>", { url: "https://fixture.invalid" });
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
  let actor = { profileId: "fixture", authorId: "owner" };
  let currentTarget;
  const changes: string[] = [];
  const unexpected = () => {
    throw new Error("Unexpected native dialog or unrelated action");
  };
  const empty = () => null;
  const dependencies = {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "lucide-react": icons,
    "@/lib/i18n": {
      useT: () => (key, values) =>
        key.replace(/\{(\w+)\}/g, (_, name) => String(values?.[name] ?? name)),
    },
    "@/lib/social/mentions": { segmentMentions: (text) => [{ text }] },
    "./profile-bits": { Avatar: empty, timeAgo: () => "just now" },
    "./comment-compose": { CommentCompose: empty },
    "./mention-link": { MentionLink: empty },
    "./text-safety": { segmentProfanity: (text) => [{ text }] },
    "./user-hover-card": { UserHoverCard: ({ children }) => children },
    "./use-self-avatar": { useSelfAvatar: () => ({ handle: "owner" }) },
    "@/views/account/verified-badge": { VerifiedBadge: empty },
    "@/lib/context-menu": {
      useContextTarget: (factory) => {
        currentTarget = factory;
        return empty;
      },
    },
    "@/components/context-menu/content-actions": { copyContextText: unexpected },
    "@/lib/dialog": { confirmDialog: unexpected },
    "@/lib/social/open-profile": { canOpenProfile: () => false },
    "@/components/context-menu/action-items": { ConfirmableAction },
    "@/lib/social/action-actor": {
      captureSocialActor: () => ({ ...actor }),
      isSocialActorCurrent: (expected) =>
        expected.authorId === actor.authorId && expected.profileId === actor.profileId,
      assertSocialActor: (expected) => {
        if (expected.authorId !== actor.authorId || expected.profileId !== actor.profileId)
          throw new Error("The active profile changed.");
      },
    },
  };
  const output = ts.transpileModule(
    readFileSync(new URL("../src/views/profile/comment-item.tsx", import.meta.url), "utf8"),
    {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  );
  const exports = {};
  new Function("require", "exports", output.outputText)((name) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, exports);
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(document.getElementById("root")!);
  const comment = {
    id: "comment-fixture",
    body: "Selected fixture comment",
    authorHandle: "writer",
    authorAlias: "Writer",
    at: "2026-09-11",
  };
  const render = () =>
    React.createElement(exports.CommentItem, {
      c: comment,
      canDelete: true,
      signedIn: true,
      onDelete: async (id) => {
        changes.push(id);
      },
    });
  const click = (selector: string) =>
    React.act(async () => {
      document.querySelector<HTMLButtonElement>(selector)!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  try {
    await React.act(() => root.render(render()));
    const source = { actions: () => currentTarget().actions() };
    const deletion = source.actions().find((action) => action.id === "comment:delete");
    assert.ok(deletion.confirmation?.key);
    assert.match(deletion.confirmation.description, /writer/);
    assert.match(deletion.confirmation.description, /Selected fixture comment/);
    await React.act(async () => {
      await assert.rejects(executeContextAction(source, "comment:delete"), /confirmation/);
    });
    await click("[aria-label='Delete comment']");
    assert.deepEqual(changes, []);
    assert.ok(document.querySelector("[data-context-confirmation]"));
    await click("[data-context-cancel]");
    assert.deepEqual(changes, []);
    assert.equal(document.querySelector("[data-context-confirmation]"), null);
    await click("[aria-label='Delete comment']");
    actor = { ...actor, authorId: "other" };
    await click("[data-context-confirm]");
    assert.deepEqual(changes, []);
    assert.match(
      document.querySelector("[role='alert']")?.textContent ?? "",
      /available|profile changed/i,
    );
    actor = { ...actor, authorId: "owner" };
    await click("[data-context-confirm]");
    assert.deepEqual(changes, [comment.id]);
  } finally {
    await React.act(() => root.unmount());
    dom.window.close();
  }
});
