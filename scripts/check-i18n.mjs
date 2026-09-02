import { readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

const LOCALES_DIR = resolve("src/lib/i18n/locales");
const SOURCE_LANG = "en";
const PLURAL_LANGS = {
  ar: true,
  de: true,
  es: true,
  fr: true,
  hi: true,
  id: true,
  it: true,
  ja: true,
  ko: true,
  pl: true,
  pt: true,
  ru: true,
  tr: true,
  vi: true,
  zh: true,
};
const VARIANT_SUFFIX = /#(?:one|few|many)$/;
const DOT_KEY = /^[a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)+$/;
const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;
const DOUBLE_BRACE = /\{\{|\}\}/;
const SEP = String.fromCharCode(1);

const SIMPLE_ESCAPES = new Map([
  ["n", String.fromCharCode(10)],
  ["t", String.fromCharCode(9)],
  ["r", String.fromCharCode(13)],
  ["b", String.fromCharCode(8)],
  ["f", String.fromCharCode(12)],
  ["v", String.fromCharCode(11)],
  ["0", String.fromCharCode(0)],
]);

function hasTab(text) {
  return text.indexOf(String.fromCharCode(9)) !== -1;
}

function unescapeString(raw) {
  let out = "";
  let i = 0;
  while (i < raw.length) {
    const c = raw[i];
    if (c !== "\\") {
      out += c;
      i += 1;
      continue;
    }
    const next = raw[i + 1];
    if (next === undefined) {
      out += c;
      break;
    }
    if (next === "u" && raw[i + 2] === "{") {
      const end = raw.indexOf("}", i + 3);
      if (end !== -1) {
        out += String.fromCodePoint(Number.parseInt(raw.slice(i + 3, end), 16));
        i = end + 1;
        continue;
      }
    }
    if (next === "u" && /^[0-9a-fA-F]{4}$/.test(raw.slice(i + 2, i + 6))) {
      out += String.fromCharCode(Number.parseInt(raw.slice(i + 2, i + 6), 16));
      i += 6;
      continue;
    }
    if (next === "x" && /^[0-9a-fA-F]{2}$/.test(raw.slice(i + 2, i + 4))) {
      out += String.fromCharCode(Number.parseInt(raw.slice(i + 2, i + 4), 16));
      i += 4;
      continue;
    }
    out += SIMPLE_ESCAPES.has(next) ? SIMPLE_ESCAPES.get(next) : next;
    i += 2;
  }
  return out;
}

function tokenize(sourceRaw) {
  const src = sourceRaw.split(String.fromCharCode(13, 10)).join(String.fromCharCode(10));
  const NL = String.fromCharCode(10);
  const n = src.length;
  const tokens = [];
  let line = 1;
  let i = 0;
  while (i < n) {
    const c = src[i];
    if (c === NL) {
      line += 1;
      i += 1;
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      while (i < n && src[i] !== NL) i += 1;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) {
        if (src[i] === NL) line += 1;
        i += 1;
      }
      i += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      const startLine = line;
      let j = i + 1;
      let buf = "";
      let closed = false;
      while (j < n) {
        const d = src[j];
        if (d === "\\") {
          buf += src.slice(j, j + 2);
          j += 2;
          continue;
        }
        if (d === c) {
          closed = true;
          break;
        }
        if (d === NL) break;
        buf += d;
        j += 1;
      }
      if (!closed) {
        i += 1;
        continue;
      }
      tokens.push({ t: "str", v: unescapeString(buf), line: startLine });
      i = j + 1;
      continue;
    }
    if (c === "{" || c === "}" || c === ":" || c === "," || c === ".") {
      tokens.push({ t: c, line });
      i += 1;
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_$]/.test(src[j])) j += 1;
      tokens.push({ t: "id", v: src.slice(i, j), line });
      i = j;
      continue;
    }
    i += 1;
  }
  return tokens;
}

