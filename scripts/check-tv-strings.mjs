import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { scanKotlin, hitsFor, STRICT, WIDE } from "./tv-strings-scan.mjs";

const sourceDir = resolve("android-native/app/src/main/java/com/harbor/tv");
const strictPath = resolve("scripts/tv-strings-baseline.json");
const widePath = resolve("scripts/tv-strings-wide.json");
const writing = process.argv.includes("--update");
const listing = process.argv.includes("--list-wide");

const dataFiles = new Set([
  "TitleAwards.kt",
  "CollectionsCatalog.kt",
  "AddonHttp.kt",
  "AnimeCatalog.kt",
  "HtmlText.kt",
]);

const kindKey = (name, value) => `${name}::${value}`;

const files = (await readdir(sourceDir)).filter((name) => name.endsWith(".kt")).sort();
const strictHits = new Map();
const wideHits = new Map();
const wideKind = new Map();
for (const name of files) {
  if (dataFiles.has(name)) continue;
  const sc = scanKotlin(await readFile(resolve(sourceDir, name), "utf8"));
  const strict = hitsFor(sc, STRICT);
  const wide = hitsFor(sc, WIDE);
  if (strict.length) strictHits.set(name, strict);
  if (wide.length) wideHits.set(name, wide);
  for (const hit of wide) wideKind.set(kindKey(name, hit.value), hit.kind);
}

function collapse(hits) {
  const out = {};
  for (const [name, values] of [...hits].sort()) out[name] = values.map((hit) => hit.value).sort();
  return out;
}
function size(map) {
  return Object.values(map).reduce((sum, values) => sum + values.length, 0);
}

const strictNow = collapse(strictHits);
const wideNow = collapse(wideHits);

if (writing) {
  const crlf = (value) => `${JSON.stringify(value, null, 2)}\n`.split("\n").join("\r\n");
  await writeFile(strictPath, crlf(strictNow), "utf8");
  await writeFile(widePath, crlf(wideNow), "utf8");
  console.log(
    `Baselines written: strict ${size(strictNow)} across ${Object.keys(strictNow).length} files, ` +
      `wide ${size(wideNow)} across ${Object.keys(wideNow).length} files.`,
  );
  process.exit(0);
}

async function load(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

const strictBase = await load(strictPath);
const wideBase = await load(widePath);
if (!strictBase) {
  console.error("No strict baseline. Run: node scripts/check-tv-strings.mjs --update");
  process.exitCode = 1;
}

function additions(now, base) {
  const added = [];
  for (const [name, values] of Object.entries(now)) {
    const known = new Set(base[name] ?? []);
    for (const value of values) if (!known.has(value)) added.push({ name, value });
  }
  return added;
}

const strictAdded = additions(strictNow, strictBase ?? {});
const wideAdded = wideBase ? additions(wideNow, wideBase) : [];

const wideOnly = [];
for (const [name, values] of Object.entries(wideNow)) {
  for (const value of values) {
    if (strictNow[name]?.includes(value)) continue;
    wideOnly.push({ name, value, kind: wideKind.get(kindKey(name, value)) ?? "copy" });
  }
}
const likelyCopy = wideOnly.filter((row) => row.kind === "copy").length;

if (listing) {
  const rows = [...wideOnly].sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind.localeCompare(b.kind)));
  for (const row of rows) console.log(`${row.kind}\t${row.name}\t${JSON.stringify(row.value)}`);
  console.log(`${rows.length} wide-only literals, ${likelyCopy} classed likely copy.`);
  process.exit(0);
}

if (wideAdded.length) {
  console.warn(`Warning, ${wideAdded.length} new literal(s) the wide checks see and the strict gate does not:`);
  for (const item of wideAdded.slice(0, 20)) {
    console.warn(`  ${item.name}: ${JSON.stringify(item.value)} (${wideKind.get(kindKey(item.name, item.value)) ?? "copy"})`);
  }
  if (wideAdded.length > 20) console.warn(`  and ${wideAdded.length - 20} more.`);
  console.warn("These do not fail the build. Record them with --update once you have decided copy or data.");
}

if (strictAdded.length) {
  console.error(`New hardcoded user-facing strings (${strictAdded.length}):`);
  console.error(strictAdded.map((item) => `${item.name}: ${JSON.stringify(item.value)}`).join("\n"));
  console.error("");
  console.error("Move each to res/values/strings.xml and read it through HarborText.get,");
  console.error("or if it is not user-facing copy, record it with --update and say why.");
  process.exitCode = 1;
} else {
  console.log(
    `No new hardcoded strings. Strict ${size(strictNow)} known, baseline ${size(strictBase ?? {})}. ` +
      `Wide sees ${wideOnly.length} more, ${likelyCopy} of them classed likely copy, warn only. ` +
      `Run --list-wide for the backlog.`,
  );
}
