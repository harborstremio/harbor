/*
 * capstan-verify.mjs
 *
 * Proves the staged extension runtime at src-tauri/resources/capstan is complete and runs.
 * capstan-stage.mjs calls verifyStage() after staging and after deciding not to restage, so
 * no bundle is produced from a partial one. Runs on its own too:
 *
 *   node scripts/capstan-verify.mjs
 *
 * Three levels, cheapest first:
 *   every file MANIFEST.txt names is present at the size it names
 *   the classes capstan.rs and DexConverter.kt look up by name are in the jars
 *   the staged runtime starts the bridge and gets an answer to ping
 *
 * The third level runs only when the stage was built for this machine. A runtime cross staged
 * for another platform cannot be started here, so it is checked for shape and said to be, rather
 * than reported as if it had run.
 *
 * The module list is not repeated here. STAGE.json records what the stage asked jlink for and
 * the runtime's own release file is checked against that, so there is one list, in the stager.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";
import { hostTriple } from "./capstan-jdk.mjs";

// The classes src/host/DexConverter.kt and src-tauri/src/capstan.rs load by name. A jar set
// missing one of them links and then throws on the first install a user attempts.
const BRIDGE_CLASS = "com/harbor/capstan/bridge/Bridge.class";
const ENTRY_CLASS = "com.harbor.capstan.bridge.Bridge";
const DEX_CLASSES = [
  "com/googlecode/d2j/dex/Dex2jar.class",
  "com/googlecode/d2j/reader/BaseDexFileReader.class",
  "com/googlecode/d2j/reader/DexFileReader.class",
  "com/googlecode/d2j/reader/MultiDexFileReader.class",
];

const PING_TIMEOUT_MS = 90_000;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const dest = join(root, "src-tauri", "resources", "capstan");

// A jlink image belongs to one platform, and STAGE.json records which. The launcher inside it is
// named after that platform, not after this machine, so a Linux image cross staged on Windows is
// still checked for shape here and simply never started.
const stagedTarget = () => readStagePlan()?.target ?? hostTriple();
export const stagedJava = () =>
  join(dest, "runtime", "bin", stagedTarget().includes("windows") ? "java.exe" : "java");

const classpathSeparator = process.platform === "win32" ? ";" : ":";
const mb = (n) => `${(n / 1048576).toFixed(2)} MB`;

const jarsIn = (dir) =>
  readdirSync(dir)
    .filter((n) => n.endsWith(".jar"))
    .sort();

const entryNames = (path) => {
  const names = [];
  unzipSync(readFileSync(path), {
    filter: (f) => {
      names.push(f.name);
      return false;
    },
  });
  return names;
};

export function readManifest() {
  const path = join(dest, "MANIFEST.txt");
  if (!existsSync(path)) return null;
  // Right aligned size, two spaces, then the path, which is how the stager writes it.
  return readFileSync(path, "utf8")
    .split("\n")
    .map((line) => /^ *(\d+) {2}(.+)$/.exec(line))
    .filter(Boolean)
    .map((found) => ({ bytes: Number(found[1]), path: found[2] }));
}

export function readStagePlan() {
  const path = join(dest, "STAGE.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/** Every problem found, as lines a human can act on. Empty means the stage is whole. */
export function structureProblems() {
  const bad = [];
  const manifest = readManifest();
  if (!manifest || !manifest.length) return ["no MANIFEST.txt, so nothing is staged"];
  for (const file of manifest) {
    const path = join(dest, file.path.split("/").join(sep));
    if (!existsSync(path)) bad.push(`missing from the stage: ${file.path}`);
    else if (statSync(path).size !== file.bytes) bad.push(`wrong size: ${file.path}`);
  }
  if (bad.length) return bad;

  if (!entryNames(join(dest, "capstan.jar")).includes(BRIDGE_CLASS)) {
    bad.push(`capstan.jar carries no ${BRIDGE_CLASS}`);
  }

  const dexDir = join(dest, "dex-tools");
  const dexEntries = new Set(
    existsSync(dexDir) ? jarsIn(dexDir).flatMap((n) => entryNames(join(dexDir, n))) : [],
  );
  for (const want of DEX_CLASSES) {
    if (!dexEntries.has(want)) bad.push(`no staged converter jar carries ${want}`);
  }

  const release = join(dest, "runtime", "release");
  const wanted = readStagePlan()?.modules ?? [];
  if (!existsSync(stagedJava())) bad.push(`runtime has no ${stagedTarget().includes("windows") ? "bin/java.exe" : "bin/java"}`);
  else if (!existsSync(release)) bad.push("runtime has no release file");
  else if (!wanted.length) bad.push("STAGE.json does not say which modules were asked for");
  else {
    const found = /MODULES="([^"]*)"/.exec(readFileSync(release, "utf8"));
    const have = new Set((found ? found[1] : "").split(" "));
    for (const want of wanted) {
      if (!have.has(want)) bad.push(`runtime is missing the ${want} module`);
    }
  }
  return bad;
}

