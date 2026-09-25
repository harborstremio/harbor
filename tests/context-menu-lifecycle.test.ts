import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import {
  ContextMenuProvider,
  useContextMenu,
  useContextMenuActions,
  useContextTarget,
  useHeroContext,
  registerContextTarget,
  registeredContextTarget,
} from "../src/lib/context-menu.tsx";
import { clickedContent, dispatchKeyboardContextMenu } from "../src/lib/context-content.ts";
import { executeContextAction } from "../src/lib/context-actions.ts";

test("membership title remains a semantic target after its source card disappears, while actor and identity changes invalidate", () => {
  const dom = new JSDOM("<main><article></article></main>");
  const node = dom.window.document.querySelector("article")!;
  let actor = "first";
  let id = "title-one";
  const unregister = registerContextTarget(node, () => ({
    kind: "meta",
    meta: { id, type: "movie", name: "Test title" },
    membership: { kind: "collection", id: "source" },
    isValid: () => actor === "first",
  }));
  const target = registeredContextTarget(node)!;
  id = "title-two";
  assert.equal(target.isValid?.(), false, "connected cards reused for another title invalidate");
  id = "title-one";
  const detached = registeredContextTarget(node)!;
  unregister();
  node.remove();
  assert.equal(detached.isValid?.(), true, "removing source membership does not remove the title");
  actor = "second";
  assert.equal(detached.isValid?.(), false, "semantic ownership guards survive removal");
  dom.window.close();
});

test("detached focus origins survive validation, semantic invalidation closes, and old sessions cannot dismiss replacements", async () => {
  const dom = new JSDOM("<!doctype html><div id='root'></div><button id='origin'>Open</button>");
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const ticks = new Map<number, () => void>();
  let timer = 0;
  dom.window.setInterval = ((callback: () => void) => {
    ticks.set(++timer, callback);
    return timer;
  }) as typeof dom.window.setInterval;
  dom.window.clearInterval = (id) => {
    ticks.delete(id);
  };
  let menu!: ReturnType<typeof useContextMenu>;
  function Observe() {
    menu = useContextMenu();
    return null;
  }
  let consumerRenders = 0;
  function EventConsumer() {
    useContextMenuActions();
    consumerRenders++;
    return null;
  }
  const root = createRoot(document.getElementById("root")!);
  try {
    await act(() =>
      root.render(
        createElement(
          ContextMenuProvider,
          null,
          createElement(Observe),
          createElement(EventConsumer),
        ),
      ),
    );
    const origin = document.getElementById("origin")!;
    origin.focus();
    let valid = true;
    await act(() => menu.openAt({ x: 10, y: 10 }, { kind: "content", isValid: () => valid }));
    const firstSession = menu.state!.session;
    const oldTick = [...ticks.values()][0];
    origin.remove();
    await act(() => oldTick());
    assert.ok(menu.state, "temporary hover content removal must not dismiss its menu");
    assert.notEqual(menu.state?.phase, "closing");
    valid = false;
    await act(() => oldTick());
    assert.equal(menu.state?.phase, "closing", "semantic invalidation starts dismissal");
    const replacementOrigin = document.createElement("button");
    document.body.append(replacementOrigin);
    replacementOrigin.focus();
    await act(() => menu.openAt({ x: 20, y: 20 }, { kind: "content" }));
    const replacement = menu.state!.session;
    const menuButton = document.createElement("button");
    document.body.append(menuButton);
    menuButton.focus();
    await act(() => {
      oldTick();
      menu.close(false, firstSession);
      menu.completeClose(firstSession);
    });
    assert.equal(menu.state?.session, replacement);
    assert.equal(menu.state?.phase, "open");
    assert.equal(document.activeElement, menuButton, "old-session callbacks must not steal focus");
    await act(() => menu.close(true, replacement));
    assert.equal(
      document.activeElement,
      replacementOrigin,
      "keyboard dismissal restores focus synchronously",
    );
    await act(() => menu.completeClose(replacement));
    assert.equal(menu.state, null);
    assert.equal(
      consumerRenders,
      1,
      "menu state changes must not rerender event-only BBCode consumers",
    );
  } finally {
    await act(() => root.unmount());
    dom.window.close();
  }
});

test("hero context survives same-title refreshes and invalidates when carousel identity changes or unmounts", async () => {
  const dom = new JSDOM("<!doctype html><div id='root'></div>");
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    MouseEvent: dom.window.MouseEvent,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  let menu!: ReturnType<typeof useContextMenu>;
  function Observe() {
    menu = useContextMenu();
    return null;
  }
  function Hero({ id, type, name }: { id: string; type: string; name: string }) {
    const onContextMenu = useHeroContext({ id, type, name }, `https://example.com/${name}.jpg`);
    return createElement("section", { onContextMenu }, name);
  }
  const root = createRoot(document.getElementById("root")!);
  const render = (id = "moana", type = "movie", name = "Moana", shown = true) =>
    root.render(
      createElement(
        ContextMenuProvider,
        null,
        createElement(Observe),
        shown ? createElement(Hero, { id, type, name }) : null,
      ),
    );
  const summon = async () =>
    act(() =>
      document.querySelector("section")!.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: 30,
          clientY: 30,
        }),
      ),
    );
  try {
    await act(() => render());
    await summon();
    const opened = menu.state!.target;
    await act(() => render("moana", "movie", "New artwork"));
    assert.notEqual(
      opened.isValid?.(),
      false,
      "fresh metadata and artwork for the same title must survive",
    );
    await act(() => render("silo", "series", "Silo"));
    assert.equal(opened.isValid?.(), false, "Moana actions cannot remain valid over the Silo hero");
    await summon();
    const series = menu.state!.target;
    await act(() => render("silo", "movie", "Silo"));
    assert.equal(
      series.isValid?.(),
      false,
      "same id with a changed media type is a different target",
    );
    await summon();
    const removed = menu.state!.target;
    await act(() => render("silo", "movie", "Silo", false));
    assert.equal(removed.isValid?.(), false, "an unmounted hero cannot retain actionable context");
  } finally {
    await act(() => root.unmount());
    dom.window.close();
  }
});

