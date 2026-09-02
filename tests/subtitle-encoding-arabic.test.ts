// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { decodeSubtitleBytes, decodeSubtitleBytesDetailed } from "../src/lib/subtitles/encoding.ts";
import {
  ARABIC_SRT,
  ISO_8859_6_ARABIC_DIALOGUE_SRT,
  ISO_8859_6_ARABIC_DIALOGUE_TWO_SRT,
  ISO_8859_6_ARABIC_PHRASE_SRT,
  ISO_8859_6_ARABIC_SRT,
  WINDOWS_1256_ARABIC_SRT,
  utf16WithBom,
} from "./fixtures/subtitle-p2-fixtures.ts";

test("healthy UTF-8 Arabic is preserved and reported", () => {
  const result = decodeSubtitleBytesDetailed(new TextEncoder().encode(ARABIC_SRT), {
    lang: "ar-SA",
  });
  assert.equal(result.encoding, "utf-8");
  assert.equal(result.text, ARABIC_SRT);
  assert.equal(result.healthy, true);
  assert.ok(result.healthScore >= 0.72);
  assert.equal(
    decodeSubtitleBytes(new TextEncoder().encode(ARABIC_SRT), { lang: "ar" }),
    ARABIC_SRT,
  );
});

test("mixed Arabic and English remains byte-for-byte healthy UTF-8", () => {
  const mixed = `${ARABIC_SRT}2\n00:00:04,000 --> 00:00:06,000\nHarbor مرحبا 2026\n`;
  const result = decodeSubtitleBytesDetailed(new TextEncoder().encode(mixed), { lang: "ar" });
  assert.equal(result.encoding, "utf-8");
  assert.equal(result.text, mixed);
  assert.equal(result.healthy, true);
});

test("invalid UTF-8 Arabic bytes select Windows-1256 by scored fallback", () => {
  const result = decodeSubtitleBytesDetailed(WINDOWS_1256_ARABIC_SRT, { lang: "ara" });
  assert.equal(result.encoding, "windows-1256");
  assert.match(result.text, /سلام/u);
  assert.equal(result.healthy, true);
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === "invalid-utf8"));
  assert.deepEqual(
    new Set(result.candidates.map((candidate) => candidate.encoding)),
    new Set(["utf-8", "windows-1256", "iso-8859-6", "windows-1252"]),
  );
});

test("an explicit ISO-8859-6 hint participates in scoring", () => {
  const result = decodeSubtitleBytesDetailed(ISO_8859_6_ARABIC_SRT, {
    lang: "ar",
    encoding: "iso8859-6",
  });
  assert.equal(result.encoding, "iso-8859-6");
  assert.match(result.text, /سلام/u);
  assert.equal(result.healthy, true);
});

test("ISO-8859-6 Arabic is selected without an explicit encoding hint", () => {
  const result = decodeSubtitleBytesDetailed(ISO_8859_6_ARABIC_SRT, { lang: "ar" });
  assert.equal(result.encoding, "iso-8859-6");
  assert.match(result.text, /سلام/u);
  assert.equal(result.healthy, true);
});

test("ordinary ISO-8859-6 Arabic is selected without relying on a one-word fixture", () => {
  const result = decodeSubtitleBytesDetailed(ISO_8859_6_ARABIC_PHRASE_SRT, { lang: "ar" });
  assert.equal(result.encoding, "iso-8859-6");
  assert.match(result.text, /مرحبا بالعالم/u);
  assert.equal(result.healthy, true);
});

for (const [label, bytes, expected] of [
  ["everyday dialogue", ISO_8859_6_ARABIC_DIALOGUE_SRT, /كيف حالك اليوم/u],
  ["longer dialogue", ISO_8859_6_ARABIC_DIALOGUE_TWO_SRT, /إنه أمر صعب/u],
] as const) {
  test(`multi-cue ISO-8859-6 ${label} remains healthy without a hint`, () => {
    const result = decodeSubtitleBytesDetailed(bytes, { lang: "ar" });
    assert.equal(result.encoding, "iso-8859-6");
    assert.match(result.text, expected);
    assert.equal(result.healthy, true);
    assert.ok(
      !result.diagnostics.some((diagnostic) => diagnostic.code === "ambiguous-legacy-encoding"),
    );
  });
}

test("near-tied Arabic legacy decodes fail closed instead of claiming healthy text", () => {
  const prefix = new TextEncoder().encode("1\n00:00:01,000 --> 00:00:03,000\n");
  const bytes = new Uint8Array([...prefix, 0xe5, 0x0a]);
  const result = decodeSubtitleBytesDetailed(bytes, { lang: "ar" });

  assert.equal(result.healthy, false);
  assert.ok(
    result.diagnostics.some((diagnostic) => diagnostic.code === "ambiguous-legacy-encoding"),
  );
});

test("Arabic candidates do not displace Windows-1252 for a declared non-Arabic subtitle", () => {
  const bytes = new Uint8Array([
    ...[..."1\n00:00:01,000 --> 00:00:03,000\ncaf"].map((character) => character.charCodeAt(0)),
    0xe9,
    0x0a,
  ]);
  const result = decodeSubtitleBytesDetailed(bytes, { lang: "fr" });
  assert.equal(result.encoding, "windows-1252");
  assert.match(result.text, /café/u);
});

for (const [label, littleEndian] of [
  ["UTF-16LE", true],
  ["UTF-16BE", false],
] as const) {
  test(`${label} BOM is authoritative`, () => {
    const result = decodeSubtitleBytesDetailed(utf16WithBom(ARABIC_SRT, littleEndian), {
      lang: "ar",
    });
    assert.equal(result.encoding, littleEndian ? "utf-16le" : "utf-16be");
    assert.equal(result.text, ARABIC_SRT);
    assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === "bom-detected"));
    assert.ok(!result.diagnostics.some((diagnostic) => diagnostic.code === "invalid-utf8"));
  });
}

test("replacement and unexpected control damage lowers decode health", () => {
  const damaged = new TextEncoder().encode(`${ARABIC_SRT}\uFFFD\u0001`);
  const result = decodeSubtitleBytesDetailed(damaged, { lang: "ar" });
  assert.equal(result.encoding, "utf-8");
  assert.equal(result.healthy, false);
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === "low-decode-health"));
});
