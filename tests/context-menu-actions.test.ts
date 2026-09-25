import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { ActionItems } from "../src/components/context-menu/action-items.tsx";
import * as ContextCommands from "../src/components/context-menu/action-items.tsx";
import { MenuSurface } from "../src/components/context-menu/menu-surface.tsx";
import type { ActionSource, ContextAction } from "../src/lib/context-actions.ts";
import { emitListToast, ListToastHost } from "../src/components/lists/list-toast.tsx";

async function harness() {
  const dom = new JSDOM("<!doctype html><div id='root'></div>");
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    KeyboardEvent: dom.window.KeyboardEvent,
    MutationObserver: dom.window.MutationObserver,
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    innerWidth: 800,
    innerHeight: 600,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  dom.window.matchMedia = (() => ({ matches: true })) as typeof dom.window.matchMedia;
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  dom.window.HTMLElement.prototype.getBoundingClientRect = () => ({
    x: 10,
    y: 10,
    top: 10,
    left: 10,
    right: 254,
    bottom: 210,
    width: 244,
    height: 200,
    toJSON() {},
  });
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(document.getElementById("root")!);
  const key = async (value: string, repeat = false) =>
    act(() => {
      document.activeElement!.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", {
          key: value,
          repeat,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
  const click = async (element: Element, detail = 1) =>
    act(async () => {
      element.dispatchEvent(
        new dom.window.MouseEvent("click", { bubbles: true, cancelable: true, detail }),
      );
    });
  return {
    dom,
    root,
    key,
    click,
    cleanup: async () => {
      await act(() => root.unmount());
      dom.window.close();
    },
  };
}

test("destination section labels are non-actionable, compact, and derived from visible rows", async () => {
  const h = await harness();
  try {
    const actions: ContextAction[] = [
      {
        id: "list:a",
        label: "List A",
        sectionLabel: "Lists",
        group: "list",
        checked: false,
        run() {},
      },
      { id: "create", label: "Create new list", sectionLabel: "Lists", group: "create", run() {} },
      {
        id: "collection:a",
        label: "Collection A",
        sectionLabel: "Collections",
        group: "collection",
        checked: true,
        run() {},
      },
    ];
    const render = (rows: ContextAction[]) =>
      h.root.render(
        createElement(ActionItems, {
          source: { actions: () => rows, subscribe: () => () => {} },
          onClose() {},
        }),
      );
    await act(() => render(actions));
    const headings = [...document.querySelectorAll<HTMLElement>(".context-menu-section-label")];
    assert.deepEqual(
      headings.map((node) => node.textContent),
      ["Lists", "Collections"],
    );
    assert.ok(headings.every((node) => node.tabIndex === -1 && !node.getAttribute("role")));
    assert.equal(document.querySelectorAll("[role='separator']").length, 1);
    assert.equal(document.querySelectorAll("button").length, 3);
    await act(() => render(actions.slice(2)));
    assert.deepEqual(
      [...document.querySelectorAll(".context-menu-section-label")].map((node) => node.textContent),
      ["Collections"],
    );
    assert.equal(document.querySelectorAll("[role='separator']").length, 0);
  } finally {
    await h.cleanup();
  }
});

test("membership rows save independently, stay open, and report only their own failure", async () => {
  const h = await harness();
  let closeCount = 0;
  const checked = new Set<string>();
  const calls: string[] = [];
  const finish = new Map<string, (error?: Error) => void>();
  const listeners = new Set<() => void>();
  const source: ActionSource = {
    actions: () => [
      {
        id: "memberships",
        label: "Add to list or collection",
        children: ["A", "B"].map((id) => ({
          id,
          label: `Destination ${id}`,
          checked: checked.has(id),
          dismiss: "keep-open" as const,
          run: async () => {
            calls.push(id);
            await new Promise<void>((resolve, reject) =>
              finish.set(id, (error) => (error ? reject(error) : resolve())),
            );
            if (checked.has(id)) checked.delete(id);
            else checked.add(id);
            listeners.forEach((listener) => listener());
          },
        })),
      },
    ],
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  try {
    await act(() =>
      h.root.render(
        createElement(MenuSurface, {
          point: { x: 20, y: 20 },
          onClose: () => {
            closeCount++;
          },
          children: createElement(ActionItems, {
            source,
            onClose: () => {
              closeCount++;
            },
          }),
        }),
      ),
    );
    await h.key("ArrowRight");
    const row = (id: string) =>
      document.querySelector<HTMLButtonElement>(`[data-context-action='${id}']`)!;
    assert.equal(row("A").getAttribute("role"), "menuitemcheckbox");
    assert.equal(row("A").getAttribute("aria-checked"), "false");
    const panel = row("A").closest("[data-harbor-menu-panel]");
    await h.click(row("A"));
    await h.click(row("A"));
    await h.click(row("B"));
    assert.deepEqual(calls, ["A", "B"], "only duplicates of the same destination are blocked");
    assert.equal(
      row("A").getAttribute("aria-checked"),
      "false",
      "pending is not confirmed membership",
    );
    await act(async () => finish.get("A")!());
    assert.equal(row("A").getAttribute("aria-checked"), "true");
    assert.equal(closeCount, 0);
    await act(async () => finish.get("B")!(new Error("Destination B could not be saved")));
    assert.equal(row("B").getAttribute("aria-checked"), "false");
    assert.equal(row("A").getAttribute("aria-checked"), "true");
    assert.equal(
      row("B").closest("[data-context-command]")?.querySelector("[role='alert']")?.textContent,
      "Destination B could not be saved",
    );
    assert.equal(
      row("A").closest("[data-harbor-menu-panel]"),
      panel,
      "membership updates retain the submenu DOM",
    );
    await act(() => row("A").focus());
    await h.key("ArrowDown");
    assert.equal(document.activeElement, row("B"), "checkbox rows participate in menu arrows");
  } finally {
    await h.cleanup();
  }
});

test("confirmation is explicit, contextual, repeat-safe, and cancelled by the nearest Escape", async () => {
  const h = await harness();
  let closes = 0;
  let calls = 0;
  let finish: (() => void) | undefined;
  let scope = "actor-a:file-a:1";
  const action = (): ContextAction => ({
    id: "delete-test",
    label: "Delete downloaded file…",
    danger: true,
    confirmation: {
      key: scope,
      title: "Delete file-a?",
      description: "Deletes file-a and its download record. Other files are kept.",
      confirmLabel: "Delete file",
      pendingLabel: "Deleting file…",
      successLabel: "File deleted",
    },
    run: async () => {
      calls++;
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
    },
  });
  const source: ActionSource = { actions: () => [action()], subscribe: () => () => {} };
  const render = (instance = "first") =>
    createElement(MenuSurface, {
      key: instance,
      point: { x: 20, y: 20 },
      onClose: () => {
        closes++;
      },
      children: createElement(ActionItems, {
        source,
        onClose: () => {
          closes++;
        },
      }),
    });
  const trigger = () =>
    document.querySelector<HTMLButtonElement>("[data-context-action='delete-test']")!;
  const confirm = () => document.querySelector<HTMLButtonElement>("[data-context-confirm]")!;
  try {
    await act(() => h.root.render(render()));
    await h.click(trigger());
    assert.equal(calls, 0, "requesting confirmation never executes");
    assert.match(
      document.querySelector("[data-context-confirmation]")!.textContent!,
      /Other files are kept/,
    );
    assert.equal(
      document.activeElement?.getAttribute("data-context-cancel"),
      "true",
      "initial focus is the safe choice",
    );
    await h.click(trigger(), 2);
    await h.key("Enter", true);
    assert.equal(calls, 0, "double click and held key cannot arm then execute");
    await h.key("Escape");
    assert.equal(document.querySelector("[data-context-confirm]"), null);
    assert.equal(closes, 0, "Escape cancels only the confirmation");
    await h.click(trigger());
    await act(() => h.root.render(render("replacement")));
    assert.equal(
      document.querySelector("[data-context-confirm]"),
      null,
      "reopening is never armed",
    );
    await h.click(trigger());
    scope = "actor-b:file-a:1";
    await h.click(confirm());
    assert.equal(calls, 0, "changed actor or scope requires a new confirmation");
    assert.match(document.querySelector("[role='alert']")!.textContent!, /changed/);
    assert.equal(confirm(), null, "a changed actor disarms the old confirmation");
    await h.click(trigger());
    await h.click(confirm());
    await h.click(confirm());
    assert.equal(calls, 1);
    await act(async () => finish!());
    assert.match(document.querySelector("[role='status']")!.textContent!, /File deleted/);
    assert.equal(closes, 0);
    await h.click(trigger());
    assert.equal(calls, 1, "success cannot execute again");
  } finally {
    await h.cleanup();
  }
});

test("ordinary row buttons share confirmation without pretending to be menu items", async () => {
  const h = await harness();
  let runs = 0;
  const source: ActionSource = {
    actions: () => [
      {
        id: "remove-friend-test",
        label: "Remove friend",
        confirmation: {
          key: "actor:friend",
          title: "Remove Test Person?",
          description: "Removes this friendship only.",
          confirmLabel: "Remove friend",
          successLabel: "Friend removed",
        },
        run() {
          runs++;
        },
      },
    ],
    subscribe: () => () => {},
  };
  try {
    await act(() =>
      h.root.render(
        createElement(ContextCommands.ConfirmableAction, {
          source,
          actionId: "remove-friend-test",
          className: "existing-trigger",
        }),
      ),
    );
    const trigger = document.querySelector<HTMLButtonElement>(".existing-trigger")!;
    assert.equal(trigger.getAttribute("role"), null);
    await h.click(trigger);
    assert.equal(runs, 0);
    await h.click(document.querySelector("[data-context-confirm]")!);
    assert.equal(runs, 1);
    assert.match(document.querySelector("[role='status']")!.textContent!, /Friend removed/);
  } finally {
    await h.cleanup();
  }
});

test("closing a pending menu does not let its completion dismiss a replacement menu", async () => {
  const h = await harness();
  let closes = 0;
  let finish: (() => void) | undefined;
  const source: ActionSource = {
    actions: () => [
      {
        id: "copy:late-result",
        label: "Copy Text",
        run: async () => {
          await new Promise<void>((resolve) => {
            finish = resolve;
          });
        },
      },
    ],
    subscribe: () => () => {},
  };
  const render = (session: string) =>
    createElement(MenuSurface, {
      key: session,
      point: { x: 20, y: 20 },
      onClose: () => {
        closes++;
      },
      children: createElement(ActionItems, {
        source,
        onClose: () => {
          closes++;
        },
      }),
    });
  try {
    await act(() => h.root.render(render("old")));
    await h.click(document.querySelector("[data-context-action='copy:late-result']")!);
    await act(() => h.root.render(render("new")));
    const newPanel = document.querySelector("[data-harbor-menu-panel]");
    await act(async () => finish!());
    assert.equal(closes, 0);
    assert.equal(document.querySelector("[data-harbor-menu-panel]"), newPanel);
    assert.equal(
      document.querySelector("[data-action-phase='success']"),
      null,
      "old success is not assigned to the replacement",
    );
  } finally {
    await h.cleanup();
  }
});

test("in-flight commands retain their slot and a removed target retains truthful confirmation feedback", async () => {
  const h = await harness();
  let available = true;
  let finish: (() => void) | undefined;
  const listeners = new Set<() => void>();
  const destructive: ContextAction = {
    id: "delete:remove-on-finish",
    label: "Delete file…",
    confirmation: {
      key: "actor:file",
      title: "Delete fixture file?",
      description: "Deletes only this test file.",
      confirmLabel: "Delete file",
      successLabel: "File deleted",
    },
    run: async () => {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      available = false;
      listeners.forEach((listener) => listener());
    },
  };
  const source: ActionSource = {
    actions: () => (available ? [destructive] : []),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  try {
    await act(() =>
      h.root.render(
        createElement(MenuSurface, {
          point: { x: 20, y: 20 },
          onClose() {},
          children: createElement(ActionItems, { source, onClose() {} }),
        }),
      ),
    );
    const row = document.querySelector("[data-context-action='delete:remove-on-finish']")!;
    await h.click(row);
    await h.click(document.querySelector("[data-context-confirm]")!);
    await act(async () => finish!());
    assert.equal(document.querySelector("[data-context-action='delete:remove-on-finish']"), row);
    assert.match(document.querySelector("[role='status']")!.textContent!, /File deleted/);
  } finally {
    await h.cleanup();
  }
});

test("late failures use the shared failure tone without a success checkmark", async () => {
  const h = await harness();
  try {
    await act(() => h.root.render(createElement(ListToastHost)));
    await act(() => emitListToast("Could not save Destination B", "error"));
    const alert = document.querySelector("[role='alert']")!;
    assert.match(alert?.textContent ?? "", /Could not save Destination B/);
    assert.equal(alert.querySelector(".lucide-check"), null);
    assert.ok(alert.querySelector(".text-danger"));
    await act(() => emitListToast("Saved"));
    assert.equal(document.querySelector("[role='alert']"), null);
    assert.match(document.querySelector("[role='status']")!.textContent!, /Saved/);
  } finally {
    await h.cleanup();
  }
});
