import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";

const source = readFileSync(new URL("../android-extension-compat/tools/deps.sh", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const get = source.match(/^get\(\) \{[\s\S]*?^\}/m)?.[0];
assert.ok(get, "Test the production get() function");
const shell = process.platform === "win32"
  ? join(process.env.ProgramFiles ?? "C:/Program Files", "Git", "bin", "bash.exe")
  : "sh";

function cleanup(root) {
  const target = resolve(root);
  assert.equal(dirname(target), resolve(tmpdir()));
  assert.ok(basename(target).startsWith("harbor-capstan-retry-"));
  rmSync(target, { recursive: true, force: true });
}

function download(mode, cached = false) {
  const root = mkdtempSync(join(tmpdir(), "harbor-capstan-retry-"));
  const bin = join(root, "bin");
  const destination = join(root, "libs");
  const count = join(root, "attempts");
  mkdirSync(bin);
  mkdirSync(destination);
  writeFileSync(join(bin, "curl"), `#!/bin/sh
set -e
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-o" ]; then out="$2"; shift; fi
  shift
done
n=0
if [ -f "$COUNT_FILE" ]; then n=$(cat "$COUNT_FILE"); fi
n=$((n + 1))
printf '%s' "$n" > "$COUNT_FILE"
# A retry must remove the preceding process's partial bytes first.
[ ! -e "$out" ] || exit 88
printf '%s' 'partial bytes' > "$out"
if [ "$MODE" = "persistent" ] || [ "$n" -eq 1 ]; then exit 139; fi
printf '%s' 'complete synthetic jar' > "$out"
`, { mode: 0o755 });
  writeFileSync(join(bin, "sleep"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  if (cached) writeFileSync(join(destination, "fixture.jar"), "cached jar");
  const result = spawnSync(shell, ["-c", `
set -e
mock_bin="$1"
if command -v cygpath >/dev/null 2>&1; then mock_bin=$(cygpath -u "$mock_bin"); fi
export PATH="$mock_bin:$PATH"
shift
${get}
get "$@"
`, "capstan-fixture", bin, "fixture.jar", destination, "https://example.invalid/fixture.jar"], {
    encoding: "utf8",
    timeout: 10000,
    env: { ...process.env, COUNT_FILE: count, MODE: mode },
  });
  return { root, destination, count, result };
}

test("Capstan dependency download recovers from curl exit139 without retaining partial bytes", () => {
  const f = download("recover");
  try {
    assert.ifError(f.result.error);
    assert.equal(f.result.status, 0, f.result.stderr);
    assert.equal(readFileSync(f.count, "utf8"), "2");
    assert.deepEqual(readdirSync(f.destination), ["fixture.jar"]);
    assert.equal(readFileSync(join(f.destination, "fixture.jar"), "utf8"), "complete synthetic jar");
  } finally { cleanup(f.root); }
});

test("Capstan dependency download fails after three crashes and leaves no accepted file", () => {
  const f = download("persistent");
  try {
    assert.ifError(f.result.error);
    assert.equal(f.result.status, 1, f.result.stderr);
    assert.equal(readFileSync(f.count, "utf8"), "3");
    assert.deepEqual(readdirSync(f.destination), []);
    assert.match(f.result.stdout, /FAILED fixture\.jar after 3 attempts/);
  } finally { cleanup(f.root); }
});

test("Capstan dependency download preserves its existing nonempty cache", () => {
  const f = download("persistent", true);
  try {
    assert.ifError(f.result.error);
    assert.equal(f.result.status, 0, f.result.stderr);
    assert.equal(existsSync(f.count), false);
    assert.equal(readFileSync(join(f.destination, "fixture.jar"), "utf8"), "cached jar");
  } finally { cleanup(f.root); }
});