/**
 * Starts the staged runtime on the staged classpath and waits for the bridge to answer ping.
 * This is the only check that proves the parts work together rather than merely being present.
 */
export function pingStaged(onLog) {
  const java = stagedJava();
  const classpath = [
    join(dest, "capstan.jar"),
    ...jarsIn(join(dest, "libs")).map((n) => join(dest, "libs", n)),
  ].join(classpathSeparator);
  const data = mkdtempSync(join(tmpdir(), "capstan-verify-"));
  const child = spawn(
    java,
    [
      `-Dharbor.capstan.dexTools=${join(dest, "dex-tools")}`,
      "-cp",
      classpath,
      ENTRY_CLASS,
      "--data-dir",
      data,
    ],
    { stdio: ["pipe", "pipe", "pipe"] },
  );

  return new Promise((resolve) => {
    let out = "";
    let err = "";
    let settled = false;

    const finish = (problem) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        child.stdin.write('{"id":"v2","method":"shutdown"}\n');
        child.stdin.end();
      } catch {
        // already gone, which is what problem already says
      }
      setTimeout(() => child.kill(), 2000).unref();
      child.on("close", () => {
        try {
          rmSync(data, { recursive: true, force: true });
        } catch {
          // the bridge still holds it, and it is under the system temp directory either way
        }
      });
      const tail = err.trim() ? [`stderr: ${err.trim().split("\n").pop()}`] : [];
      resolve(problem ? [problem, ...tail] : []);
    };

    const timer = setTimeout(() => {
      child.kill();
      finish(`the staged runtime did not answer ping within ${PING_TIMEOUT_MS / 1000}s`);
    }, PING_TIMEOUT_MS);

    const take = (line) => {
      let frame;
      try {
        frame = JSON.parse(line);
      } catch {
        finish(`the staged runtime wrote a line that is not protocol: ${line.slice(0, 120)}`);
        return;
      }
      if (frame.id !== "v1") return;
      if (frame.ok === true && frame.result?.pong === true) {
        onLog?.(`bridge answered ping, protocol ${frame.result.protocol}`);
        finish(null);
      } else {
        finish(`the staged runtime refused ping: ${line.slice(0, 200)}`);
      }
    };

    child.stderr.on("data", (chunk) => {
      err += chunk;
    });
    child.stdout.on("data", (chunk) => {
      out += chunk;
      for (let at = out.indexOf("\n"); at >= 0; at = out.indexOf("\n")) {
        const line = out.slice(0, at).trim();
        out = out.slice(at + 1);
        if (line) take(line);
      }
    });
    child.on("error", (error) => finish(`could not start the staged runtime: ${error.message}`));
    child.on("exit", (code) => finish(`the staged runtime exited with ${code} before answering ping`));
    child.stdin.write('{"id":"v1","method":"ping"}\n');
  });
}

/** Problems as lines, empty when the stage is whole and the bridge answered. */
export async function verifyStage(onLog) {
  const bad = structureProblems();
  if (bad.length) return bad;
  const target = stagedTarget();
  if (target !== hostTriple()) {
    onLog?.(`staged for ${target}, so the bridge was not started: this machine cannot run it`);
    onLog?.("that runtime is verified for shape only, and must be started on the platform it is for");
    return [];
  }
  return pingStaged(onLog);
}

export function report(onLog) {
  const manifest = readManifest() ?? [];
  const sum = (prefix) =>
    manifest.filter((f) => f.path.startsWith(prefix)).reduce((t, f) => t + f.bytes, 0);
  const count = (prefix) => manifest.filter((f) => f.path.startsWith(prefix)).length;
  onLog(`runtime      ${mb(sum("runtime/"))}`);
  onLog(`libs         ${mb(sum("libs/"))}  (${count("libs/")} jars)`);
  onLog(`dex-tools    ${mb(sum("dex-tools/"))}  (${count("dex-tools/")} jars)`);
  onLog(`capstan.jar  ${mb(sum("capstan.jar"))}`);
  onLog(
    `total        ${mb(manifest.reduce((t, f) => t + f.bytes, 0))} in ${manifest.length} files at ${dest}`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const say = (line) => console.log(`[capstan] ${line}`);
  const bad = await verifyStage(say);
  if (bad.length) {
    for (const line of ["the staged extension runtime is not usable:", ...bad.map((b) => `  ${b}`)]) {
      console.error(`[capstan] ${line}`);
    }
    console.error("[capstan] Run: pnpm run setup:capstan");
    process.exit(1);
  }
  report(say);
  say("stage verified");
}
