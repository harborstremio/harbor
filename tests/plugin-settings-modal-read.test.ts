import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const MODAL_PATH = "src/views/settings/plugins-panel/plugin-settings-modal.tsx";
const TRANSLATE_PATH = "src/lib/i18n/translate.ts";
const MODAL = readFileSync(MODAL_PATH, "utf8");
const TRANSLATE = readFileSync(TRANSLATE_PATH, "utf8");

/** The dependency list of every `useEffect` in the file, in order. */
function effectDeps(): string[][] {
  const source = ts.createSourceFile(MODAL_PATH, MODAL, ts.ScriptTarget.ES2022, true);
  const out: string[][] = [];
  const walk = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "useEffect" &&
      node.arguments[1] &&
      ts.isArrayLiteralExpression(node.arguments[1])
    ) {
      out.push(node.arguments[1].elements.map((e) => e.getText(source)));
    }
    ts.forEachChild(node, walk);
  };
  walk(source);
  return out;
}

test("useT hands back a new function every render, so it cannot be an effect dependency", () => {
  // A dependency that changes on every render restarts the effect that lists it, and an effect
  // that sets state renders again — so listing this one is a loop, not a refresh.
  assert.match(
    TRANSLATE,
    /export function useT\(\)[\s\S]*?return \(key: string, vars\?: Vars\) =>/,
    "useT builds its function inside the hook body, so its identity is per-render",
  );
});

test("reading a plugin's settings does not depend on the translation function", () => {
  const deps = effectDeps();
  assert.ok(deps.length > 0, "the modal reads its fields in an effect");
  for (const list of deps) {
    assert.ok(
      !list.includes("t"),
      `an effect depends on t (${list.join(", ")}), which would restart it on every render`,
    );
  }
});

test("a failure is still reported in the language on screen", () => {
  // Held in a ref rather than dropped, so the sentence is not left in whatever language was active
  // when the modal opened.
  assert.match(MODAL, /const tRef = useRef\(t\)/, "the current translation is held");
  assert.match(MODAL, /tRef\.current = t;/, "and kept current across renders");
  assert.match(
    MODAL,
    /const say = tRef\.current;[\s\S]*?say\("This plugin's settings form failed to load/,
    "the failure message is written in the language on screen, not the one from when it opened",
  );
});

test("the form's own buttons are still rendered with the live translation", () => {
  // The ref is only for the effect. Rendering must keep re-reading t, or a language change would
  // leave the modal half-translated.
  assert.match(MODAL, /\{t\("Cancel"\)\}/, "the dismiss button re-reads t");
  assert.match(MODAL, /t\("Save"\)/, "and so does the save button");
  assert.match(MODAL, /t\("Loading plugins\.\.\."\)/, "and the loading line");
});