export function parseCatalog(sourceRaw) {
  const tokens = tokenize(sourceRaw);
  const entries = [];
  const spreads = [];
  const imports = new Map();
  let depth = 0;
  for (let k = 0; k < tokens.length; k += 1) {
    const tk = tokens[k];
    if (tk.t === "{") {
      depth += 1;
      continue;
    }
    if (tk.t === "}") {
      depth -= 1;
      continue;
    }
    if (depth === 0) {
      if (tk.t === "id" && tk.v === "import") {
        const name = tokens[k + 1];
        const from = tokens[k + 2];
        const spec = tokens[k + 3];
        if (
          name &&
          name.t === "id" &&
          from &&
          from.t === "id" &&
          from.v === "from" &&
          spec &&
          spec.t === "str"
        ) {
          imports.set(name.v, spec.v);
        }
      }
      continue;
    }
    if (depth !== 1) continue;
    const a = tokens[k + 1];
    const b = tokens[k + 2];
    const c = tokens[k + 3];
    if (tk.t === "." && a && a.t === "." && b && b.t === "." && c && c.t === "id") {
      spreads.push({ name: c.v, line: tk.line });
      k += 3;
      continue;
    }
    if (tk.t !== "str" && tk.t !== "id") continue;
    if (!a || a.t !== ":" || !b || b.t !== "str") continue;
    entries.push({ key: tk.v, value: b.v, line: tk.line });
    k += 2;
  }
  return { entries, spreads, imports };
}

function placeholders(value) {
  return [...String(value).matchAll(PLACEHOLDER)].map((m) => m[1]).sort();
}

