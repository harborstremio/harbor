import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const workflow = readFileSync(new URL("../.github/workflows/jl-release.yml", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash";

function runStep(name, overrides = {}) {
  const section = workflow.split(`      - name: ${name}\n`)[1];
  assert.ok(section, `Missing workflow step: ${name}`);
  const script = section.split("        run: |\n")[1].split(/\n      - /)[0]
    .split("\n").map((line) => line.slice(10)).join("\n")
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
    cwd: root, encoding: "utf8", windowsHide: true,
    env: {
      ...process.env, MOCK_DRAFT: "", MOCK_REF: "", MOCK_TARGET: "built-commit",
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
  const result = runStep("Check release destination", { MOCK_DRAFT: "true", MOCK_REF: "refs/tags/jl-v0.9.26", MOCK_TAG_COMMIT: "old-commit" });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /different commit/);
});

test("both assets and the exact draft target permit publication before the tag exists", () => {
  const result = runStep("Verify assets and publish release");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PUBLISHED/);
});

test("missing APK keeps the release unpublished", () => {
  const result = runStep("Verify assets and publish release", { MOCK_ASSETS: "JL-Media-Vision-Setup-x64.exe\n" });
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stdout, /PUBLISHED/);
});

test("a draft targeting a different commit stays unpublished", () => {
  const result = runStep("Verify assets and publish release", { MOCK_TARGET: "old-commit" });
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stdout, /PUBLISHED/);
});
