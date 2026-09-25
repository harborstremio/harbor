/*
 * capstan-jdk.mjs
 *
 * Finds the two JDKs capstan-stage.mjs needs, which are not always the same one.
 *
 * jlink runs on the machine doing the build. The jmods it is handed decide which platform the
 * runtime image is FOR: hand it Linux jmods on Windows and it writes bin/java as an ELF binary
 * beside lib/*.so. That is how a release for another platform gets staged at all, because a
 * jlink image is not portable and the old script could only ever produce one for the host.
 *
 * jlink refuses jmods whose feature.interim version differs from its own, with
 *   jlink version 17.0 does not match target java.base version 21.0
 * so the fetched JDK tracks the feature version of the jlink doing the work.
 *
 * Order for each: an explicit env var, then JAVA_HOME when it fits, then a Temurin build fetched
 * once from Adoptium and unpacked under a cache outside the repo. Nothing is fetched when a
 * usable JDK is already named, so the developer machine path is unchanged.
 */

import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const TARGETS = {
  "x86_64-pc-windows-msvc": { os: "windows", arch: "x64" },
  "aarch64-pc-windows-msvc": { os: "windows", arch: "aarch64" },
  "x86_64-apple-darwin": { os: "mac", arch: "x64" },
  "aarch64-apple-darwin": { os: "mac", arch: "aarch64" },
  "x86_64-unknown-linux-gnu": { os: "linux", arch: "x64" },
  "aarch64-unknown-linux-gnu": { os: "linux", arch: "aarch64" },
};

const API = "https://api.adoptium.net/v3";
const DEFAULT_FEATURE = 17;

const exe = (name) => (process.platform === "win32" ? `${name}.exe` : name);
const cacheRoot = () => process.env.HARBOR_CAPSTAN_CACHE ?? join(homedir(), ".harbor", "capstan-jdk");

export function hostTriple() {
  const arch = process.arch === "arm64" ? "aarch64" : "x86_64";
  if (process.platform === "win32") return `${arch}-pc-windows-msvc`;
  if (process.platform === "darwin") return `${arch}-apple-darwin`;
  return `${arch}-unknown-linux-gnu`;
}

// A macOS JDK unpacks to <dir>/Contents/Home. Every other one, and every jlink image, does not.
export const jdkHome = (dir) =>
  dir && existsSync(join(dir, "Contents", "Home", "jmods")) ? join(dir, "Contents", "Home") : dir;

export const hasJmods = (dir) => Boolean(dir) && existsSync(join(dir, "jmods"));

export function releaseLabel(dir) {
  try {
    const text = readFileSync(join(dir, "release"), "utf8");
    const pick = (key) => text.match(new RegExp(`^${key}="([^"]+)"`, "m"))?.[1];
    return pick("IMPLEMENTOR_VERSION") ?? pick("JAVA_RUNTIME_VERSION") ?? pick("JAVA_VERSION") ?? "unknown";
  } catch {
    return "unknown";
  }
}

export function featureOf(jdk) {
  try {
    const printed = execFileSync(join(jdk, "bin", exe("jlink")), ["--version"], { encoding: "utf8" });
    return Number.parseInt(printed.trim().split(".")[0], 10) || DEFAULT_FEATURE;
  } catch {
    return DEFAULT_FEATURE;
  }
}

async function releaseName(feature) {
  if (process.env.HARBOR_CAPSTAN_JDK_VERSION) return process.env.HARBOR_CAPSTAN_JDK_VERSION;
  const range = `%5B${feature}%2C${feature + 1}%29`;
  const res = await fetch(`${API}/info/release_names?release_type=ga&page_size=1&sort_order=DESC&version=${range}`);
  if (!res.ok) throw new Error(`Adoptium would not list a JDK ${feature} release (${res.status} ${res.statusText})`);
  const name = (await res.json()).releases?.[0];
  if (!name) throw new Error(`Adoptium listed no JDK ${feature} release`);
  return name;
}

// The archive is written into the directory it unpacks into and named by hand, because GNU tar
// reads the C: in an absolute Windows path as a remote host and fails with "Cannot connect to C:".
function unpack(buf, kind, into) {
  mkdirSync(into, { recursive: true });
  const name = kind === "zip" ? "jdk.zip" : "jdk.tar.gz";
  const archive = join(into, name);
  writeFileSync(archive, buf);
  try {
    if (kind === "zip" && process.platform === "win32") {
      const command = `Expand-Archive -LiteralPath "${archive}" -DestinationPath "${into}" -Force`;
      execFileSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", command], { stdio: "inherit" });
    } else if (kind === "zip") {
      execFileSync("unzip", ["-oq", name], { cwd: into, stdio: "inherit" });
    } else {
      execFileSync("tar", ["-xzf", name], { cwd: into, stdio: "inherit" });
    }
  } finally {
    rmSync(archive, { force: true });
  }
}

