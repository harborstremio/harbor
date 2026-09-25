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

  // UiIcon consumes real SVG strings through Vite's ?raw import. Preserve that
  // asset boundary when exercising the same action renderer in Node tests.
  if (sourcePath && specifier.endsWith(".svg?raw")) {
    const rawPath = sourcePath.endsWith("?raw") ? sourcePath.slice(0, -4) : sourcePath;
    return { url: `${pathToFileURL(rawPath).href}?raw`, shortCircuit: true };
  }

  if (sourcePath && !path.extname(sourcePath)) {
    const url = await existingModuleUrl(sourcePath);
    if (url) return { url, shortCircuit: true };
  }

  if (sourcePath && /\.(?:png|jpe?g|webp|gif|svg|css|json)$/.test(sourcePath)) {
    return { url: pathToFileURL(sourcePath).href, shortCircuit: true };
  }

  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  // DOM behavior tests do not parse stylesheets; visual tests load them in Vite.
  if (url.endsWith(".css")) {
    return { format: "module", source: "export {};", shortCircuit: true };
  }
  if (url.endsWith(".svg?raw")) {
    const source = await readFile(fileURLToPath(new URL(url)), "utf8");
    return {
      format: "module",
      source: `export default ${JSON.stringify(source)};`,
      shortCircuit: true,
    };
  }
  if (/\.(?:png|jpe?g|webp|gif|svg)$/.test(url)) {
    return {
      format: "module",
      source: `export default ${JSON.stringify(url)};`,
      shortCircuit: true,
    };
  }
  if (url.endsWith(".json")) {
    const source = await readFile(fileURLToPath(url), "utf8");
    return { format: "module", source: `export default ${source};`, shortCircuit: true };
  }
  if (url.endsWith(".tsx") || url.endsWith(".ts")) {
    const source = await readFile(fileURLToPath(url), "utf8");
    if (!url.endsWith(".tsx") && !source.includes("import.meta.env")) return nextLoad(url, context);
    const output = ts.transpileModule(source, {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
      transformers: {
        before: [
          (transformContext) => (root) => {
            const visit = (node) => {
              if (
                ts.isPropertyAccessExpression(node) &&
                node.name.text === "env" &&
                ts.isMetaProperty(node.expression) &&
                node.expression.keywordToken === ts.SyntaxKind.ImportKeyword
              ) {
                // Node has no Vite environment. Keep app defaults deterministic;
                // tests needing overrides must provide them in their own fixture.
                return ts.factory.createObjectLiteralExpression([
                  ts.factory.createPropertyAssignment(
                    "MODE",
                    ts.factory.createStringLiteral("test"),
                  ),
                  ts.factory.createPropertyAssignment("DEV", ts.factory.createFalse()),
                  ts.factory.createPropertyAssignment("PROD", ts.factory.createFalse()),
                ]);
              }
              return ts.visitEachChild(node, visit, transformContext);
            };
            return ts.visitNode(root, visit);
          },
        ],
      },
    });
    return { format: "module", source: output.outputText, shortCircuit: true };
  }

  return nextLoad(url, context);
}
