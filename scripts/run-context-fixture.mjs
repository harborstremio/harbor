import { spawn } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32")
  throw new Error("The native context fixture probe requires Windows.");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const executable = path.join(
  root,
  "src-tauri/target/context-artifacts/fixture/HarborContextReviewFixture.exe",
);
const reportPath = path.join(
  process.env.APPDATA,
  "app.harbor.context-review/context-fixture-results.json",
);
const started = Date.now();
const child = spawn(executable, [], {
  cwd: path.dirname(executable),
  windowsHide: true,
  stdio: "inherit",
  env: { ...process.env, HARBOR_CONTEXT_FIXTURE_AUTORUN: "1" },
});
const timeout = setTimeout(() => {
  console.error("Isolated fixture timed out; stopping the fixture process.");
  child.kill();
}, 45_000);
try {
  const code = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", resolve);
  });
  if (code !== 0) throw new Error(`Isolated fixture exited with ${code}`);
  if ((await stat(reportPath)).mtimeMs < started)
    throw new Error("Fixture report was not updated.");
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  console.log(JSON.stringify(report, null, 2));
  console.log(`Isolated report: ${reportPath}`);
  process.exitCode = report.passed ? 0 : 1;
} finally {
  clearTimeout(timeout);
}
