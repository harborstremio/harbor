import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import ts from "typescript";
import { env, pipeline } from "@huggingface/transformers";

const ROOT = resolve("src");
const OUTPUT = resolve("src/lib/i18n/locales/hu/coverage.ts");
const DOM_OUTPUT = resolve("src/lib/i18n/locales/hu/dom.ts");
const CHECKPOINT = resolve(".codex-hu-ai-cache-v4.json");
// Marian's batched decoder occasionally continues short labels with unrelated
// text. Translating one UI string at a time is slower but deterministic.
const BATCH_SIZE = 1;

// Keep ONNX paths below Windows' legacy path-length limit. The repository lives
// in a deliberately descriptive transfer folder, which is too deep for ORT.
env.cacheDir = resolve(process.env.TEMP ?? process.env.TMP ?? ".", "harbor-hu-ai-model");

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      if (!path.includes("\\i18n\\") && !path.includes("/i18n/")) await walk(path, out);
    } else if ([".ts", ".tsx"].includes(extname(entry.name))) {
      out.push(path);
    }
  }
  return out;
}

function uiStrings(source, fileName) {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const values = [];
  const domValues = [];
  const translatableAttributes = new Set(["title", "aria-label", "placeholder", "alt"]);
  const translatableProperties = new Set(["label", "title", "subtitle", "sub", "description", "placeholder"]);
  const normalizeDomText = (value) =>
    value
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
  const addDom = (value) => {
    const normalized = normalizeDomText(value);
    if (/[A-Za-z]{2}/.test(normalized)) domValues.push(normalized);
  };
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      (node.expression.text === "t" || node.expression.text === "tr")
    ) {
      const first = node.arguments[0];
      if (first && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))) values.push(first.text);
    }
    if (ts.isJsxText(node)) addDom(node.text);
    if (
      ts.isJsxAttribute(node) &&
      translatableAttributes.has(node.name.text) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer)
    ) {
      addDom(node.initializer.text);
    }
    if (
      ts.isPropertyAssignment(node) &&
      ((ts.isIdentifier(node.name) && translatableProperties.has(node.name.text)) ||
        (ts.isStringLiteral(node.name) && translatableProperties.has(node.name.text))) &&
      (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer))
    ) {
      addDom(node.initializer.text);
    }
    if (ts.isJsxExpression(node) && node.expression && ts.isConditionalExpression(node.expression)) {
      for (const branch of [node.expression.whenTrue, node.expression.whenFalse]) {
        if (ts.isStringLiteral(branch) || ts.isNoSubstitutionTemplateLiteral(branch)) addDom(branch.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return { values, domValues };
}

function protect(text) {
  const placeholders = [];
  const masked = text.replace(/\{[A-Za-z_][A-Za-z0-9_]*\}/g, (value) => {
    const marker = `ZZHARBORVAR${String.fromCharCode(65 + placeholders.length)}ZZ`;
    placeholders.push([marker, value]);
    return marker;
  });
  return { masked, placeholders };
}

function restore(text, placeholders) {
  let restored = text;
  for (const [marker, value] of placeholders) {
    const pattern = new RegExp(marker, "i");
    if (!pattern.test(restored)) return null;
    restored = restored.replace(pattern, value);
  }
  return restored;
}

function looksCorrupt(source, translated) {
  if (!translated?.trim()) return true;
  if (/\?{3,}|\b(?:NemT|Felszoba)\b|T{5,}|z+sharbor|City name \(optional|unit description in lists/iu.test(translated)) return true;
  // Three dots are a normal loading-state ellipsis; repeated question/exclamation
  // marks and four-or-more dots are generation artifacts.
  if (/(?:[!?]\s*){3,}|\.{4,}/u.test(translated)) return true;
  if (/\b([\p{L}\p{N}]+)(?:[\s,.;:!?]+\1){3,}\b/iu.test(translated)) return true;
  if (translated.length > Math.max(48, source.length * 1.9 + 24)) return true;
  return false;
}

function polish(source, translated) {
  let result = translated.trim().replace(/\s+([,.;:!?])/g, "$1");

  // Marian treats these product terms as ordinary English nouns surprisingly
  // often. In Harbor UI copy they always refer to the app or media concepts.
  if (/\bHarbor\b/.test(source)) {
    result = result
      .replace(/\b[Aa] kikötő\b/g, "a Harbor")
      .replace(/\b[Kk]ikötő(?:ben|ből|be|nek|nél|ről|re|t|je|jét)?\b/g, "Harbor");
  }
  if (/\bplayer\b/i.test(source)) {
    result = result
      .replace(/\bjátékosról\b/gi, "lejátszóról")
      .replace(/\bjátékoshoz\b/gi, "lejátszóhoz")
      .replace(/\bjátékosban\b/gi, "lejátszóban")
      .replace(/\bjátékost\b/gi, "lejátszót")
      .replace(/\bjátékos\b/gi, "lejátszó");
  }
  if (/\bstreams?\b/i.test(source)) {
    result = result
      .replace(/\báramlási\b/gi, "streamelési")
      .replace(/\báramlásokat\b/gi, "streameket")
      .replace(/\báramlások\b/gi, "streamek")
      .replace(/\báramlást\b/gi, "streamet")
      .replace(/\báramlás\b/gi, "streamelés")
      .replace(/\bpatakra\b/gi, "streamre")
      .replace(/\bpatakról\b/gi, "streamről")
      .replace(/\bpatakból\b/gi, "streamből")
      .replace(/\bpatakkal\b/gi, "streammel")
      .replace(/\bpatakokat\b/gi, "streameket")
      .replace(/\bpatakok\b/gi, "streamek")
      .replace(/\bpatakot\b/gi, "streamet")
      .replace(/\bpatak\b/gi, "stream");
  }
  if (/\baddons?\b/i.test(source)) {
    result = result
      .replace(/\badd-?onokat\b/gi, "kiegészítőket")
      .replace(/\badd-?onok\b/gi, "kiegészítők")
      .replace(/\badd-?ont\b/gi, "kiegészítőt")
      .replace(/\badd-?onból\b/gi, "kiegészítőből")
      .replace(/\badd-?onnal\b/gi, "kiegészítővel")
      .replace(/\badden\b/gi, "kiegészítő");
  }
  if (/\bpicker\b/i.test(source)) {
    result = result
      .replace(/\bszedőfejben\b/gi, "forrásválasztó fejlécében")
      .replace(/\bszedőben\b/gi, "forrásválasztóban")
      .replace(/\bszedőből\b/gi, "forrásválasztóból")
      .replace(/\bszedőt\b/gi, "forrásválasztót")
      .replace(/\bszedő\b/gi, "forrásválasztó");
  }
  if (/\bPlay\b/.test(source)) {
    result = result
      .replace(/\bmegüti\b/gi, "megnyomja")
      .replace(/\bmegütöd\b/gi, "megnyomod")
      .replace(/\bmegüt\b/gi, "megnyom")
      .replace(/\bjátékot\b/gi, "Lejátszást")
      .replace(/\bjáték\b/gi, "Lejátszás");
  }
  return result;
}

async function translateBatch(translator, sources, beamCount = 4) {
  const protectedBatch = sources.map(protect);
  const longest = Math.max(...protectedBatch.map((entry) => entry.masked.length));
  const maxNewTokens = Math.min(176, Math.max(14, Math.ceil(longest * 0.6) + 8));
  const results = await translator(protectedBatch.map((entry) => entry.masked), {
    max_new_tokens: maxNewTokens,
    num_beams: beamCount,
    early_stopping: true,
    repetition_penalty: 1.2,
    no_repeat_ngram_size: 3,
  });
  return sources.map((source, index) => {
    const raw = results[index]?.translation_text?.trim();
    const restored = raw ? restore(raw, protectedBatch[index].placeholders) : null;
    return restored ? polish(source, restored) : null;
  });
}

const files = await walk(ROOT);
const extracted = await Promise.all(files.map(async (file) => uiStrings(await readFile(file, "utf8"), file)));
const domStrings = [...new Set(extracted.flatMap((entry) => entry.domValues))]
  .filter((value) => value.trim() && value.length <= 300)
  .sort((a, b) => a.localeCompare(b));
const strings = [...new Set([...extracted.flatMap((entry) => entry.values), ...domStrings])]
  .filter((value) => value.trim() && value.length <= 300)
  .sort((a, b) => a.localeCompare(b));

let cache = {};
try {
  cache = JSON.parse(await readFile(CHECKPOINT, "utf8"));
} catch {}

let discarded = 0;
for (const [source, translated] of Object.entries(cache)) {
  if (looksCorrupt(source, translated)) {
    delete cache[source];
    discarded += 1;
  }
}
console.log(`Discarded ${discarded} suspicious cached translations.`);

console.log(`Loading the local English→Hungarian AI model (${strings.length} UI strings)…`);
const translator = await pipeline("translation", "Xenova/opus-mt-en-hu", { dtype: "q8" });

const pending = strings
  .filter((source) => typeof cache[source] !== "string")
  .sort((a, b) => a.length - b.length || a.localeCompare(b));
for (let start = 0; start < pending.length; start += BATCH_SIZE) {
  const batch = pending.slice(start, start + BATCH_SIZE);
  const translatedBatch = await translateBatch(translator, batch);
  for (let index = 0; index < batch.length; index += 1) {
    const source = batch[index];
    let translated = translatedBatch[index];
    if (looksCorrupt(source, translated)) {
      [translated] = await translateBatch(translator, [source], 5);
    }
    // Keeping English is safer than shipping visibly corrupted or misleading UI.
    cache[source] = looksCorrupt(source, translated) ? source : translated;
  }
  if ((start / BATCH_SIZE) % 10 === 0 || start + BATCH_SIZE >= pending.length) {
    await writeFile(CHECKPOINT, JSON.stringify(cache), "utf8");
    console.log(`Translated ${Math.min(start + BATCH_SIZE, pending.length)}/${pending.length} remaining strings`);
  }
}

const rejected = strings.filter((source) => cache[source] === source && /[A-Za-z]{3}/.test(source));
for (const source of strings) cache[source] = polish(source, cache[source]);
const corrupt = strings.filter((source) => looksCorrupt(source, cache[source]));
if (corrupt.length) {
  throw new Error(`Quality gate rejected ${corrupt.length} corrupt translations: ${corrupt.slice(0, 5).join(" | ")}`);
}
console.log(`Quality gate passed; ${rejected.length} entries remain unchanged (mostly names and technical labels).`);

const lines = strings.map((source) => `  ${JSON.stringify(source)}: ${JSON.stringify(cache[source])},`).join("\n");
const output = `// Generated locally with Xenova/opus-mt-en-hu. Reviewed entries in hu.ts override these.\nconst coverage: Record<string, string> = {\n${lines}\n};\n\nexport default coverage;\n`;
const domLines = domStrings.map((source) => `  ${JSON.stringify(source)}: ${JSON.stringify(cache[source])},`).join("\n");
const domOutput = `// Hard-coded JSX copy translated at the DOM boundary for Hungarian mode.\nconst dom: Record<string, string> = {\n${domLines}\n};\n\nexport default dom;\n`;
await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, output, "utf8");
await writeFile(DOM_OUTPUT, domOutput, "utf8");
console.log(`Wrote ${strings.length} Hungarian UI entries to ${OUTPUT}`);
console.log(`Wrote ${domStrings.length} hard-coded JSX entries to ${DOM_OUTPUT}`);
