// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync, existsSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { createRequire } from "node:module";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { dirname, resolve } from "node:path";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);

// Execute real TS/TSX modules with only the specified external dependencies mocked.
export function loadTsModule<T>(entry: string, mocks: Record<string, unknown> = {}): T {
  const cache = new Map<string, { exports: unknown }>();
  const load = (file: string): unknown => {
    file = existsSync(file) ? file : existsSync(`${file}.ts`) ? `${file}.ts` : `${file}.tsx`;
    if (cache.has(file)) return cache.get(file)!.exports;
    const module = { exports: {} };
    cache.set(file, module);
    const localRequire = (id: string): unknown => {
      if (id in mocks) return mocks[id];
      if (id.startsWith("@/")) return load(resolve(root, "src", id.slice(2)));
      if (id.startsWith(".")) return load(resolve(dirname(file), id));
      return require(id);
    };
    const { outputText } = ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    });
    new Function("require", "module", "exports", outputText)(localRequire, module, module.exports);
    return module.exports;
  };
  return load(resolve(root, entry)) as T;
}
