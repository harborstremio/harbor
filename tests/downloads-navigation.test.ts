import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { navigateUnderPreview, previewPageStack } from "../src/lib/player/docked-navigation.ts";
import { heroDockSupported, isHubKind, setHeroDock } from "../src/lib/hero-dock.ts";

const source = ts.createSourceFile(
  "view.tsx",
  readFileSync(new URL("../src/lib/view.tsx", import.meta.url), "utf8"),
  ts.ScriptTarget.ESNext,
  true,
  ts.ScriptKind.TSX,
);

function declaration(name: string): string {
  let text = "";
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) text = node.getText(source);
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) {
      text = `const ${node.getText(source)};`;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(text, `Missing view declaration: ${name}`);
  return text;
}

function fixture(initial: any[]) {
  const stackRef = { current: initial };
  const forwardStackRef = { current: [] as any[] };
  const scrollMem = { current: new Map([["meta:movie", { fallback: 420 }]]) };
  const rowScrollMem = { current: new Map([["home:popular", 560]]) };
  const names = ["STACK_MAX", "pushFrame", "pop", "goForward", "clearForwardStack", "setNavStack", "setView"];
  const code = ts.transpileModule(names.map(declaration).join("\n"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const scope = {
    stackRef, forwardStackRef, scrollMem, rowScrollMem, navigateUnderPreview, previewPageStack,
    heroDockSupported, isHubKind, setHeroDock,
    useCallback: (fn: any) => fn,
    consumeBack: () => false,
    setStack: (value: any) => { stackRef.current = typeof value === "function" ? value(stackRef.current) : value; },
    setForwardStack: (value: any[]) => { forwardStackRef.current = value; },
    setHomeResetTick: () => {},
    window: { dispatchEvent() {}, requestAnimationFrame() {}, setTimeout() {} },
    CustomEvent: class { constructor(_name: string, _options: unknown) {} },
  };
  const nav = new Function(...Object.keys(scope), `${code}\nreturn {setView, pop, goForward};`)(...Object.values(scope));
  return { ...nav, stackRef, scrollMem, rowScrollMem, forwardStackRef };
}

test("Downloads returns to the previous detail with its page and row scroll memories intact", () => {
  const previous = [{ kind: "home" }, { kind: "meta", meta: { id: "movie" } }];
  const h = fixture(previous);
  h.setView("downloads");
  assert.deepEqual(h.stackRef.current, [...previous, { kind: "downloads" }]);
  assert.equal(h.scrollMem.current.get("meta:movie")?.fallback, 420);
  assert.equal(h.rowScrollMem.current.get("home:popular"), 560);
  h.pop();
  assert.deepEqual(h.stackRef.current, previous);
  h.goForward();
  assert.equal(h.stackRef.current.at(-1).kind, "downloads");
});

test("reselecting Downloads does not stack duplicate pages", () => {
  const h = fixture([{ kind: "home" }]);
  h.setView("downloads");
  h.setView("downloads");
  h.pop();
  assert.deepEqual(h.stackRef.current, [{ kind: "home" }]);
});

test("opening and leaving Downloads keeps a docked sports player mounted", () => {
  const dock = { kind: "player", src: { sportsDocked: true, url: "fixture-stream" } };
  const h = fixture([{ kind: "sports" }, dock]);
  h.setView("downloads");
  assert.deepEqual(h.stackRef.current.map((f: any) => f.kind), ["sports", "downloads", "player"]);
  assert.equal(h.stackRef.current.at(-1), dock);
  h.pop();
  assert.deepEqual(h.stackRef.current, [{ kind: "sports" }, dock]);
});

test("leaving Downloads through primary navigation retains the existing root reset behavior", () => {
  const h = fixture([{ kind: "home" }, { kind: "downloads" }]);
  h.setView("movies");
  assert.deepEqual(h.stackRef.current, [{ kind: "movies" }]);
  assert.equal(h.scrollMem.current.size, 0);
  assert.equal(h.rowScrollMem.current.size, 0);
});
