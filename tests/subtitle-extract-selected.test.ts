import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, writeFile, stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ts from "typescript";
import { parseSubtitle } from "../src/lib/subtitles/parser.ts";
import { decodeSubtitleBytes } from "../src/lib/subtitles/encoding.ts";
import * as preparation from "../src/lib/subtitles/prepare.ts";

function loadModule(file: string, deps: Record<string, unknown>) {
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const output: any = {};
  new Function("require", "exports", code)((id: string) => {
    if (!(id in deps)) throw new Error(id);
    return deps[id];
  }, output);
  return output;
}

function sourceBridge(url: string) {
  return {
    getSelectedTrackCues: () => null,
    getSelectedTrackUrl: () => url,
    subscribe(fn: (s: unknown) => void) {
      fn({
        subtitleTracks: [
          { id: "1", external: false },
          { id: "3", external: true, selected: true, format: "srt" },
        ],
      });
      return () => {};
    },
  };
}

test("an unreadable external subtitle cannot fall back to a different embedded track", async () => {
  const previousWindow = globalThis.window;
  Object.assign(globalThis, { window: { __TAURI_INTERNALS__: {} } });
  const commands: unknown[] = [];
  const output = loadModule("../src/lib/subtitles/extract.ts", {
    "@tauri-apps/api/core": {
      convertFileSrc: (value: string) => value,
      invoke: async (...args: unknown[]) => {
        commands.push(args);
        return "1\n00:00:01,000 --> 00:00:02,000\nWRONG TRACK\n";
      },
    },
    "./parser": {
      parseSubtitle,
      fetchAndParse: async () => {
        throw new Error("unavailable");
      },
    },
    "./encoding": { decodeSubtitleBytes },
    "./prepare": preparation,
    "./save-to-disk": {
      readNonNetworkSubtitleBytes: async () => {
        throw new Error("unexpected local read");
      },
    },
  });
  try {
    const result = await output.getCuesAnySource(
      sourceBridge("https://subtitle.invalid/expired.srt"),
      "fixture-video.mkv",
    );
    assert.equal(result.ok, false);
    assert.deepEqual(commands, [], "never extracts the unrelated first embedded subtitle");
  } finally {
    Object.assign(globalThis, { window: previousWindow });
  }
});

test("a saved single long cue survives bounded local read and decoding without provider-candidate heuristics", async () => {
  const previousWindow = globalThis.window;
  Object.assign(globalThis, { window: { __TAURI_INTERNALS__: {} } });
  const fixture = await mkdtemp(path.join(tmpdir(), "harbor-subtitle-read-test-"));
  const savedPath = path.join(fixture, "synced.srt");
  // Same bytes as the controlled Live sync native save: +0.1 baked into a 357s cue.
  const savedText = "1\n00:00:02,100 --> 00:05:59,100\nHarbor synthetic subtitle track\n";
  const cues = parseSubtitle(savedText);
  let embeddedExtractions = 0;
  const checkPath = (value: string) => {
    assert.equal(path.resolve(value), path.resolve(savedPath));
    return value;
  };
  const reader = loadModule("../src/lib/subtitles/save-to-disk.ts", {
    "@/lib/download-text": {
      downloadText: async () => {
        throw new Error("no save operation expected");
      },
    },
    "./limit-signal": { markLimitReached() {} },
    "./provider-auth": {
      providerSubtitleDownloadHeaders() {
        return {};
      },
    },
    "./prepare": preparation,
    "@tauri-apps/plugin-fs": {
      stat: (value: string) => stat(checkPath(value)),
      readFile: (value: string) => readFile(checkPath(value)),
    },
  });
  const output = loadModule("../src/lib/subtitles/extract.ts", {
    "@tauri-apps/api/core": {
      convertFileSrc: () => "http://asset.localhost/synthetic-saved.srt",
      invoke: async () => {
        embeddedExtractions++;
        throw new Error("unrelated embedded extraction");
      },
    },
    "./parser": {
      parseSubtitle,
      fetchAndParse: async () => {
        throw new Error("asset.localhost is not a native HTTP server");
      },
    },
    "./encoding": { decodeSubtitleBytes },
    "./prepare": preparation,
    "./save-to-disk": reader,
  });
  try {
    await writeFile(savedPath, savedText);
    const bytes = await readFile(savedPath);
    await assert.rejects(
      preparation.prepareSubtitleBytes(
        savedPath,
        bytes,
        { format: "srt" },
        {
          createPlayable: async () => ({ url: "synthetic", cleanup() {} }),
        },
      ),
      /subtitle cues failed validation/,
      "provider screening remains stricter than reading the selected local file",
    );
    assert.deepEqual(await output.getCuesAnySource(sourceBridge(savedPath), "fixture-video.mkv"), {
      ok: true,
      source: { cues, format: "srt" },
    });
    assert.equal(cues[0].end - cues[0].start, 357);
    await assert.rejects(reader.readNonNetworkSubtitleBytes(savedPath, 8), /byte limit/);
    await rm(savedPath);
    assert.deepEqual(await output.getCuesAnySource(sourceBridge(savedPath), "fixture-video.mkv"), {
      ok: false,
      reason: "read-failed",
    });
    assert.equal(embeddedExtractions, 0);
  } finally {
    Object.assign(globalThis, { window: previousWindow });
    const resolved = path.resolve(fixture);
    assert.ok(resolved.startsWith(path.resolve(tmpdir()) + path.sep));
    assert.ok(path.basename(resolved).startsWith("harbor-subtitle-read-test-"));
    await rm(resolved, { recursive: true, force: true });
  }
});
