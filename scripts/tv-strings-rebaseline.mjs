import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { scanKotlin, hitsFor, boundToResource, STRICT, WIDE } from "./tv-strings-scan.mjs";

const sourceDir = resolve("android-native/app/src/main/java/com/harbor/tv");
const oldBaselinePath = process.argv[2] ?? resolve("scripts/tv-strings-baseline-previous.json");
const outPath = process.argv[3] ?? resolve("scripts/tv-strings-rebaseline.json");

const dataFiles = new Set([
  "TitleAwards.kt",
  "CollectionsCatalog.kt",
  "AddonHttp.kt",
  "AnimeCatalog.kt",
  "HtmlText.kt",
]);

const quote = String.fromCharCode(34);
const backslash = String.fromCharCode(92);
function legacyLiterals(line) {
  const out = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] !== quote) { i += 1; continue; }
    let j = i + 1;
    let buf = "";
    let escaped = false;
    while (j < line.length) {
      if (line[j] === backslash) { buf += line.slice(j, j + 2); escaped = true; j += 2; continue; }
      if (line[j] === quote) break;
      buf += line[j];
      j += 1;
    }
    if (j >= line.length) break;
    if (!escaped && buf.length >= 12 && buf.length <= 200) out.push(buf);
    i = j + 1;
  }
  return out;
}
const legacyShape = /^[A-Z(][^<>=]*$/;
const legacyProse = /\s[a-z]{2,}\s/;
const legacyCodeish = /[_$]\w+\(|\bfun\b|\bval\b|application\/|text\//;
function legacyHits(source) {
  const found = [];
  for (const line of source.split("\n")) {
    if (line.trim().startsWith("//")) continue;
    if (line.includes("Log.") || line.includes("R.string")) continue;
    for (const value of legacyLiterals(line)) {
      if (value.split(/\s+/).length < 3) continue;
      if (!legacyShape.test(value)) continue;
      if (value.startsWith("http") || value.includes("://") || value.slice(0, 12).includes("/")) continue;
      if (value.includes("KHTML")) continue;
      if (legacyCodeish.test(value)) continue;
      if (!legacyProse.test(value)) continue;
      found.push(value);
    }
  }
  return found;
}

const oldBaseline = JSON.parse(await readFile(oldBaselinePath, "utf8"));
const files = (await readdir(sourceDir)).filter((name) => name.endsWith(".kt")).sort();
const fileSet = new Set(files);
const scans = new Map();
const legacy = new Map();
const strictNow = new Map();
const wideNow = new Map();
for (const name of files) {
  if (dataFiles.has(name)) continue;
  const source = await readFile(resolve(sourceDir, name), "utf8");
  const sc = scanKotlin(source);
  scans.set(name, sc);
  legacy.set(name, new Set(legacyHits(source)));
  strictNow.set(name, new Set(hitsFor(sc, STRICT).map((hit) => hit.value)));
  wideNow.set(name, hitsFor(sc, WIDE));
}

const removedFalsePositive = [];
const removedConvertedFallback = [];
const removedConvertedGone = [];
let stillOpen = 0;
for (const [name, values] of Object.entries(oldBaseline)) {
  for (const value of values) {
    if (strictNow.get(name)?.has(value)) { stillOpen += 1; continue; }
    if (legacy.get(name)?.has(value)) {
      const sc = scans.get(name);
      const tok = sc.strings.find((entry) => entry.value === value);
      removedFalsePositive.push({ file: name, line: tok?.line ?? 0, value, why: tok ? boundToResource(sc, tok) : "unknown" });
      continue;
    }
    if (!fileSet.has(name)) { removedConvertedGone.push({ file: name, value, why: "file no longer exists" }); continue; }
    const sc = scans.get(name);
    const tok = sc?.strings.find((entry) => entry.value === value);
    if (!tok) { removedConvertedGone.push({ file: name, value, why: "literal no longer in the file" }); continue; }
    removedConvertedFallback.push({ file: name, line: tok.line, value, why: boundToResource(sc, tok) ?? "no longer matches the strict filters" });
  }
}

const wideOnly = [];
for (const [name, hits] of wideNow) {
  for (const hit of hits) {
    if (strictNow.get(name)?.has(hit.value)) continue;
    wideOnly.push({ file: name, line: hit.line, value: hit.value, kind: hit.kind });
  }
}
wideOnly.sort((a, b) => (a.kind === b.kind ? a.file.localeCompare(b.file) || a.line - b.line : a.kind.localeCompare(b.kind)));

const oldTotal = Object.values(oldBaseline).reduce((sum, values) => sum + values.length, 0);
const report = {
  summary: {
    previousBaselineEntries: oldTotal,
    stillOpenInNewStrictBaseline: stillOpen,
    removedAsFalsePositive: removedFalsePositive.length,
    removedAsConvertedFallbackStillInFile: removedConvertedFallback.length,
    removedAsConvertedLiteralGone: removedConvertedGone.length,
    newlyVisibleWideOnly: wideOnly.length,
    newlyVisibleClassedCopy: wideOnly.filter((row) => row.kind === "copy").length,
    newlyVisibleClassedDataTable: wideOnly.filter((row) => row.kind === "data table").length,
    newlyVisibleClassedHeader: wideOnly.filter((row) => row.kind === "header").length,
    newlyVisibleClassedMatchKey: wideOnly.filter((row) => row.kind === "match key").length,
  },
  removedAsFalsePositive: removedFalsePositive,
  removedAsConvertedFallbackStillInFile: removedConvertedFallback,
  removedAsConvertedLiteralGone: removedConvertedGone,
  newlyVisibleWideOnly: wideOnly,
};
await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`.split("\n").join("\r\n"), "utf8");
console.log(JSON.stringify(report.summary, null, 2));
