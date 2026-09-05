import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseCatalog } from "./check-i18n.mjs";

const LOCALES_DIR = resolve("src/lib/i18n/locales");
const OUT_DIR = resolve("i18n");
const SOURCE_LANG = "en";
const GENERATED = "crowdin";

async function loadLanguage(lang) {
  const barrel = parseCatalog(await readFile(join(LOCALES_DIR, `${lang}.ts`), "utf8"));
  const table = new Map();
  const files = [barrel];
  for (const spread of barrel.spreads) {
    const spec = barrel.imports.get(spread.name);
    if (!spec) continue;
    const rel = spec.replace(/^\.\//, "");
    if (rel === "ui-fallback") continue;
    files.push(parseCatalog(await readFile(join(LOCALES_DIR, `${rel}.ts`), "utf8")));
  }
  for (const parsed of files) for (const e of parsed.entries) table.set(e.key, e.value);
  return table;
}

async function languages() {
  const names = (await readdir(LOCALES_DIR, { withFileTypes: true }))
    .filter((e) => e.isFile() && e.name.endsWith(".ts") && e.name !== "ui-fallback.ts")
    .map((e) => e.name.slice(0, -3));
  return names.sort();
}

function sortedObject(map) {
  const out = {};
  for (const key of [...map.keys()].sort((a, b) => a.localeCompare(b, "en"))) out[key] = map.get(key);
  return out;
}

async function exportCatalogs() {
  await mkdir(OUT_DIR, { recursive: true });
  const langs = await languages();
  const source = new Map();
  const en = await loadLanguage(SOURCE_LANG);
  for (const [key, value] of en) source.set(key, value);
  const perLang = new Map();
  for (const lang of langs) {
    if (lang === SOURCE_LANG) continue;
    const table = await loadLanguage(lang);
    perLang.set(lang, table);
    for (const key of table.keys()) if (!source.has(key)) source.set(key, key);
  }
  await writeFile(join(OUT_DIR, `${SOURCE_LANG}.json`), JSON.stringify(sortedObject(source), null, 2) + "\n");
  let total = 0;
  for (const [lang, table] of perLang) {
    const filtered = new Map([...table].filter(([key]) => source.has(key)));
    total += filtered.size;
    await writeFile(join(OUT_DIR, `${lang}.json`), JSON.stringify(sortedObject(filtered), null, 2) + "\n");
  }
  console.log(`source: ${source.size} keys -> i18n/${SOURCE_LANG}.json`);
  console.log(`translations: ${perLang.size} languages, ${total} strings -> i18n/<lang>.json`);
}

function tsCatalog(name, entries) {
  const lines = Object.entries(entries).map(
    ([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`,
  );
  return `const ${name}: Record<string, string> = {\n${lines.join("\n")}\n};\n\nexport default ${name};\n`;
}

async function importCatalogs() {
  const files = (await readdir(OUT_DIR)).filter((f) => f.endsWith(".json") && f !== `${SOURCE_LANG}.json`);
  const known = new Set(await languages());
  const added = [];
  for (const file of files) {
    const lang = file.slice(0, -5);
    const entries = JSON.parse(await readFile(join(OUT_DIR, file), "utf8"));
    const filled = Object.fromEntries(Object.entries(entries).filter(([key, value]) => value && value !== key));
    if (Object.keys(filled).length === 0) continue;
    await mkdir(join(LOCALES_DIR, lang), { recursive: true });
    await writeFile(join(LOCALES_DIR, lang, `${GENERATED}.ts`), tsCatalog(GENERATED, filled));
    const barrelPath = join(LOCALES_DIR, `${lang}.ts`);
    if (!known.has(lang) || !existsSync(barrelPath)) {
      await writeFile(
        barrelPath,
        `import uiFallback from "./ui-fallback";\nimport ${GENERATED} from "./${lang}/${GENERATED}";\n\nconst ${lang}: Record<string, string> = {\n  ...uiFallback,\n  ...${GENERATED},\n};\n\nexport default ${lang};\n`,
      );
      added.push(lang);
      continue;
    }
    let barrel = await readFile(barrelPath, "utf8");
    if (!barrel.includes(`./${lang}/${GENERATED}"`)) {
      barrel = barrel.replace(
        /^(import uiFallback from "\.\/ui-fallback";\n)/m,
        `$1import ${GENERATED} from "./${lang}/${GENERATED}";\n`,
      );
      barrel = barrel.replace(/\n\};\n\nexport default/, `\n  ...${GENERATED},\n};\n\nexport default`);
      await writeFile(barrelPath, barrel);
    }
    console.log(`${lang}: ${Object.keys(filled).length} strings -> locales/${lang}/${GENERATED}.ts`);
  }
  if (added.length) {
    console.log(`\nnew languages: ${added.join(", ")}`);
    console.log("register each in src/lib/i18n/languages.ts (code, label, nativeLabel, greeting, rtl) and the UiLanguage union.");
  }
}

const cmd = process.argv[2];
if (cmd === "export") await exportCatalogs();
else if (cmd === "import") await importCatalogs();
else {
  console.error("usage: node scripts/i18n-crowdin.mjs export|import");
  process.exit(1);
}
