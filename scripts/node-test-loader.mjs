import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extensions = [".ts", ".tsx", ".js", ".mjs"];

async function existingModuleUrl(basePath) {
  const candidates = [
    basePath,
    ...extensions.map((extension) => `${basePath}${extension}`),
    ...extensions.map((extension) => path.join(basePath, `index${extension}`)),
  ];

  for (const candidate of candidates) {
    try {
      if ((await stat(candidate)).isFile()) return pathToFileURL(candidate).href;
    } catch {
      // Continue until a matching source module is found.
    }
  }

  return null;
}

export async function resolve(specifier, context, nextResolve) {
  let sourcePath = null;

  if (specifier.startsWith("@/")) {
    sourcePath = path.join(root, "src", specifier.slice(2));
  } else if (specifier.startsWith(".") && context.parentURL) {
    sourcePath = fileURLToPath(new URL(specifier, context.parentURL));
  }

  if (sourcePath && (!path.extname(sourcePath) || specifier.startsWith("@/"))) {
    const url = await existingModuleUrl(sourcePath);
    if (url) return { url, shortCircuit: true };
  }

  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  // Vite handles asset imports at build time; under Node return an empty
  // string so theme/asset chains (import.meta.env consumers aside) load.
  if (/\.(png|jpe?g|gif|webp|svg|css|woff2?)$/.test(url)) {
    return { format: "module", source: "export default ''", shortCircuit: true };
  }

  const isTsx = url.endsWith(".tsx");
  if (isTsx || url.endsWith(".ts")) {
    // Node strips types but rejects TS-only runtime syntax (parameter
    // properties, enums) that provider clients use, so transpile instead of
    // relying on strip-only mode. .tsx needed the same treatment for JSX.
    let source = await readFile(fileURLToPath(url), "utf8");
    // Vite injects import.meta.env at build time; under Node it is undefined
    // and module-scope config constants would throw. Swap in an empty object
    // so every endpoint/config falls back to its hardcoded default.
    source = source.replace(/\bimport\.meta\.env\b/g, "(globalThis.__harborTestEnv ?? {})");
    const output = ts.transpileModule(source, {
      compilerOptions: {
        // JSX only for .tsx: parsing JSX in plain .ts mangles single-generic
        // arrows like <T,>(x) => … into JSX elements and emits broken code.
        jsx: isTsx ? ts.JsxEmit.ReactJSX : undefined,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    });
    return { format: "module", source: output.outputText, shortCircuit: true };
  }

  return nextLoad(url, context);
}
