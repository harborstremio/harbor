import assert from "node:assert/strict";
import test from "node:test";
import {
  EXTERNAL_LINK_FRAME_PERMISSIONS,
  EXTERNAL_LINK_FRAME_SANDBOX,
  SOFT_LOAD_TIMEOUT_MS,
  createExternalLinkViewerFocusScope,
  createSoftLoadTimeout,
} from "../src/lib/external-link-viewer-modal.ts";

test("viewer policy exposes only script execution and denies sensitive features", () => {
  assert.equal(EXTERNAL_LINK_FRAME_SANDBOX, "allow-scripts");
  for (const forbidden of ["allow-same-origin", "allow-forms", "allow-popups", "allow-downloads"])
    assert.equal(EXTERNAL_LINK_FRAME_SANDBOX.includes(forbidden), false);
  for (const feature of [
    "camera",
    "microphone",
    "geolocation",
    "clipboard-read",
    "fullscreen",
    "payment",
  ])
    assert.match(EXTERNAL_LINK_FRAME_PERMISSIONS, new RegExp(`${feature} 'none'`));
});

test("settle before or after arming suppresses a late slow callback", () => {
  for (const settleFirst of [false, true]) {
    const scheduled = new Map<number, () => void>();
    let nextId = 1;
    let slow = false;
    const timer = createSoftLoadTimeout(
      () => {
        slow = true;
      },
      {
        setTimeout(callback) {
          const id = nextId++;
          scheduled.set(id, callback);
          return id;
        },
        clearTimeout(id) {
          scheduled.delete(id);
        },
      },
    );
    if (settleFirst) timer.settle();
    timer.start();
    const callbacks = [...scheduled.values()];
    if (!settleFirst) timer.settle();
    for (const callback of callbacks) callback();
    assert.equal(slow, false);
  }
  assert.equal(SOFT_LOAD_TIMEOUT_MS, 7_500);
});

test("viewer becomes slow only at the soft deadline and disposal cancels it", () => {
  const scheduled = new Map<number, { callback: () => void; delay: number }>();
  let nextId = 1;
  let slowCount = 0;
  const timer = createSoftLoadTimeout(
    () => {
      slowCount += 1;
    },
    {
      setTimeout(callback, delay) {
        const id = nextId++;
        scheduled.set(id, { callback, delay });
        return id;
      },
      clearTimeout(id) {
        scheduled.delete(id);
      },
    },
  );

  timer.start();
  assert.equal(scheduled.size, 1);
  const [pendingId, pending] = [...scheduled.entries()][0];
  assert.equal(pending.delay, SOFT_LOAD_TIMEOUT_MS);
  scheduled.delete(pendingId);
  pending.callback();
  assert.equal(slowCount, 1);

  timer.start();
  assert.equal(scheduled.size, 1);
  const [, disposalPending] = [...scheduled.entries()][0];
  timer.dispose();
  assert.equal(scheduled.size, 0);
  disposalPending.callback();
  assert.equal(slowCount, 1);
});

type FakeListener = (event: Record<string, unknown>) => void;
type FakeListenerOptions = boolean | { capture?: boolean };
type FakeListenerRegistration = { listener: FakeListener; capture: boolean };

function listenerCapture(options?: FakeListenerOptions) {
  return typeof options === "boolean" ? options : (options?.capture ?? false);
}

class FakeDocument {
  activeElement: FakeElement | null = null;
  body = { style: { overflow: "clip" } };
  private readonly listeners = new Map<string, FakeListenerRegistration[]>();

  addEventListener(type: string, listener: FakeListener, options?: FakeListenerOptions) {
    const capture = listenerCapture(options);
    const listeners = this.listeners.get(type) ?? [];
    if (!listeners.some((entry) => entry.listener === listener && entry.capture === capture))
      listeners.push({ listener, capture });
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: FakeListener, options?: FakeListenerOptions) {
    const capture = listenerCapture(options);
    const listeners = this.listeners
      .get(type)
      ?.filter((entry) => entry.listener !== listener || entry.capture !== capture);
    if (listeners?.length) this.listeners.set(type, listeners);
    else this.listeners.delete(type);
  }

  dispatch(type: string, event: Record<string, unknown>) {
    for (const { listener } of this.listeners.get(type) ?? []) listener(event);
  }
}

class FakeElement {
  isConnected = true;
  tabIndex = 0;
  focusCount = 0;
  private readonly listeners = new Map<string, FakeListenerRegistration[]>();
  readonly ownerDocument: FakeDocument;
  private readonly children: FakeElement[];
  private readonly disabled: boolean;

  constructor(ownerDocument: FakeDocument, children: FakeElement[] = [], disabled = false) {
    this.ownerDocument = ownerDocument;
    this.children = children;
    this.disabled = disabled;
  }

  addEventListener(type: string, listener: FakeListener, options?: FakeListenerOptions) {
    const capture = listenerCapture(options);
    const listeners = this.listeners.get(type) ?? [];
    if (!listeners.some((entry) => entry.listener === listener && entry.capture === capture))
      listeners.push({ listener, capture });
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: FakeListener, options?: FakeListenerOptions) {
    const capture = listenerCapture(options);
    const listeners = this.listeners
      .get(type)
      ?.filter((entry) => entry.listener !== listener || entry.capture !== capture);
    if (listeners?.length) this.listeners.set(type, listeners);
    else this.listeners.delete(type);
  }

  dispatch(type: string, event: Record<string, unknown>) {
    for (const { listener } of this.listeners.get(type) ?? []) listener(event);
  }

  contains(value: unknown) {
    return value === this || this.children.includes(value as FakeElement);
  }

  focus() {
    this.focusCount += 1;
    this.ownerDocument.activeElement = this;
  }

  hasAttribute(name: string) {
    return name === "disabled" && this.disabled;
  }

  querySelectorAll() {
    return this.children;
  }

  querySelector() {
    return null;
  }
}

test("focus scope traps Tab only and restores Harbor state on cleanup", () => {
  const document = new FakeDocument();
  const prior = new FakeElement(document);
  const first = new FakeElement(document);
  const close = new FakeElement(document);
  const background = new FakeElement(document);
  const root = new FakeElement(document, [first, close]);
  document.activeElement = prior;

  const cleanup = createExternalLinkViewerFocusScope(
    root as unknown as HTMLElement,
    close as unknown as HTMLElement,
  );
  assert.equal(document.body.style.overflow, "hidden");
  assert.equal(document.activeElement, close);

  let arrowPrevented = false;
  let arrowStopped = false;
  root.dispatch("keydown", {
    key: "ArrowRight",
    preventDefault: () => {
      arrowPrevented = true;
    },
    stopPropagation: () => {
      arrowStopped = true;
    },
  });
  assert.equal(arrowPrevented, false);
  assert.equal(arrowStopped, false);

  let tabPrevented = false;
  root.dispatch("keydown", {
    key: "Tab",
    shiftKey: false,
    preventDefault: () => {
      tabPrevented = true;
    },
    stopPropagation: () => {},
  });
  assert.equal(tabPrevented, true);
  assert.equal(document.activeElement, first);

  document.dispatch("focusin", { target: background });
  assert.equal(document.activeElement, close);
  cleanup();
  assert.equal(document.body.style.overflow, "clip");
  assert.equal(document.activeElement, prior);

  document.activeElement = background;
  document.dispatch("focusin", { target: background });
  assert.equal(document.activeElement, background);
});
