import { readFileSync } from "node:fs";
import ts from "typescript";

export function castOwnershipFixture() {
  const source = readFileSync(new URL("../../src/lib/cast-ownership.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", output)(module, module.exports);
  return module.exports as typeof import("../../src/lib/cast-ownership.ts");
}
