// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { resolveSubtitleDownloadUrl } from "../src/lib/subtitles/autosync/download-url.ts";

test("subtitle download URLs preserve absolute HTTP links", () => {
  assert.equal(
    resolveSubtitleDownloadUrl("https://cdn.example/subtitle.zip", "https://api.example/v1/"),
    "https://cdn.example/subtitle.zip",
  );
});

test("subtitle download URLs resolve provider-relative links", () => {
  assert.equal(
    resolveSubtitleDownloadUrl("downloads/subtitle.zip", "https://api.example/v1/"),
    "https://api.example/v1/downloads/subtitle.zip",
  );
  assert.equal(
    resolveSubtitleDownloadUrl("/subtitle/file.zip", "https://dl.example/"),
    "https://dl.example/subtitle/file.zip",
  );
});

test("subtitle download URLs reject unsupported schemes", () => {
  assert.equal(resolveSubtitleDownloadUrl("file:///secret.srt", "https://api.example/"), null);
});
