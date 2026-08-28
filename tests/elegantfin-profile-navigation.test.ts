// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import ts from "typescript";
import { requestOpenProfile, subscribeOpenProfile } from "../src/lib/social/open-profile.ts";
import { WINDOW_HARBOR } from "../src/views/settings/theme-panel/theme-studio/cheat-sheet-data.ts";

const appText = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const appSource = ts.createSourceFile(
  "App.tsx",
  appText,
  ts.ScriptTarget.ESNext,
  true,
  ts.ScriptKind.TSX,
);

function variableInitializer(name: string): string {
  let initializer: string | undefined;
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer
    ) {
      initializer = node.initializer.getText(appSource);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(appSource);
  assert.ok(initializer, name + " initializer");
  return initializer;
}

function propertyInitializer(name: string): string {
  let initializer: string | undefined;
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && node.name.text === name) {
      initializer = node.initializer.getText(appSource);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(appSource);
  assert.ok(initializer, name + " property");
  return initializer;
}

function harborExposesShorthandProperty(name: string): boolean {
  let exposed = false;
  const visit = (node: ts.Node): void => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      node.left.getText(appSource) === "w.harbor" &&
      ts.isObjectLiteralExpression(node.right)
    ) {
      exposed = node.right.properties.some(
        (property) => ts.isShorthandPropertyAssignment(property) && property.name.text === name,
      );
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(appSource);
  return exposed;
}

type CurrentAuthor = () => { handle?: string | null } | null;

function buildTryViewMyProfile(currentAuthor: CurrentAuthor): () => boolean {
  return new Function(
    "currentAuthor",
    "requestOpenProfile",
    '"use strict"; return (' + variableInitializer("tryViewMyProfile") + ");",
  )(currentAuthor, requestOpenProfile) as () => boolean;
}

function buildViewMyProfile(
  tryViewMyProfile: () => boolean,
  fetchMe: () => Promise<unknown>,
): () => Promise<void> {
  return new Function(
    "tryViewMyProfile",
    "fetchMe",
    '"use strict"; return (' + propertyInitializer("viewMyProfile") + ");",
  )(tryViewMyProfile, fetchMe) as () => Promise<void>;
}

test("tryViewMyProfile returns false without a usable handle", () => {
  const opened: string[] = [];
  const unsubscribe = subscribeOpenProfile((handle) => opened.push(handle));
  try {
    for (const author of [null, { handle: null }, { handle: "" }, { handle: "   " }]) {
      assert.equal(buildTryViewMyProfile(() => author)(), false);
    }
    assert.deepEqual(opened, []);
  } finally {
    unsubscribe();
  }
});

test("tryViewMyProfile requests the normalized current handle once", () => {
  const opened: string[] = [];
  const unsubscribe = subscribeOpenProfile((handle) => opened.push(handle));
  try {
    assert.equal(buildTryViewMyProfile(() => ({ handle: "  Alice  " }))(), true);
    assert.deepEqual(opened, ["alice"]);
  } finally {
    unsubscribe();
  }
});

test("Harbor bridge exposes the immediate profile helper", () => {
  assert.equal(harborExposesShorthandProperty("tryViewMyProfile"), true);
});

test("viewMyProfile skips fetch when immediate navigation succeeds", async () => {
  let attempts = 0;
  let fetches = 0;
  const viewMyProfile = buildViewMyProfile(
    () => {
      attempts += 1;
      return true;
    },
    async () => {
      fetches += 1;
    },
  );

  await viewMyProfile();
  assert.equal(attempts, 1);
  assert.equal(fetches, 0);
});

test("viewMyProfile fetches once and retries the immediate helper", async () => {
  let ready = false;
  let attempts = 0;
  let fetches = 0;
  const viewMyProfile = buildViewMyProfile(
    () => {
      attempts += 1;
      return ready;
    },
    async () => {
      fetches += 1;
      ready = true;
    },
  );

  await viewMyProfile();
  assert.equal(attempts, 2);
  assert.equal(fetches, 1);
});

test("viewMyProfile preserves the swallowed fetch-failure contract", async () => {
  let attempts = 0;
  const viewMyProfile = buildViewMyProfile(
    () => {
      attempts += 1;
      return false;
    },
    async () => {
      throw new Error("offline");
    },
  );

  await assert.doesNotReject(viewMyProfile());
  assert.equal(attempts, 2);
});

test("Theme Studio documents the immediate boolean profile API", () => {
  assert.deepEqual(
    WINDOW_HARBOR.find((entry) => entry.call === "window.harbor.tryViewMyProfile()"),
    {
      call: "window.harbor.tryViewMyProfile()",
      desc: "Open the signed-in user's own Harbor profile immediately when its handle is loaded. Returns true when navigation starts and false otherwise.",
    },
  );
});

type Listener = (event: unknown) => void;
type ImmediateApi = { tryViewMyProfile?: () => unknown };

function elegantFinScript(): string {
  const themeText = readFileSync(new URL("../src/lib/theme.ts", import.meta.url), "utf8");
  const themeSource = ts.createSourceFile(
    "theme.ts",
    themeText,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TS,
  );
  let script: string | undefined;
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "elegantFinJs" &&
      ts.isNoSubstitutionTemplateLiteral(node.initializer)
    ) {
      script = node.initializer.text;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(themeSource);
  assert.ok(script, "elegantFinJs template");
  return script;
}

