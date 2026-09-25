import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { sanitizeSeekStep } from "../src/lib/seek-step.ts";
import * as language from "../src/lib/subtitles/language.ts";
import { sanitizeScreensaverMedia } from "../src/lib/screensaver/media.ts";
import * as controllerCursor from "../src/lib/gamepad/cursor.ts";

function fixture() {
  const data = new Map<string, string>();
  let playlists: Array<{ kind: string }> = [];
  let adoptionWorks = false;
  let adoptionAttempts = 0;
  const storage = { getItem: (key: string) => data.get(key) ?? null };
  const identity = (value: unknown) => value;
  const dependencies: Record<string, unknown> = {
    "@/lib/theme": {
      DEFAULT_THEME: { preset: "cool-grey", fontPair: "sentient-switzer", backgroundDim: 0.65 },
      FONT_PAIRS: { "sentient-switzer": {} },
      isKnownPreset: () => true,
    },
    "@/lib/subtitles/language": language,
    "@/lib/screensaver/media": { sanitizeScreensaverMedia },
    "@/lib/seek-step": { sanitizeSeekStep },
    "@/lib/ai-models": { migrateModelId: identity, providerTabFor: () => "openrouter" },
    "@/lib/local-time": {
      DEFAULT_FULLSCREEN_CLOCK_SIZE_PX: 18,
      sanitizeFullscreenClockFormat: identity,
      sanitizeFullscreenClockSize: identity,
      sanitizeFullscreenClockStyle: identity,
    },
    "@/lib/poster-backdrop-expansion": { normalizePosterCardSettings: () => ({}) },
    "@/lib/player/subtitle-offset": {
      sanitizeSubtitleOffsetPosition: identity,
      sanitizeSubtitleOffsetSize: identity,
    },
    "@/lib/player/buffer-profile": { sanitizeBufferSize: identity },
    "@/lib/gamepad/cursor": controllerCursor,
    "@/lib/iptv/playlists-store": {
      readPlaylists: () => playlists,
      adoptLegacyPlaylists: () => {
        adoptionAttempts += 1;
        return adoptionWorks;
      },
    },
  };
  function load(path: string): any {
    const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const module = { exports: {} };
    new Function("require", "module", "exports", "localStorage", compiled)(
      (name: string) => {
        if (!(name in dependencies)) throw new Error(`Unexpected fixture dependency: ${name}`);
        return dependencies[name];
      },
      module,
      module.exports,
      storage,
    );
    return module.exports;
  }
  dependencies["./defaults"] = load("../src/lib/settings/defaults.ts");
  const settings = load(
    "../src/lib/settings/load.ts",
  ) as typeof import("../src/lib/settings/load.ts");
  dependencies["@/lib/settings/load"] = settings;
  const images = load(
    "../src/lib/providers/tmdb/tmdb-image-lang.ts",
  ) as typeof import("../src/lib/providers/tmdb/tmdb-image-lang.ts");
  const complete = (extra: Record<string, unknown> = {}) =>
    JSON.stringify({
      _playlistsTabV1: true,
      seekBackStepSec: 10,
      seekForwardStepSec: 30,
      iptvPlaylists: [],
      ...extra,
    });
  return {
    data,
    settings,
    images,
    complete,
    setPlaylists: (next: typeof playlists) => {
      playlists = next;
    },
    permitAdoption: () => {
      adoptionWorks = true;
    },
    adoptionAttempts: () => adoptionAttempts,
  };
}

test("unchanged self-contained settings and image priorities reuse their cached values", () => {
  const f = fixture();
  f.data.set("harbor.settings", f.complete({ tmdbImageLangs: ["Arabic", "Original", "English"] }));
  assert.ok(f.settings.loadStoredSettings() === f.settings.loadStoredSettings());
  assert.ok(f.images.imageLangPriority() === f.images.imageLangPriority());
  assert.deepEqual(f.images.imageLangPriority(), ["ar", null, "en"]);
  assert.equal(f.images.imageLangParam("ja"), "ar,ja,null,en");
});

test("changed settings, profile keys, removal, and invalid JSON invalidate cached values", () => {
  const f = fixture();
  const raw = f.complete({ tmdbImageLangs: ["Arabic"] });
  f.data.set("harbor.settings.one", raw);
  f.data.set("harbor.settings.two", raw);
  const one = f.settings.loadStoredSettings("harbor.settings.one");
  const two = f.settings.loadStoredSettings("harbor.settings.two");
  assert.notEqual(one, two);
  f.data.set("harbor.settings", raw);
  const priority = f.images.imageLangPriority();
  f.data.set("harbor.settings", f.complete({ tmdbImageLangs: ["Japanese", "Original"] }));
  assert.deepEqual(f.images.imageLangPriority(), ["ja", null]);
  assert.notEqual(f.images.imageLangPriority(), priority);
  f.data.delete("harbor.settings");
  assert.deepEqual(f.images.imageLangPriority(), ["en", null]);
  f.data.set("harbor.settings", "invalid fixture JSON");
  assert.deepEqual(f.images.imageLangPriority(), ["en", null]);
  f.data.set("harbor.settings", raw);
  assert.deepEqual(f.images.imageLangPriority(), ["ar"]);
});

test("uncached legacy seek defaults remain live when their separate values change", () => {
  const f = fixture();
  for (const raw of [null, JSON.stringify({ _playlistsTabV1: true })]) {
    if (raw == null) f.data.delete("harbor.settings");
    else f.data.set("harbor.settings", raw);
    f.data.set("harbor.seek-step.back", "5");
    assert.equal(f.settings.loadStoredSettings().seekBackStepSec, 5);
    f.data.set("harbor.seek-step.back", "30");
    assert.equal(f.settings.loadStoredSettings().seekBackStepSec, 30);
  }
});

test("unfinished playlist migration rechecks current lists and retries failed adoption", () => {
  const f = fixture();
  f.data.set("harbor.settings", JSON.stringify({ showPlaylistsTab: false }));
  assert.equal(f.settings.loadStoredSettings().showPlaylistsTab, false);
  f.setPlaylists([{ kind: "m3u" }]);
  assert.equal(f.settings.loadStoredSettings().showPlaylistsTab, true);
  f.data.set("harbor.settings", f.complete({ iptvPlaylists: [{ id: "fixture" }] }));
  assert.equal(f.settings.loadStoredSettings().iptvPlaylists.length, 1);
  f.permitAdoption();
  assert.equal(f.settings.loadStoredSettings().iptvPlaylists.length, 0);
  assert.equal(f.adoptionAttempts(), 2);
});

test("image-language defaults, deduplication, and localization policy remain intact", () => {
  const f = fixture();
  f.data.set(
    "harbor.settings",
    f.complete({ tmdbImageLangs: ["Original", "Arabic", "ar", "Original"] }),
  );
  assert.deepEqual(f.images.imageLangPriority(), [null, "ar"]);
  assert.equal(f.images.imageLangParam("ja"), "ja,null,ar");
  assert.equal(f.images.shouldLocalizePosters(), true);
  f.data.set("harbor.settings", f.complete({ tmdbImageLangs: [], tmdbLanguage: "ar-SA" }));
  assert.deepEqual(f.images.imageLangPriority(), ["en", null]);
  assert.equal(f.images.shouldLocalizePosters(), true);
  f.data.set("harbor.settings", f.complete({ tmdbImageLangs: ["English"], tmdbLanguage: "en-US" }));
  assert.equal(f.images.shouldLocalizePosters(), false);
});