async function loadLanguage(lang) {
  const barrel = parseCatalog(await readFile(join(LOCALES_DIR, `${lang}.ts`), "utf8"));
  const table = new Map();
  const origin = new Map();
  const duplicates = [];
  const unresolved = [];
  const files = [{ file: `${lang}.ts`, parsed: barrel }];
  for (const spread of barrel.spreads) {
    const spec = barrel.imports.get(spread.name);
    if (!spec) {
      unresolved.push(spread.name);
      continue;
    }
    const rel = spec.replace(/^\.\//, "");
    files.push({
      file: `${rel}.ts`,
      parsed: parseCatalog(await readFile(join(LOCALES_DIR, `${rel}.ts`), "utf8")),
    });
  }
  for (const { file, parsed } of files) {
    for (const entry of parsed.entries) {
      if (origin.has(entry.key))
        duplicates.push({ key: entry.key, first: origin.get(entry.key), again: file });
      origin.set(entry.key, file);
      table.set(entry.key, { key: entry.key, value: entry.value, line: entry.line, file });
    }
  }
  const spreadNames = new Set(barrel.spreads.map((s) => s.name));
  const declared = new Set(
    [...barrel.imports.entries()]
      .filter(([name]) => spreadNames.has(name))
      .map(([, spec]) => spec.replace(/^\.\//, "")),
  );
  return { lang, table, duplicates, declared, unresolved };
}

async function discoverLanguages() {
  const names = (await readdir(LOCALES_DIR, { withFileTypes: true }))
    .filter((e) => e.isFile() && e.name.endsWith(".ts") && e.name !== "ui-fallback.ts")
    .map((e) => e.name.slice(0, -3));
  return names.sort((a, b) =>
    a === SOURCE_LANG ? -1 : b === SOURCE_LANG ? 1 : a.localeCompare(b),
  );
}

async function orphanLeaves(lang, declared) {
  let listing;
  try {
    listing = await readdir(join(LOCALES_DIR, lang));
  } catch {
    return [];
  }
  return listing
    .filter((f) => f.endsWith(".ts"))
    .map((f) => `${lang}/${f.slice(0, -3)}`)
    .filter((name) => !declared.has(name));
}

async function collect() {
  const languages = await discoverLanguages();
  const loaded = new Map();
  for (const lang of languages) loaded.set(lang, await loadLanguage(lang));
  const source = loaded.get(SOURCE_LANG);
  const defects = [];
  const hygiene = [];
  if (!source)
    defects.push(`${SOURCE_LANG}.ts is required as the source catalog for dot-style keys`);

  for (const lang of languages) {
    const state = loaded.get(lang);
    for (const name of state.unresolved) {
      defects.push(`${lang}.ts: spread of ${name} has no matching import`);
    }
    for (const name of await orphanLeaves(lang, state.declared)) {
      defects.push(`${lang}: ${name}.ts exists on disk but is never spread into ${lang}.ts`);
    }
    for (const [key, entry] of state.table) {
      const where = `${entry.file}:${entry.line}`;
      if (hasTab(key)) {
        defects.push(
          `${where}: key holds a tab so no call site can ever match it: ${JSON.stringify(key)}`,
        );
        continue;
      }
      if (DOUBLE_BRACE.test(key) || DOUBLE_BRACE.test(entry.value)) {
        defects.push(
          `${where}: doubled brace never interpolates and leaves a literal brace: ${JSON.stringify(key)}`,
        );
      }
      if (lang === SOURCE_LANG) continue;
      const base = key.replace(VARIANT_SUFFIX, "");
      if (VARIANT_SUFFIX.test(key) && !(lang in PLURAL_LANGS)) {
        defects.push(
          `${where}: plural variant key in a language with no plural rule: ${JSON.stringify(key)}`,
        );
        continue;
      }
      let expected;
      if (DOT_KEY.test(base)) {
        const src = source && source.table.get(base);
        if (!src) {
          defects.push(
            `${where}: dot-style key is absent from ${SOURCE_LANG}.ts: ${JSON.stringify(base)}`,
          );
          continue;
        }
        expected = placeholders(src.value);
      } else {
        expected = placeholders(base);
      }
      const actual = placeholders(entry.value);
      if (expected.join(SEP) !== actual.join(SEP)) {
        defects.push(
          `${where}: placeholders [${actual}] do not match source [${expected}] for ${JSON.stringify(base)}`,
        );
      }
    }
    for (const dup of state.duplicates) {
      hygiene.push(
        `${lang}: ${JSON.stringify(dup.key)} is defined in ${dup.first} and again in ${dup.again}`,
      );
    }
  }

  const translated = languages.filter((l) => l !== SOURCE_LANG);
  const clean = new Map();
  for (const lang of translated) {
    const keys = new Set();
    for (const key of loaded.get(lang).table.keys()) {
      if (hasTab(key)) continue;
      if (VARIANT_SUFFIX.test(key)) continue;
      keys.add(key);
    }
    clean.set(lang, keys);
  }
  const union = new Set();
  for (const keys of clean.values()) for (const key of keys) union.add(key);
  const coverage = translated.map((lang) => {
    const keys = clean.get(lang);
    const missing = [...union].filter((key) => !keys.has(key)).sort();
    const pct = union.size ? ((union.size - missing.length) / union.size) * 100 : 100;
    return { lang, have: keys.size, missing, pct };
  });

  return { languages, loaded, defects, hygiene, coverage, union };
}

async function run(argv) {
  const strict = argv.includes("--strict");
  const asJson = argv.includes("--json");
  const listMissing = argv.includes("--list-missing");
  const listDuplicates = argv.includes("--list-duplicates");
  const maxArg = argv.find((a) => a.startsWith("--max-missing="));
  const maxMissing = maxArg ? Number.parseInt(maxArg.slice("--max-missing=".length), 10) : null;

  const { languages, loaded, defects, hygiene, coverage, union } = await collect();
  const totalMissing = coverage.reduce((sum, c) => sum + c.missing.length, 0);

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          languages,
          union: union.size,
          totalMissing,
          defects,
          duplicates: listDuplicates ? hygiene : hygiene.length,
          coverage: coverage.map((c) => ({
            lang: c.lang,
            have: c.have,
            missing: c.missing.length,
            pct: Number(c.pct.toFixed(2)),
            keys: listMissing ? c.missing : undefined,
          })),
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`Catalogs: ${languages.map((l) => `${l} ${loaded.get(l).table.size}`).join(", ")}`);
    console.log(
      `Comparable union across ${coverage.map((c) => c.lang).join(", ")}: ${union.size} keys`,
    );
    for (const c of coverage) {
      console.log(
        `  ${c.lang}: ${c.have} present, ${c.missing.length} missing, ${c.pct.toFixed(1)} percent of union`,
      );
    }
    if (listMissing) {
      for (const c of coverage) {
        if (!c.missing.length) continue;
        console.log("");
        console.log(`${c.lang} missing ${c.missing.length}:`);
        for (const key of c.missing) console.log(`  ${JSON.stringify(key)}`);
      }
    }
    console.log("");
    if (defects.length) {
      console.log(`${defects.length} defects:`);
      for (const d of defects) console.log(`  ${d}`);
    } else {
      console.log("No defects.");
    }
    if (hygiene.length) {
      console.log("");
      console.log(
        `${hygiene.length} shadowed duplicate keys, reported but never fatal. Use --list-duplicates to see them.`,
      );
      if (listDuplicates) for (const h of hygiene) console.log(`  ${h}`);
    }
  }

  let failed = false;
  if (strict && defects.length) {
    console.error(`check-i18n: ${defects.length} defects and --strict was set.`);
    failed = true;
  }
  if (maxMissing !== null && totalMissing > maxMissing) {
    console.error(`check-i18n: ${totalMissing} missing keys exceeds --max-missing=${maxMissing}.`);
    failed = true;
  }
  process.exitCode = failed ? 1 : 0;
  return { defects, hygiene, coverage, union };
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) await run(process.argv.slice(2));

export { run, collect, LOCALES_DIR };