const onlyChild = (dir) => {
  const found = existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).find((e) => e.isDirectory())
    : undefined;
  return found ? join(dir, found.name) : "";
};

async function fetchJdk(triple, feature, log) {
  const { os, arch } = TARGETS[triple];
  const name = await releaseName(feature);
  const into = join(cacheRoot(), `${name.replace(/\+/g, "_")}-${os}-${arch}`);
  const cached = jdkHome(onlyChild(into));
  if (hasJmods(cached)) {
    log(`${triple} jmods from cache ${cached}`);
    return cached;
  }
  log(`fetching ${name} for ${os}/${arch}, once, into ${into}`);
  const url = `${API}/binary/version/${encodeURIComponent(name)}/${os}/${arch}/jdk/hotspot/normal/eclipse`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`no Temurin ${name} for ${os}/${arch} (${res.status} ${res.statusText})`);
  rmSync(into, { recursive: true, force: true });
  unpack(Buffer.from(await res.arrayBuffer()), os === "windows" ? "zip" : "tar.gz", into);
  const home = jdkHome(onlyChild(into));
  if (!hasJmods(home)) throw new Error(`${name} for ${os}/${arch} unpacked without a jmods/ directory`);
  return home;
}

const OS_NAME = { windows: "Windows", mac: "Darwin", linux: "Linux" };

// jlink takes whatever jmods it is given and says nothing about which platform they are for, and
// neither does the image it writes. The source JDK's own release file does, so it is read here:
// a Windows runtime staged into a macOS bundle would otherwise only be found by a user.
function checkPlatform(dir, triple) {
  const text = existsSync(join(dir, "release")) ? readFileSync(join(dir, "release"), "utf8") : "";
  const found = text.match(/^OS_NAME="([^"]+)"/m)?.[1];
  const want = OS_NAME[TARGETS[triple].os];
  if (found && found !== want) {
    throw new Error(`${dir} is a ${found} JDK, and ${triple} needs a ${want} one`);
  }
}

/*
 * A unix launcher without its exec bit cannot start. Windows carries no such bit, so a runtime
 * cross staged there arrives without one and src-tauri/src/capstan/locate.rs restores it on the
 * way to spawn. Everywhere else it is set here, where the staging machine can still do it.
 */
export function markLaunchers(runtimeDir, target, log) {
  if (TARGETS[target].os === "windows") return;
  if (process.platform === "win32") {
    log(`staged on Windows, so the ${target} launchers carry no exec bit until they are unpacked`);
    return;
  }
  const bin = join(runtimeDir, "bin");
  const names = existsSync(bin) ? readdirSync(bin).map((n) => join(bin, n)) : [];
  for (const helper of ["jexec", "jspawnhelper"]) {
    const path = join(runtimeDir, "lib", helper);
    if (existsSync(path)) names.push(path);
  }
  for (const path of names) chmodSync(path, 0o755);
}

export const FIX = [
  "Set HARBOR_CAPSTAN_JDK to a JDK 17 or newer with jmods/, or",
  "HARBOR_CAPSTAN_JDK_TARGET to an unpacked JDK for the target platform, or",
  "HARBOR_CAPSTAN_JDK_VERSION to a Temurin release name such as jdk-17.0.20+8.",
];

/*
 * Returns { hostJdk, targetJdk }. They are the same directory whenever the target is the host,
 * which is every build that is not cross staging.
 */
export async function resolveJdks(target, log) {
  if (!TARGETS[target]) throw new Error(`unknown target ${target}, known: ${Object.keys(TARGETS).join(", ")}`);
  const named = jdkHome(process.env.HARBOR_CAPSTAN_JDK ?? process.env.JAVA_HOME ?? "");
  const host = hostTriple();
  const hostJdk =
    hasJmods(named) && existsSync(join(named, "bin", exe("jlink")))
      ? named
      : await fetchJdk(host, DEFAULT_FEATURE, log);
  if (target === host) return { hostJdk, targetJdk: hostJdk };

  const forTarget = jdkHome(process.env.HARBOR_CAPSTAN_JDK_TARGET ?? "");
  const targetJdk = hasJmods(forTarget) ? forTarget : await fetchJdk(target, featureOf(hostJdk), log);
  checkPlatform(targetJdk, target);
  return { hostJdk, targetJdk };
}
