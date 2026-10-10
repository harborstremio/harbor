// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const frontend = readFileSync(new URL("../src/lib/trailer.ts", import.meta.url), "utf8");
const backend = readFileSync(new URL("../src-tauri/src/trailer.rs", import.meta.url), "utf8");

function numericConstant(source: string, name: string): number {
  const match = source.match(
    new RegExp(`const ${name}[^=]*=\\s*(?:Duration::from_secs\\()?([0-9_]+)`),
  );
  assert.ok(match, `${name} must remain an inspectable numeric constant`);
  return Number(match[1].replaceAll("_", ""));
}

function stringConstant(name: string): string {
  const match = backend.match(new RegExp(`const ${name}: &str =\\s*"([^"]+)";`));
  assert.ok(match, `${name} must remain an inspectable selector constant`);
  return match[1];
}

test("the frontend waits beyond the native metadata plus two-attempt worst case", () => {
  const frontendTimeoutMs = numericConstant(frontend, "TRAILER_FETCH_TIMEOUT_MS");
  const metadataSeconds = numericConstant(backend, "METADATA_TIMEOUT");
  const progressiveSeconds = numericConstant(backend, "DOWNLOAD_TIMEOUT");
  const fetchBody = backend.slice(backend.indexOf("pub async fn fetch_trailer"));
  const inlineTimeouts = [...fetchBody.matchAll(/Duration::from_secs\(([0-9_]+)\)/g)].map((match) =>
    Number(match[1].replaceAll("_", "")),
  );
  const adaptiveSeconds = Math.max(...inlineTimeouts);
  const nativeWorstCaseMs = (metadataSeconds + progressiveSeconds + adaptiveSeconds) * 1_000;

  assert.equal(nativeWorstCaseMs, 375_000, "the contract should track the current native budget");
  assert.ok(
    frontendTimeoutMs > nativeWorstCaseMs,
    `frontend ${frontendTimeoutMs}ms must exceed native ${nativeWorstCaseMs}ms`,
  );
});

test("progressive selectors cannot choose video-only or audio-only formats", () => {
  for (const name of ["FORMAT_LOW", "FORMAT_HIGH"]) {
    const alternatives = stringConstant(name).split("/");
    for (const selector of alternatives) {
      const knownProgressiveId = selector === "18" || selector === "22";
      assert.ok(
        knownProgressiveId ||
          (selector.includes("vcodec!=none") && selector.includes("acodec!=none")),
        `${name} contains an unconstrained progressive selector: ${selector}`,
      );
    }
  }
});

test("adaptive fallback selectors stay height-bounded and cannot silently select progressive best", () => {
  for (const name of ["FORMAT_LOW_MERGED", "FORMAT_HIGH_MERGED"]) {
    const alternatives = stringConstant(name).split("/");
    for (const selector of alternatives) {
      assert.match(selector, /height<=/);
      assert.match(selector, /\+/);
      assert.doesNotMatch(selector, /^best\[/);
    }
  }
});

test("selector routing only merges high-quality primaries and uses a genuinely different fallback", () => {
  assert.match(
    backend,
    /fn should_merge[\s\S]*ffmpeg_available && matches!\(quality, "1080p" \| "best"\)/,
  );
  assert.match(backend, /\("1080p", true\) => FORMAT_1080/);
  assert.match(backend, /\("best", true\) => FORMAT_BEST/);
  assert.match(backend, /\("360p", _\) => FORMAT_LOW/);
  assert.match(backend, /if primary_merged \{[\s\S]*Some\(\(FORMAT_HIGH, false\)\)/);
  assert.match(backend, /if !ffmpeg_available \{[\s\S]*return None;/);
  assert.match(backend, /"360p" => Some\(\(FORMAT_LOW_MERGED, true\)\)/);
  assert.match(backend, /"720p" => Some\(\(FORMAT_HIGH_MERGED, true\)\)/);
});