function mountElegantFin(api?: ImmediateApi) {
  const tokens = new Set<string>();
  const classList = {
    add: (...names: string[]) => names.forEach((name) => tokens.add(name)),
    remove: (...names: string[]) => names.forEach((name) => tokens.delete(name)),
    contains: (name: string) => tokens.has(name),
    toggle: (name: string) => {
      if (tokens.has(name)) {
        tokens.delete(name);
        return false;
      }
      tokens.add(name);
      return true;
    },
  };
  const documentListeners = new Map<string, Set<Listener>>();
  const windowListeners = new Map<string, Set<Listener>>();
  const clearedIntervals = new Set<number>();
  const add = (listenersByType: Map<string, Set<Listener>>, type: string, listener: Listener) => {
    const listeners = listenersByType.get(type) ?? new Set<Listener>();
    listeners.add(listener);
    listenersByType.set(type, listeners);
  };
  const remove = (
    listenersByType: Map<string, Set<Listener>>,
    type: string,
    listener: Listener,
  ) => {
    listenersByType.get(type)?.delete(listener);
  };
  const documentStub = {
    documentElement: { classList },
    querySelector: () => null,
    getElementById: () => null,
    createElement: (tag: string) => {
      throw new Error("Unexpected createElement(" + tag + ")");
    },
    addEventListener: (type: string, listener: Listener) => add(documentListeners, type, listener),
    removeEventListener: (type: string, listener: Listener) =>
      remove(documentListeners, type, listener),
  };
  type ThemeWindow = {
    harbor?: ImmediateApi;
    __efChromeCleanup?: () => void;
    __harborThemeCleanup?: () => void;
    setInterval: (listener: () => void, delay: number) => number;
    clearInterval: (id: number) => void;
    addEventListener: (type: string, listener: Listener) => void;
    removeEventListener: (type: string, listener: Listener) => void;
  };
  const windowStub: ThemeWindow = {
    harbor: api,
    setInterval: () => 41,
    clearInterval: (id) => clearedIntervals.add(id),
    addEventListener: (type, listener) => add(windowListeners, type, listener),
    removeEventListener: (type, listener) => remove(windowListeners, type, listener),
  };

  new Function("window", "document", elegantFinScript())(windowStub, documentStub);

  const click = (selector: string) => {
    const target = {
      closest(candidate: string) {
        return candidate === selector ? target : null;
      },
    };
    for (const listener of documentListeners.get("click") ?? []) {
      listener({
        target,
        preventDefault() {},
        stopPropagation() {},
      });
    }
  };

  return {
    click,
    drawerOpen: () => classList.contains("ef-drawer-open"),
    setDrawerOpen: (open: boolean) =>
      open ? classList.add("ef-drawer-open") : classList.remove("ef-drawer-open"),
    cleanup: () => windowStub.__harborThemeCleanup?.(),
    clickListenerCount: () => documentListeners.get("click")?.size ?? 0,
    keyListenerCount: () => windowListeners.get("keydown")?.size ?? 0,
    intervalWasCleared: () => clearedIntervals.has(41),
  };
}

test("ElegantFin menu remains the independent drawer toggle", () => {
  const harness = mountElegantFin({});
  harness.click("#ef-menu");
  assert.equal(harness.drawerOpen(), true);
  harness.click("#ef-menu");
  assert.equal(harness.drawerOpen(), false);
  harness.cleanup();
});

test("ElegantFin cleanup removes drawer state and listeners", () => {
  const harness = mountElegantFin({});
  harness.setDrawerOpen(true);
  harness.cleanup();
  assert.equal(harness.drawerOpen(), false);
  assert.equal(harness.clickListenerCount(), 0);
  assert.equal(harness.keyListenerCount(), 0);
  assert.equal(harness.intervalWasCleared(), true);
  harness.click("#ef-menu");
  assert.equal(harness.drawerOpen(), false);
});

test("ElegantFin avatar closes the drawer when immediate navigation succeeds", () => {
  let calls = 0;
  const harness = mountElegantFin({
    tryViewMyProfile: () => {
      calls += 1;
      return true;
    },
  });
  harness.setDrawerOpen(true);
  harness.click("#ef-profile");
  assert.equal(calls, 1);
  assert.equal(harness.drawerOpen(), false);
  harness.cleanup();
});

test("ElegantFin avatar opens the drawer when no loaded profile is available", () => {
  let calls = 0;
  const harness = mountElegantFin({
    tryViewMyProfile: () => {
      calls += 1;
      return false;
    },
  });
  harness.click("#ef-profile");
  assert.equal(calls, 1);
  assert.equal(harness.drawerOpen(), true);
  harness.cleanup();
});

test("ElegantFin avatar falls back when the immediate API is missing", () => {
  const harness = mountElegantFin({});
  harness.click("#ef-profile");
  assert.equal(harness.drawerOpen(), true);
  harness.cleanup();
});

test("ElegantFin avatar catches immediate API failures and opens the drawer", () => {
  let calls = 0;
  const harness = mountElegantFin({
    tryViewMyProfile: () => {
      calls += 1;
      throw new Error("broken bridge");
    },
  });
  assert.doesNotThrow(() => harness.click("#ef-profile"));
  assert.equal(calls, 1);
  assert.equal(harness.drawerOpen(), true);
  harness.cleanup();
});

test("ElegantFin treats non-boolean API results as drawer fallback", () => {
  const harness = mountElegantFin({
    tryViewMyProfile: () => "not-the-boolean-contract",
  });
  harness.click("#ef-profile");
  assert.equal(harness.drawerOpen(), true);
  harness.cleanup();
});
