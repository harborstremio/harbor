// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { subtitleDownloadArgs } from "../src/lib/player/subtitle-load.ts";
import { decodeSubtitleBytes } from "../src/lib/subtitles/encoding.ts";

const html5BridgeSource = readFileSync(
  new URL("../src/lib/player/html5/bridge.ts", import.meta.url),
  "utf8",
);

test("passes provider format and encoding to the native subtitle downloader", () => {
  assert.deepEqual(
    subtitleDownloadArgs("https://example.test/subtitle?id=1", {
      lang: "ar",
      format: "ass",
      encoding: "windows-1256",
    }),
    {
      url: "https://example.test/subtitle?id=1",
      lang: "ar",
      format: "ass",
      encoding: "windows-1256",
    },
  );
});

test("keeps subtitle metadata on HTML5 tracks for decoding", () => {
  assert.match(
    html5BridgeSource,
    /const track: SubTrack = \{[\s\S]*?loading: false,[\s\S]*?metadata,[\s\S]*?\};/,
  );
});

test("uses nulls for subtitle metadata that is not available", () => {
  assert.deepEqual(subtitleDownloadArgs("https://example.test/subtitle", {}), {
    url: "https://example.test/subtitle",
    lang: null,
    format: null,
    encoding: null,
  });
});

test("decodes legacy Arabic subtitle bytes as Windows-1256", () => {
  const bytes = Uint8Array.from([
    0xe3, 0xd1, 0xcd, 0xc8, 0xc7, 0x20, 0xc8, 0xc7, 0xe1, 0xda, 0xc7, 0xe1, 0xe3,
  ]);
  assert.equal(decodeSubtitleBytes(bytes, { lang: "ar" }), "مرحبا بالعالم");
});
