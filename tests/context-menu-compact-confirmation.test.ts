import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { ActionCommand } from "../src/components/context-menu/action-command.tsx";
import type { ContextAction } from "../src/lib/context-actions.ts";

test("compact confirmation identifies scope without exposing path walls and retains guarded explicit activation", async () => {
  const dom = new JSDOM("<!doctype html><div id='root'></div>");
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    MutationObserver: dom.window.MutationObserver,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  dom.window.matchMedia = (() => ({ matches: true })) as typeof dom.window.matchMedia;
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(document.getElementById("root")!);
  const runs: string[] = [];
  const action: ContextAction = {
    id: "delete:file-one",
    label: "Delete file",
    danger: true,
    confirmation: {
      key: "actor:file-one:path:version",
      title: "Delete file",
      summary: "Episode One.mkv",
      description:
        "Deletes the selected downloaded file. C:/isolated/long/private/path/Episode One.mkv",
      confirmLabel: "Delete",
      successLabel: "Deleted",
    },
  };
  const render = (error?: string) =>
    createElement(ActionCommand, {
      action,
      blocked: false,
      state: error ? { phase: "error", error } : undefined,
      run: async (_id: string, key?: string) => {
        runs.push(key!);
      },
    });
  const click = async (selector: string, detail = 1) =>
    act(() =>
      document
        .querySelector(selector)!
        .dispatchEvent(
          new dom.window.MouseEvent("click", { bubbles: true, cancelable: true, detail }),
        ),
    );
  try {
    await act(() => root.render(render()));
    await click("[data-context-action]");
    assert.deepEqual(runs, [], "first activation only asks for confirmation");
    assert.equal(document.activeElement?.hasAttribute("data-context-cancel"), true);
    assert.equal(
      document.querySelector<HTMLButtonElement>("[data-context-action]")!.disabled,
      true,
      "replaced trigger is excluded from menu keyboard navigation",
    );
    const surface = document.querySelector(".context-menu-confirmation")!;
    assert.ok(surface.textContent!.includes("Episode One.mkv"));
    assert.equal(
      surface.textContent!.includes("C:/isolated"),
      false,
      "long path is disclosed only on request",
    );
    await click("[data-context-details]");
    assert.ok(surface.textContent!.includes("C:/isolated"));
    await click("[data-context-confirm]", 2);
    assert.deepEqual(runs, [], "double-click cannot confirm");
    await click("[data-context-confirm]");
    assert.deepEqual(runs, ["actor:file-one:path:version"]);
    await click("[data-context-cancel]");
    assert.equal(document.activeElement?.getAttribute("data-context-action"), action.id);
    await click("[data-context-action]");
    await act(() =>
      root.render(
        render(
          "Could not delete. This is a deliberately long native diagnostic for C:/isolated/path",
        ),
      ),
    );
    assert.ok(document.querySelector("[role='alert']"));
    assert.equal(
      document.querySelector("[role='alert']")!.textContent!.includes("C:/isolated"),
      false,
    );
    await click("[data-context-error-details]");
    assert.ok(
      document.body.textContent!.includes("deliberately long native diagnostic"),
      "original error remains available",
    );
    await act(() =>
      root.render(
        render(
          "1 completed, 1 failed, 0 changed or unavailable.\nEpisode One: C:/isolated/path could not be deleted.",
        ),
      ),
    );
    assert.equal(
      document.querySelector("[role='alert']")!.textContent,
      "1 completed, 1 failed, 0 changed or unavailable.",
      "partial outcome remains visible without opening details",
    );
  } finally {
    await act(() => root.unmount());
    dom.window.close();
  }
});
