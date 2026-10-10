import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as formats from "../src/lib/player/sub-format.ts";
import { pickBestTrack } from "../src/lib/subtitles/language.ts";

const source = readFileSync(
  new URL("../src/views/player/hooks/use-secondary-sub.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function select(choice, tracks, lang = "en") {
  const effects = [],
    picked = [];
  const dependencies = {
    react: { useEffect: (effect) => effects.push(effect), useRef: (current) => ({ current }) },
    "@/lib/player/secondary-sub": { resetSecondarySub() {}, useSecondarySubChoice: () => choice },
    "@/lib/player/sub-format": formats,
    "@/lib/player/sub-style": { applySecondarySubNative: async () => {} },
    "@/lib/subtitles/language": { pickBestTrack },
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    (id) => {
      assert.ok(id in dependencies, `Unexpected dependency ${id}`);
      return dependencies[id];
    },
    module,
    module.exports,
  );
  module.exports.useSecondarySub({
    bridgeRef: { current: { setSecondarySubtitleTrack: (id) => picked.push(id) } },
    snap: { subtitleTracks: tracks },
    sourceUrl: "fixture.mkv",
    lang,
  });
  effects.forEach((effect) => effect());
  return picked;
}

const track = (id, codec, extra = {}) => ({
  id,
  codec,
  lang: "en",
  label: id,
  kind: "subtitle",
  ...extra,
});
const primary = track("primary", "subrip", { selected: true });

test("automatic secondary selection skips the preferred bitmap and uses matching text", () => {
  assert.deepEqual(
    select("auto", [
      primary,
      track("bitmap", "hdmv_pgs_subtitle", { default: true }),
      track("text", "subrip"),
    ]),
    ["text"],
  );
});

test("bitmap-only language does not issue an unusable second-subtitle command", () => {
  assert.deepEqual(select("auto", [primary, track("bitmap", "dvd_subtitle")]), []);
});

test("explicit image selection is rejected and an existing image secondary is cleared", () => {
  const bitmap = track("bitmap", "hdmv_pgs_subtitle");
  assert.deepEqual(select("bitmap", [primary, bitmap]), []);
  assert.deepEqual(select("bitmap", [primary, { ...bitmap, secondary: true }]), [null]);
});

test("explicit text selection remains available without duplicating the primary", () => {
  assert.deepEqual(select("text", [primary, track("text", "ass")]), ["text"]);
  assert.deepEqual(select("primary", [primary, track("text", "subrip")]), []);
});

test("turning secondary subtitles off clears a previously selected track", () => {
  assert.deepEqual(select(null, [primary, track("text", "subrip", { secondary: true })]), [null]);
});

test("known bitmap formats are excluded while text and unknown tracks remain eligible", () => {
  for (const codec of [
    "PGS",
    "HDMV_PGS_SUBTITLE",
    "DVD_SUBTITLE",
    "DVB_SUBTITLE",
    "VOBSUB",
    "XSUB",
  ]) {
    assert.equal(formats.canBeSecondarySub(track("bitmap", codec)), false, codec);
  }
  for (const codec of ["SUBRIP", "WEBVTT", "ASS", "SSA", "MOV_TEXT", undefined]) {
    assert.equal(formats.canBeSecondarySub(track("text", codec)), true, codec);
  }
  assert.equal(formats.canBeSecondarySub(null), false);
});
