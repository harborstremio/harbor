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

  if (sourcePath && !path.extname(sourcePath)) {
    const url = await existingModuleUrl(sourcePath);
    if (url) return { url, shortCircuit: true };
  }

  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".tsx")) {
    const source = await readFile(fileURLToPath(url), "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    });
    return { format: "module", source: output.outputText, shortCircuit: true };
  }

  return nextLoad(url, context);
}
