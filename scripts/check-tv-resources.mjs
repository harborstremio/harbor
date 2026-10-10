import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const mainDir = resolve("android-native/app/src/main/java/com/harbor/tv");
const stringsPath = resolve("android-native/app/src/main/res/values/strings.xml");

const quote = String.fromCharCode(34);
const backslash = String.fromCharCode(92);

const xml = await readFile(stringsPath, "utf8");
const prologs = xml.split("<?xml").length - 1;
const opens = xml.split("<resources").length - 1;
const closes = xml.split("</resources>").length - 1;
if (prologs !== 1 || opens !== 1 || closes !== 1 || !xml.trimStart().startsWith("<?xml")) {
  console.error(
    `strings.xml is not a single well formed document: ${prologs} xml prologs, ` +
    `${opens} resources open tags, ${closes} close tags. aapt will refuse it.`,
  );
  process.exit(1);
}

const defined = new Set();
for (const match of xml.matchAll(/<string name="([^"]+)"/g)) defined.add(match[1]);
const plural = new Set();
for (const match of xml.matchAll(/<plurals name="([^"]+)"/g)) plural.add(match[1]);

const files = (await readdir(mainDir)).filter((name) => name.endsWith(".kt")).sort();
const sources = new Map();
for (const name of files) sources.set(name, await readFile(resolve(mainDir, name), "utf8"));

const referenced = new Map();
const pluralRefs = new Map();
for (const [name, source] of sources) {
  for (const match of source.matchAll(/R\.string\.(\w+)/g)) {
    if (!referenced.has(match[1])) referenced.set(match[1], name);
  }
  for (const match of source.matchAll(/R\.plurals\.(\w+)/g)) {
    if (!pluralRefs.has(match[1])) pluralRefs.set(match[1], name);
  }
}

const failures = [];

for (const [key, name] of referenced) {
  if (!defined.has(key)) failures.push(`${name} references R.string.${key} which is not in strings.xml`);
}
for (const [key, name] of pluralRefs) {
  if (!plural.has(key)) failures.push(`${name} references R.plurals.${key} which is not in strings.xml`);
}

const bodyRe = new RegExp("<string name=" + quote + "([^" + quote + "]+)" + quote + ">([^<]*)</string>", "g");
const bodies = new Map();
for (const match of xml.matchAll(bodyRe)) bodies.set(match[1], match[2]);

for (const [key, body] of bodies) {
  const stripped = body.split(backslash + backslash).join("").replace(/\\./g, "");
  if (stripped.includes(quote) || stripped.includes("'")) {
    failures.push(`${key} has an unescaped quote or apostrophe, Android silently drops the rest of the value`);
  }
}

const takesArgs = new Set();
for (const [key, body] of bodies) if (/%\d+\$|%[sd]/.test(body)) takesArgs.add(key);

