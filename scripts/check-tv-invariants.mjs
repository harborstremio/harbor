import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const mainDir = resolve("android-native/app/src/main/java/com/harbor/tv");
const baselinePath = resolve("scripts/tv-invariants-baseline.json");
const writing = process.argv.includes("--update");

const LOC_CEILING = 400;
const emDash = String.fromCharCode(8212);

const files = (await readdir(mainDir)).filter((name) => name.endsWith(".kt")).sort();
const sources = new Map();
for (const name of files) sources.set(name, await readFile(resolve(mainDir, name), "utf8"));

const oversized = {};
const emDashed = [];
for (const [name, source] of sources) {
  const split = source.split("\n");
  const lines = split.length > 0 && split[split.length - 1] === "" ? split.length - 1 : split.length;
  if (lines > LOC_CEILING) oversized[name] = lines;
  if (source.includes(emDash)) emDashed.push(name);
}

const app = sources.get("HarborApplication.kt") ?? "";
const unregistered = [];
let stateful = 0;
for (const [name, source] of sources) {
  if (name === "HarborApplication.kt") continue;
  for (const match of source.matchAll(/^(?:(?:internal|private|public|expect|actual)\s+)*object\s+(\w+)\s*\{/gm)) {
    const object = match[1];
    const rest = source.slice(match.index + match[0].length);
    const end = rest.indexOf("\n}");
    const body = end > 0 ? rest.slice(0, end) : rest;
    if (!body.includes("mutableStateOf") && !body.includes("mutableStateListOf")) continue;
    stateful += 1;
    if (!new RegExp(`\\b${object}\\b`).test(app)) unregistered.push(`${object} (${name})`);
  }
}

const current = { oversized };

if (writing) {
  await writeFile(baselinePath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  console.log(`Baseline written: ${Object.keys(oversized).length} files over ${LOC_CEILING} LOC.`);
  process.exit(0);
}

let baseline = { oversized: {} };
try {
  baseline = JSON.parse(await readFile(baselinePath, "utf8"));
} catch {
  console.error("No baseline. Run: node scripts/check-tv-invariants.mjs --update");
  process.exitCode = 1;
}

const failures = [];

for (const [name, lines] of Object.entries(oversized)) {
  const was = baseline.oversized?.[name];
  if (was === undefined) failures.push(`${name} is ${lines} lines, over the ${LOC_CEILING} ceiling and not in the baseline`);
  else if (lines > was) failures.push(`${name} grew ${was} to ${lines} lines while already over the ceiling`);
}

for (const name of emDashed) failures.push(`${name} contains a literal em dash`);

for (const entry of unregistered) {
  failures.push(`${entry} owns Compose state and is not touched in HarborApplication, snapshot crash risk`);
}

const shrunk = Object.entries(baseline.oversized ?? {}).filter(([name, was]) => {
  const now = oversized[name];
  return now === undefined || now < was;
});

if (failures.length) {
  console.error(`Invariant failures (${failures.length}):`);
  console.error(failures.map((line) => `  ${line}`).join("\n"));
  process.exitCode = 1;
} else {
  const over = Object.keys(oversized).length;
  const worst = Object.entries(oversized).sort((a, b) => b[1] - a[1])[0];
  console.log(
    `Invariants hold. ${stateful} state-owning objects all registered, 0 em dashes, ` +
      `${over} files over ${LOC_CEILING} LOC (worst ${worst ? `${worst[0]} at ${worst[1]}` : "none"}), ` +
      `${shrunk.length} improved since baseline.`,
  );
}
