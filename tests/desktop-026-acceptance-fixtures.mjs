import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

export function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  let failing = null;
  return {
    values,
    get length() {
      return values.size;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    failOnce(key) {
      failing = key;
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      if (key === failing) {
        failing = null;
        throw new Error("Synthetic storage quota");
      }
      values.set(key, String(value));
    },
    removeItem(key) {
      if (key === failing) {
        failing = null;
        throw new Error("Synthetic storage quota");
      }
      values.delete(key);
    },
  };
}

/** Real source, with only its external ports replaced; no network or native calls escape. */
export function loadSource(path, mocks = {}, globals = {}) {
  const exports = {};
  const source = readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
  const code = ts.transpileModule(
    Object.hasOwn(globals, "__buildEnv")
      ? source.replaceAll("import.meta.env", "__buildEnv")
      : source,
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
  const names = Object.keys(globals);
  new Function("require", "exports", ...names, code)(
    (key) => {
      assert.ok(Object.hasOwn(mocks, key), `Unexpected dependency in ${path}: ${key}`);
      return mocks[key];
    },
    exports,
    ...Object.values(globals),
  );
  return exports;
}

export function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