test("selection belongs to the pointer hit or a narrow keyboard target, never a broad stale ancestor", () => {
  const dom = new JSDOM(
    "<!doctype html><main><p id='selected'>selected words</p><p id='other'>other words</p></main>",
  );
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    Element: dom.window.Element,
  });
  try {
    const paragraph = document.getElementById("selected")!;
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const selection = window.getSelection()!;
    selection.addRange(range);
    range.getClientRects = () =>
      [{ left: 10, right: 80, top: 10, bottom: 30 }] as unknown as DOMRectList;
    assert.equal(clickedContent(document.querySelector("main")).selection, undefined);
    assert.equal(clickedContent(document.getElementById("other")).selection, undefined);
    assert.equal(clickedContent(paragraph).selection, "selected words");
    assert.equal(
      clickedContent(document.querySelector("main"), { x: 200, y: 100 }).selection,
      undefined,
    );
    assert.equal(clickedContent(paragraph, { x: 20, y: 20 }).selection, "selected words");
  } finally {
    dom.window.close();
  }
});

test("keyboard-dispatched menu keeps local selection while its nonzero anchor position is outside selected text", async () => {
  const dom = new JSDOM("<!doctype html><div id='root'></div>");
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    MouseEvent: dom.window.MouseEvent,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  let menu!: ReturnType<typeof useContextMenu>;
  function Content() {
    menu = useContextMenu();
    return createElement(
      "p",
      {
        tabIndex: 0,
        onContextMenu: (event: React.MouseEvent) => menu.open(event, { kind: "content" }),
      },
      "selected words",
    );
  }
  const root = createRoot(document.getElementById("root")!);
  try {
    await act(() => root.render(createElement(ContextMenuProvider, null, createElement(Content))));
    const paragraph = document.querySelector("p")!;
    paragraph.getBoundingClientRect = () =>
      ({ left: 100, top: 100, width: 200, height: 100, bottom: 200 }) as DOMRect;
    paragraph.focus();
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    range.getClientRects = () =>
      [{ left: 100, right: 190, top: 100, bottom: 120 }] as unknown as DOMRectList;
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    await act(() => dispatchKeyboardContextMenu(paragraph));
    assert.deepEqual(menu.state?.pos, { x: 124, y: 200 });
    assert.equal(menu.state?.target.selection, "selected words");
    await act(() =>
      paragraph.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: 124,
          clientY: 200,
        }),
      ),
    );
    assert.equal(
      menu.state?.target.selection,
      undefined,
      "a physical pointer at the same point is outside the selection",
    );
  } finally {
    await act(() => root.unmount());
    dom.window.close();
  }
});

test("inline composed React refs preserve target lifetime across menu rerenders while changed and removed rows invalidate", async () => {
  const dom = new JSDOM("<!doctype html><div id='root'></div>");
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    MouseEvent: dom.window.MouseEvent,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  let menu!: ReturnType<typeof useContextMenu>;
  let executions = 0;
  function Observe() {
    menu = useContextMenu();
    return null;
  }
  function Row({ id, disabled }: { id: string; disabled: boolean }) {
    const { open } = useContextMenu();
    const ref = useContextTarget<HTMLButtonElement>(() => ({
      kind: "actions",
      id,
      label: id,
      actions: () => [
        {
          id: "run",
          label: "Run",
          disabled,
          run: () => {
            executions++;
          },
        },
      ],
    }));
    return createElement(
      "button",
      { ref: (node) => ref(node), onContextMenu: (event) => open(event, { kind: "content" }) },
      id,
    );
  }
  const root = createRoot(document.getElementById("root")!);
  const render = (id = "first", disabled = false, shown = true) =>
    root.render(
      createElement(
        ContextMenuProvider,
        null,
        createElement(Observe),
        shown ? createElement(Row, { id, disabled }) : null,
      ),
    );
  try {
    await act(() => render());
    await act(() =>
      document.querySelector("button")!.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: 20,
          clientY: 20,
        }),
      ),
    );
    const target = menu.state!.target;
    if (target.kind !== "actions") throw new Error("Registered row was not resolved");
    assert.equal(
      target.isValid?.(),
      true,
      "opening a menu must not invalidate a composed ref registration",
    );
    await act(() => render("first", true));
    assert.equal(target.isValid?.(), true);
    await assert.rejects(executeContextAction(target, "run"));
    await act(() => render());
    await executeContextAction(target, "run");
    assert.equal(executions, 1);
    await act(() => render("second"));
    assert.equal(
      target.isValid?.(),
      false,
      "a recycled row cannot execute the first entity's command",
    );
    await assert.rejects(executeContextAction(target, "run"));
    await act(() => render("first", false, false));
    assert.equal(target.isValid?.(), false, "actual removal invalidates commands");
  } finally {
    await act(() => root.unmount());
    dom.window.close();
  }
});