const advisory = [];
for (const [name, source] of sources) {
  for (const key of takesArgs) {
    const re = new RegExp("HarborText\\.get\\(\\s*R\\.string\\." + key + "\\s*\\)", "g");
    for (const match of source.matchAll(re)) {
      const before = source.slice(Math.max(0, match.index - 200), match.index);
      const after = source.slice(match.index + match[0].length, match.index + match[0].length + 40);
      const wrapped = /String\.format\(\s*$/.test(before) || /format\(\s*(\/\/[^\n]*\n\s*)?$/.test(before);
      const chained = /^\s*\./.test(after);
      const bind = before.match(/\bva[lr]\s+(\w+)(\s*:\s*String)?\s*(get\(\))?\s*=\s*$/);
      if (!wrapped && !chained && !bind) {
        advisory.push(`${name}: R.string.${key}`);
      } else if (bind) {
        const holder = bind[1];
        const needle = holder + '.format(';
        let seen = false;
        for (const other of sources.values()) if (other.includes(needle) || other.includes('String.format(' + holder)) { seen = true; break; }
        if (!seen) {
          advisory.push(`${name}: R.string.${key} is bound to ${holder}, which is never formatted anywhere, so the placeholder ships raw`);
        }
      }
    }
  }
}

function topLevelArgs(text) {
  const out = [];
  let depth = 0;
  let cur = "";
  for (const ch of text) {
    if (ch === "(" || ch === "[" || ch === "{") depth += 1;
    else if (ch === ")" || ch === "]" || ch === "}") depth -= 1;
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

function slotsNeeded(body) {
  const positional = [...body.matchAll(/%(\d+)\$/g)].map((m) => Number(m[1]));
  if (positional.length) return Math.max(...positional);
  return (body.match(/%[sd]/g) ?? []).length;
}

for (const [name, source] of sources) {
  for (const match of source.matchAll(/HarborText\.get\(\s*R\.string\.(\w+)\s*,/g)) {
    const key = match[1];
    let i = match.index + match[0].length;
    let depth = 1;
    let buf = "";
    while (i < source.length && depth > 0) {
      if (source[i] === "(") depth += 1;
      else if (source[i] === ")") { depth -= 1; if (depth === 0) break; }
      buf += source[i];
      i += 1;
    }
    if (!defined.has(key)) continue;
    const passed = topLevelArgs(buf).length;
    const need = slotsNeeded(bodies.get(key) ?? "");
    if (passed < need) {
      failures.push(`${name} passes ${passed} arguments to R.string.${key} which needs ${need}, format throws MissingFormatArgumentException`);
    } else if (passed > need) {
      failures.push(`${name} passes ${passed} arguments to R.string.${key} which takes ${need}, the extras are ignored so a placeholder is probably missing from the string`);
    }
  }
}

const pluralBodies = new Map();
for (const match of xml.matchAll(/<plurals name="([^"]+)">([\s\S]*?)<\/plurals>/g)) {
  pluralBodies.set(match[1], match[2]);
}
function pluralSlots(body) {
  const items = [...body.matchAll(/<item quantity="[a-z]+">([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  return items.length ? Math.max(...items.map((text) => slotsNeeded(text))) : slotsNeeded(body);
}

const pluralCalls = new Map();
for (const [name, source] of sources) {
  for (const match of source.matchAll(/(?:HarborText\.plural|pluralStringResource)\(\s*R\.plurals\.(\w+)\s*,/g)) {
    let i = match.index + match[0].length;
    let depth = 1;
    let buf = "";
    while (i < source.length && depth > 0) {
      if (source[i] === "(") depth += 1;
      else if (source[i] === ")") { depth -= 1; if (depth === 0) break; }
      buf += source[i];
      i += 1;
    }
    const after = topLevelArgs(buf).length;
    if (!pluralCalls.has(match[1])) pluralCalls.set(match[1], []);
    pluralCalls.get(match[1]).push({ name, explicit: after > 1, supplied: after > 1 ? after - 1 : 1 });
  }
}

for (const [key, body] of pluralBodies) {
  const need = pluralSlots(body);
  const calls = pluralCalls.get(key) ?? [];
  if (!calls.length && need > 1) {
    failures.push(`plurals ${key} needs ${need} format arguments and no call site supplies them`);
  }
  for (const call of calls) {
    if (call.supplied < need) {
      failures.push(`${call.name} supplies ${call.supplied} format arguments to R.plurals.${key} which needs ${need}, getQuantityString throws MissingFormatArgumentException`);
    } else if (call.supplied > need && call.explicit) {
      failures.push(`${call.name} supplies ${call.supplied} format arguments to R.plurals.${key} which takes ${need}, the extras are ignored so a placeholder is probably missing`);
    }
  }
}

const orphans = [...defined].filter((key) => !referenced.has(key)).sort();

if (advisory.length) {
  console.log(`Advisory, placeholder strings whose call site may pass no argument (${advisory.length}):`);
  console.log(advisory.map((line) => `  ${line}`).join("\n"));
  console.log("  Heuristic. Read the call site before acting; String.format wrapping is legitimate.");
}

if (failures.length) {
  console.error(`Resource failures (${failures.length}):`);
  console.error(failures.map((line) => `  ${line}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Resources resolve. ${defined.size} strings and ${plural.size} plurals defined, ` +
      `${referenced.size} referenced and every one exists, 0 unescaped quotes, ` +
      `${orphans.length} defined but never referenced` +
      `${orphans.length ? ` (${orphans.join(", ")})` : ""}.`,
  );
}
