import { readFile, mkdir, copyFile, cp } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertReviewIsolation, mergeReviewConfig } from "./context-review-config.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const flags = process.argv.slice(2);
if (flags.some((flag) => !["--fixture", "--debug"].includes(flag)))
  throw new Error("Usage: node scripts/build-context-review.mjs [--fixture] [--debug]");
const fixture = flags.includes("--fixture");
const read = async (name) => JSON.parse(await readFile(path.join(root, "src-tauri", name), "utf8"));
let config = await read("tauri.conf.json");
if (process.platform === "win32")
  config = mergeReviewConfig(config, await read("tauri.windows.conf.json"));
config = mergeReviewConfig(config, await read("tauri.context-review.conf.json"));
if (fixture) config = mergeReviewConfig(config, await read("tauri.context-fixture.conf.json"));
assertReviewIsolation(config);
const args = [
  "tauri",
  "build",
  "--no-bundle",
  "--config",
  "src-tauri/tauri.context-review.conf.json",
  "--features",
  fixture ? "context-fixture" : "context-review",
];
if (fixture) args.push("--config", "src-tauri/tauri.context-fixture.conf.json");
if (flags.includes("--debug")) args.push("--debug");
const target = path.join(root, "src-tauri", "target");
const artifact = path.join(target, "context-artifacts", fixture ? "fixture" : "full");
console.log(`Building isolated ${fixture ? "native fixture" : "full Harbor"}: ${target}`);
// RTK launches pnpm on Windows without shell string interpolation.
const child = spawn("rtk", ["proxy", "pnpm", ...args], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, CARGO_TARGET_DIR: target },
});
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", async (code) => {
  if (code !== 0) {
    process.exitCode = code ?? 1;
    return;
  }
  try {
    await mkdir(artifact, { recursive: true });
    const profile = flags.includes("--debug") ? "debug" : "release";
    const executable = process.platform === "win32" ? "harbor.exe" : "harbor";
    const filename =
      process.platform === "win32"
        ? fixture
          ? "HarborContextReviewFixture.exe"
          : "HarborContextReview.exe"
        : "harbor-context-review";
    await copyFile(path.join(target, profile, executable), path.join(artifact, filename));
    if (process.platform === "win32") {
      await copyFile(
        path.join(root, "src-tauri/libmpv/libmpv-2.dll"),
        path.join(artifact, "libmpv-2.dll"),
      );
      for (const name of ["ffmpeg", "ffprobe", "yt-dlp", "mpv"])
        await copyFile(
          path.join(root, `src-tauri/binaries/${name}-x86_64-pc-windows-msvc.exe`),
          path.join(artifact, `${name}.exe`),
        );
    }
    await cp(path.join(root, "src-tauri/fonts"), path.join(artifact, "fonts"), { recursive: true });
    console.log(`Isolated artifact: ${path.join(artifact, filename)}`);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
});
