// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const workflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");

function nativeChangePathspecs(): string[] {
  const detectionStep = workflow.match(
    /- name: Detect native changes[\s\S]*?(?=\n\s+- name: Skip native check)/,
  )?.[0];

  assert.ok(detectionStep, "Native change detection step must exist");

  return [...detectionStep.matchAll(/^\s+('?[^\s']+'?) \\\s*$/gm)].map((match) =>
    match[1].replace(/^'|'$/g, ""),
  );
}

test("native CI watches every file in both Rust projects", () => {
  const pathspecs = nativeChangePathspecs();

  assert.ok(
    pathspecs.includes("src-tauri"),
    "src-tauri must be watched as a directory so Tauri config and capability changes run native checks",
  );
  assert.ok(pathspecs.includes("harbor-core"), "harbor-core must be watched as a directory");
});

test("pull request checks diff from the synthetic merge base parent", () => {
  const pullRequestBaseSelections = workflow.matchAll(
    /if \[\[ "\$GITHUB_EVENT_NAME" == "pull_request" \]\]; then\s+BASE_SHA="\$\{GITHUB_SHA\}\^1"/g,
  );

  assert.equal(
    [...pullRequestBaseSelections].length,
    2,
    "frontend and native checks must exclude unrelated commits added to main after the PR opened",
  );
});
