/*
 * capstan-stage.mjs
 *
 * Builds src-tauri/resources/capstan/, everything the extension bridge needs to run
 * on a machine with no Java installed. tauri.conf.json ships that directory as a
 * resource, the same way it ships fonts/ and the stream blocker, and runs this from
 * beforeBuildCommand so no bundle is produced without it.
 *
 * What lands there:
 *   runtime/     a jlink image of nine JDK modules, not a whole JDK
 *   capstan.jar  the compat layer, built by android-extension-compat/tools/build.sh
 *   libs/        the jars the extensions and the layer link against
 *   dex-tools/   the twelve jars the dex to JVM conversion actually loads
 *   MANIFEST.txt every staged file with its size, so two builds can be diffed
 *   STAGE.json   the hash of everything that went in, so a second build can skip
 *
 * Nothing here is trusted on its own word. capstan-verify.mjs runs after every stage
 * and after every stage that was skipped, and it starts the staged runtime and makes
 * the bridge answer. A build ships a runtime that ran, or it stops.
 *
 * Modes:
 *   (none)      build the layer if stale, stage if stale, verify always.
 *   --check     verify what is staged. Never builds, never stages. Exit 1 if not ready.
 *   --dev       preflight for pnpm dev. Reports and always exits 0, so a dev server starts.
 *   --force     restage even when the hashes say it is current.
 *   --no-build  never invoke tools/build.sh; stop instead if the jar is stale.
 *   --target T  stage a runtime for rust triple T instead of this machine.
 *
 * A jlink image runs on one platform only, and which one comes from the jmods jlink is handed
 * rather than from the machine running it. capstan-jdk.mjs finds the right JDK for a target and
 * fetches it when it is not already here, so a macOS or Linux build no longer ships a Windows
 * runtime it cannot start.
 *
 * The module list is measured, not guessed. jdeps over capstan.jar plus libs/ named
 * java.base, java.desktop, java.instrument, java.sql, jdk.dynalink and jdk.unsupported.
 * Two of those turned out not to be needed at runtime and two more things jdeps cannot
 * see turned out to be:
 *
 *   jdk.zipfs      invisible to jdeps, and without it every extension dies at dex
 *                  convert with "cant find zipfs support". Load gate 0 of 13.
 *   jdk.crypto.ec  invisible to jdeps, carries SunEC. TLS to most hosts needs it.
 *   jdk.charsets   pages that are not UTF-8. Big5 is absent without it.
 *   jdk.localedata without it a non-English locale silently formats as English:
 *                  Locale("es") month reads "Mar", not "marzo". Costs 9.4 MB.
 *   java.desktop   only java.beans, from rhino and jackson, on paths neither takes.
 *                  Dropped, and the gates stayed green. Would cost 15.7 MB.
 *   java.sql       optional gson and jackson adapters. Dropped, 4.0 MB.
 *
 * Proven on 2026-09-24 against this exact stage: load gate 13/13 from a cold cache,
 * live gate 10/13 matching the full JDK row for row, bridge test 38 checks 0 failed.
 *
 * Env overrides:
 *   HARBOR_CAPSTAN_JDK       JDK 17+ with jmods/ and bin/jlink. Default: JAVA_HOME, and when
 *                            neither names one, a Temurin build fetched once and cached.
 *   HARBOR_CAPSTAN_JDK_TARGET, HARBOR_CAPSTAN_JDK_VERSION, HARBOR_CAPSTAN_CACHE: capstan-jdk.mjs.
 *   HARBOR_CAPSTAN_SRC       the compat layer checkout. Default: ../android-extension-compat.
 *   HARBOR_CAPSTAN_COMPRESS  jlink --compress. Default 2, which is 56.4 MB on disk and
 *                            40.4 MB once the installer packs it. 0 is 85.5 MB on disk
 *                            and 28.0 MB packed, because LZMA beats jlink's own scheme.
 *   HARBOR_CAPSTAN_OPTIONAL  declares this build to have no extension support. Only a
 *                            checkout with no layer at all is excused; a layer that is
 *                            present and broken still stops the build.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { FIX, hostTriple, markLaunchers, releaseLabel, resolveJdks } from "./capstan-jdk.mjs";
import { dest, readManifest, report, stagedJava, structureProblems, verifyStage } from "./capstan-verify.mjs";

const MODULES = [
  "java.base",
  "java.logging",
  "java.xml",
  "jdk.charsets",
  "jdk.crypto.ec",
  "jdk.dynalink",
  "jdk.localedata",
  "jdk.unsupported",
  "jdk.zipfs",
];

const DEX_KEEP = [
  "asm-",
  "d2j-base-cmd",
  "dex-ir",
  "dex-reader",
  "dex-reader-api",
  "dex-tools",
  "dex-translator",
  "dex-writer",
];

const STAGE_FORMAT = 1;

const args = new Set(process.argv.slice(2));
const mode = args.has("--dev") ? "dev" : args.has("--check") ? "check" : "stage";
const force = args.has("--force");
const noBuild = args.has("--no-build");
const at = process.argv.indexOf("--target");
const target = at >= 0 ? process.argv[at + 1] : hostTriple();
// Resolved once in main(), because finding either can mean a download.
let hostJdk = "";
let targetJdk = "";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = process.env.HARBOR_CAPSTAN_SRC ?? join(root, "android-extension-compat");
const compress = process.env.HARBOR_CAPSTAN_COMPRESS ?? "2";
const optional = !!process.env.HARBOR_CAPSTAN_OPTIONAL;
const jar = join(src, "out", "capstan.jar");
const libs = join(src, "libs");
const dexLib = join(src, "tools", "dex-tools", "lib");
const stamp = join(src, "out", "capstan.jar.sources");

const log = (...lines) => {
  for (const line of lines) console.log(`[capstan] ${line}`);
};
const warn = (...lines) => {
  for (const line of lines) console.error(`[capstan] ${line}`);
};
const die = (...lines) => {
  warn(...lines);
  process.exit(1);
};

const exe = (name) => (process.platform === "win32" ? `${name}.exe` : name);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const shaFile = (path) => sha(readFileSync(path));
const digestOf = (pairs) => sha(pairs.map(([k, v]) => `${k}=${v}`).join("\n"));

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );

const jarsIn = (dir) =>
  readdirSync(dir)
    .filter((n) => n.endsWith(".jar"))
    .sort();

// capstan.jar is built from these and nothing else, so a change here with no rebuild is the
// stale jar that used to reach an installer unnoticed.
function layerSourceHash() {
  const inputs = [];
  for (const file of walk(join(src, "src"))) {
    inputs.push([relative(src, file).split(sep).join("/"), shaFile(file)]);
  }
  for (const tool of ["build.sh", "kc.sh"]) {
    const path = join(src, "tools", tool);
    if (existsSync(path)) inputs.push([`tools/${tool}`, shaFile(path)]);
  }
  for (const name of jarsIn(libs)) inputs.push([`libs/${name}`, shaFile(join(libs, name))]);
  inputs.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return digestOf(inputs);
}

function readStamp() {
  try {
    const read = JSON.parse(readFileSync(stamp, "utf8"));
    return read.format === STAGE_FORMAT ? read.sourceHash : null;
  } catch {
    return null;
  }
}

function buildLayer() {
  if (noBuild) {
    die(
      "the compat layer is missing or older than its sources, and --no-build was passed.",
      "Run: cd android-extension-compat && sh tools/build.sh",
    );
  }
  if (!hostJdk) die("no JDK to build the compat layer with. Set HARBOR_CAPSTAN_JDK or JAVA_HOME.");
  log("compat layer is older than its sources, running tools/build.sh");
  try {
    execFileSync("sh", ["tools/build.sh"], {
      cwd: src,
      env: { ...process.env, JAVA_HOME: hostJdk },
      stdio: ["ignore", "inherit", "inherit"],
    });
  } catch (error) {
    die(
      `tools/build.sh failed: ${String(error.message).split("\n")[0]}`,
      "Run it by hand for the whole output: cd android-extension-compat && sh tools/build.sh",
    );
  }
  if (!existsSync(jar)) die("tools/build.sh reported success but produced no out/capstan.jar");
}

function ensureLayer() {
  const want = layerSourceHash();
  if (!existsSync(jar) || readStamp() !== want) {
    buildLayer();
    writeFileSync(stamp, `${JSON.stringify({ format: STAGE_FORMAT, sourceHash: want }, null, 2)}\n`);
  }
  return want;
}

function dexJarNames() {
  const names = jarsIn(dexLib).filter((n) => DEX_KEEP.some((p) => n.startsWith(p)));
  for (const prefix of DEX_KEEP) {
    if (!names.some((n) => n.startsWith(prefix))) {
      die(
        `no jar starting with "${prefix}" in ${dexLib}`,
        "The converter set moved. Re-measure before editing DEX_KEEP.",
      );
    }
  }
  return names;
}

function planHash(sourceHash) {
  // The target JDK decides the image, so it is the one hashed: swap it and the stage is stale.
  const release = join(targetJdk, "release");
  const inputs = [
    ["format", String(STAGE_FORMAT)],
    ["target", target],
    ["modules", MODULES.join(",")],
    ["compress", compress],
    ["sources", sourceHash],
    ["jar", shaFile(jar)],
    ["jdk", existsSync(release) ? shaFile(release) : targetJdk],
  ];
  for (const name of jarsIn(libs)) inputs.push([`libs/${name}`, shaFile(join(libs, name))]);
  for (const name of dexJarNames()) inputs.push([`dex/${name}`, shaFile(join(dexLib, name))]);
  return digestOf(inputs);
}

function stagedPlanHash() {
  const path = join(dest, "STAGE.json");
  if (!existsSync(path)) return null;
  try {
    const read = JSON.parse(readFileSync(path, "utf8"));
    return read.format === STAGE_FORMAT ? read.planHash : null;
  } catch {
    return null;
  }
}

function stage() {
  const jlink = join(hostJdk, "bin", exe("jlink"));
  const jmods = join(targetJdk, "jmods");
  if (!existsSync(jlink)) die(`no jlink at ${jlink}`, ...FIX);
  if (!existsSync(jmods)) die(`no jmods/ under ${targetJdk}. A JRE cannot build a runtime, a JDK can.`, ...FIX);

  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });

  log(`jlink ${MODULES.length} modules for ${target} from ${jmods}`);
  execFileSync(
    jlink,
    [
      "--module-path", jmods,
      "--add-modules", MODULES.join(","),
      "--output", join(dest, "runtime"),
      "--strip-debug",
      "--no-header-files",
      "--no-man-pages",
      "--compress", compress,
    ],
    { stdio: ["ignore", "inherit", "inherit"] },
  );

  const copyInto = (dir, from, names) => {
    mkdirSync(join(dest, dir), { recursive: true });
    for (const name of names) copyFileSync(join(from, name), join(dest, dir, name));
  };

  copyFileSync(jar, join(dest, "capstan.jar"));
  copyInto("libs", libs, jarsIn(libs));
  copyInto("dex-tools", dexLib, dexJarNames());

  markLaunchers(join(dest, "runtime"), target, (line) => log(line));
}

function writeManifest(sourceHash, hash) {
  const files = walk(dest)
    .map((p) => ({ path: relative(dest, p).split(sep).join("/"), bytes: statSync(p).size }))
    .filter((f) => f.path !== "MANIFEST.txt" && f.path !== "STAGE.json")
    .sort((a, b) => (a.path < b.path ? -1 : 1));
  writeFileSync(
    join(dest, "MANIFEST.txt"),
    `${files.map((f) => `${String(f.bytes).padStart(10)}  ${f.path}`).join("\n")}\n`,
  );
  const plan = {
    format: STAGE_FORMAT,
    planHash: hash,
    sourceHash,
    target,
    jdk: releaseLabel(targetJdk),
    modules: MODULES,
    compress,
    files: files.length,
    bytes: files.reduce((t, f) => t + f.bytes, 0),
    staged: new Date().toISOString(),
  };
  writeFileSync(join(dest, "STAGE.json"), `${JSON.stringify(plan, null, 2)}\n`);
}

async function verifyOrDie() {
  const bad = await verifyStage((line) => log(line));
  if (!bad.length) return;
  die(
    "the staged extension runtime is not usable, so this build would ship broken extensions:",
    ...bad.map((b) => `  ${b}`),
    "Run: pnpm run setup:capstan",
  );
}

// pnpm dev runs the app straight from the checkout: src-tauri/src/capstan/locate.rs walks up for
// android-extension-compat/out/capstan.jar and falls back to JAVA_HOME for a runtime, so a
// developer needs the layer built but not staged. Name whichever of those is missing, then let
// the dev server start regardless.
function devPreflight() {
  // tauri.conf.json names resources/capstan/ unconditionally and tauri dev validates resource
  // paths, so a missing directory stops the dev server before it starts. Git never tracks empty
  // directories and resources/capstan/ is gitignored, so a fresh clone always lacks it: create
  // the empty directory the bundler accepts and move on.
  if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
  const off = (...lines) => warn("extensions are off in this dev session.", ...lines);
  if (!existsSync(src)) {
    off(
      "The compat layer is not in this checkout, and everything else runs without it.",
      "To turn extensions on, add the layer, then run: pnpm run setup:capstan",
    );
    return;
  }
  if (!existsSync(jar)) {
    off("The compat layer has not been built.", "Run: cd android-extension-compat && sh tools/build.sh");
    return;
  }
  if (readStamp() !== layerSourceHash()) {
    warn(
      "the compat layer is older than its sources, so extensions run the previous build.",
      "Run: cd android-extension-compat && sh tools/build.sh",
    );
    return;
  }
  const staged = existsSync(stagedJava());
  if (!staged && !process.env.HARBOR_JAVA && !process.env.JAVA_HOME) {
    off(
      "The layer is built but no Java runtime is configured for it.",
      "Set JAVA_HOME or HARBOR_JAVA to a Java 17 or newer install, or run: pnpm run setup:capstan",
    );
    return;
  }
  log(`extensions ready, runtime from ${staged ? "the staged image" : "JAVA_HOME"}`);
}

// A checkout with no layer at all is the fresh clone and the CI case. Either this build is
// declared to have no extension support, or it stops here rather than producing an installer
// whose extensions cannot work.
async function withoutSources() {
  if (readManifest()?.length && !structureProblems().length) {
    log("no layer sources in this checkout, verifying the stage already here");
    await verifyOrDie();
    report((line) => log(line));
    return;
  }
  if (!optional) {
    die(
      `no compat layer at ${src}, so this build would ship no extension support at all.`,
      "Put the layer in this checkout, or set HARBOR_CAPSTAN_OPTIONAL=1 to build deliberately without it.",
    );
  }
  // tauri.conf.json names resources/capstan/ unconditionally. The bundler skips an empty
  // directory and cannot resolve a missing one.
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  warn(
    "BUILDING WITHOUT EXTENSION SUPPORT. HARBOR_CAPSTAN_OPTIONAL is set and this checkout has no",
    "compat layer, so nothing is staged and installed extensions will not run in this build.",
  );
}

async function main() {
  if (mode === "dev") {
    // pnpm dev chains this before vite, so nothing it finds may keep the dev server from starting.
    try {
      devPreflight();
    } catch (error) {
      warn(`could not check the extension layer: ${String(error.message).split("\n")[0]}`);
    }
    return;
  }
  if (!existsSync(src)) {
    await withoutSources();
    return;
  }
  for (const [label, path] of [["libs", libs], ["dex tools", dexLib]]) {
    if (!existsSync(path)) die(`no ${label} at ${path}`);
  }
  try {
    ({ hostJdk, targetJdk } = await resolveJdks(target, (line) => log(line)));
  } catch (error) {
    die(String(error.message), ...FIX);
  }

  if (mode === "check") {
    if (!existsSync(jar)) die("no out/capstan.jar to check the stage against.");
    if (!stagedPlanHash()) die("nothing is staged at src-tauri/resources/capstan.", "Run: pnpm run setup:capstan");
    if (stagedPlanHash() !== planHash(layerSourceHash())) {
      die("the staged runtime is out of date with the layer.", "Run: pnpm run setup:capstan");
    }
    await verifyOrDie();
    log("stage is current and the bridge answered");
    return;
  }

  const sourceHash = ensureLayer();
  const want = planHash(sourceHash);
  if (!force && stagedPlanHash() === want && !structureProblems().length) {
    log("stage is current, nothing to restage");
  } else {
    stage();
    writeManifest(sourceHash, want);
  }
  await verifyOrDie();
  report((line) => log(line));
}

await main();
