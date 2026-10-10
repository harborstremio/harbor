import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";

const root = fileURLToPath(new URL("../", import.meta.url));
const workflow = readFileSync(
  new URL("../.github/workflows/jl-release.yml", import.meta.url),
  "utf8",
).replace(/\r\n/g, "\n");
const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash";

function jobEnabled(
  job,
  {
    event = "workflow_dispatch",
    ref = "refs/heads/claude/determined-planck-b1p158",
    publish = false,
    windowsOnly = false,
  } = {},
) {
  const section = workflow.split(`\n  ${job}:\n`)[1];
  const condition = section?.match(/^    if: (.+)$/m)?.[1];
  assert.ok(condition, `Missing condition for ${job}`);
  return vm.runInNewContext(condition, {
    github: { event_name: event, ref },
    inputs: { publish, windows_only: windowsOnly },
  });
}

test("Windows-only verification never builds Android or publishes, even if publish is selected", () => {
  for (const publish of [false, true]) {
    assert.equal(jobEnabled("android-tv", { publish, windowsOnly: true }), false);
    assert.equal(jobEnabled("publish", { publish, windowsOnly: true }), false);
    assert.equal(
      jobEnabled("android-tv", { publish, ref: "refs/heads/codex/jl-release-026" }),
      false,
    );
    assert.equal(jobEnabled("publish", { publish, ref: "refs/heads/codex/jl-release-026" }), false);
  }
});

test("normal dual-platform builds keep explicit publication opt-in", () => {
  assert.equal(jobEnabled("android-tv"), true);
  assert.equal(jobEnabled("publish"), false);
  assert.equal(jobEnabled("publish", { publish: true }), true);
  assert.equal(jobEnabled("publish", { event: "push", publish: true }), false);
});

function runStep(name, overrides = {}, cwd = root) {
  const section = workflow.split(`      - name: ${name}\n`)[1];
  assert.ok(section, `Missing workflow step: ${name}`);
  const script = section
    .split("        run: |\n")[1]
    .split(/\n      - /)[0]
    .split("\n")
    .filter((line) => line.startsWith("          "))
    .map((line) => line.slice(10))
    .join("\n")
    .replaceAll("${{ github.repository }}", "example/repo")
    .replaceAll("${{ github.sha }}", "built-commit")
    .replaceAll("${{ needs.windows.outputs.tag }}", "jl-v0.9.26");
  // Exercise the actual workflow shell with an offline GitHub CLI stand-in.
  // An absent draft tag must not resolve until publication creates it.
  const mock = `
published=false
gh() {
  case "$*" in
    "api --paginate "*) printf '%s' "$MOCK_DRAFT" ;;
    *"/git/matching-refs/"*) printf '%s' "$MOCK_REF" ;;
    *"--json targetCommitish"*) printf '%s' "$MOCK_TARGET" ;;
    *"--json assets"*) printf '%s' "$MOCK_ASSETS" ;;
    *"--draft=false --latest"*) published=true; echo PUBLISHED ;;
    *"/commits/"*)
      if [ "$published" != true ] && [ -z "$MOCK_REF" ]; then
        echo 'Draft tag does not exist yet' >&2; return 1
      fi
      printf '%s' "$MOCK_TAG_COMMIT" ;;
    *) echo "Unexpected gh call: $*" >&2; return 1 ;;
  esac
}
`;
  return spawnSync(bash, ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", mock + script], {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    env: {
      ...process.env,
      MOCK_DRAFT: "",
      MOCK_REF: "",
      MOCK_TARGET: "built-commit",
      MOCK_TAG_COMMIT: "built-commit",
      MOCK_ASSETS: "JL-Media-Vision-Setup-x64.exe\nJL-Media-Vision-TV.apk\n",
      ...overrides,
    },
  });
}

test("a new release destination with no draft or tag is allowed", () => {
  const result = runStep("Check release destination");
  assert.equal(result.status, 0, result.stderr);
});

test("an already published release cannot be overwritten", () => {
  const result = runStep("Check release destination", { MOCK_DRAFT: "false" });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /already published/);
});

test("a tag for another commit cannot be reused", () => {
  const result = runStep("Check release destination", {
    MOCK_DRAFT: "true",
    MOCK_REF: "refs/tags/jl-v0.9.26",
    MOCK_TAG_COMMIT: "old-commit",
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /different commit/);
});

test("both assets and the exact draft target permit publication before the tag exists", () => {
  const result = runStep("Verify assets and publish release");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PUBLISHED/);
});

test("missing APK keeps the release unpublished", () => {
  const result = runStep("Verify assets and publish release", {
    MOCK_ASSETS: "JL-Media-Vision-Setup-x64.exe\n",
  });
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stdout, /PUBLISHED/);
});

test("a draft targeting a different commit stays unpublished", () => {
  const result = runStep("Verify assets and publish release", { MOCK_TARGET: "old-commit" });
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stdout, /PUBLISHED/);
});

function retainedInstallers(t) {
  const directory = mkdtempSync(join(tmpdir(), "jl-artifacts-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const file of ["JL-Media-Vision-Setup-x64.exe", "JL-Media-Vision-TV.apk"]) {
    const content = Buffer.from("offline fixture for " + file);
    writeFileSync(join(directory, file), content);
    writeFileSync(
      join(directory, file + ".sha256"),
      createHash("sha256").update(content).digest("hex") + "  " + file + "\n",
    );
  }
  for (const platform of ["windows", "android-tv"]) {
    writeFileSync(join(directory, platform + "-build-commit.txt"), "built-commit\n");
  }
  return directory;
}

test("retained installers verify their checksums and common source commit", (t) => {
  const result = runStep("Verify retained installers", {}, retainedInstallers(t));
  assert.equal(result.status, 0, result.stderr);
});

test("a corrupted retained APK prevents publication", (t) => {
  const directory = retainedInstallers(t);
  writeFileSync(join(directory, "JL-Media-Vision-TV.apk"), "corrupted");
  const result = runStep("Verify retained installers", {}, directory);
  assert.notEqual(result.status, 0);
});

test("a missing retained installer prevents publication", (t) => {
  const directory = retainedInstallers(t);
  unlinkSync(join(directory, "JL-Media-Vision-Setup-x64.exe"));
  const result = runStep("Verify retained installers", {}, directory);
  assert.notEqual(result.status, 0);
});

test("installers built from different commits cannot be combined", (t) => {
  const directory = retainedInstallers(t);
  writeFileSync(join(directory, "android-tv-build-commit.txt"), "other-commit\n");
  const result = runStep("Verify retained installers", {}, directory);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /different commit/);
});
