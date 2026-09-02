// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { bindSubtitleDownloadAuth } from "../src/lib/subtitles/provider-auth.ts";
import {
  rememberedChoiceFromLoad,
  rememberedFromChoice,
  rememberedSubAppliesToStream,
  rememberedSubtitleLoadMetadata,
  subtitleStreamKey,
} from "../src/lib/subtitles/subtitle-memory.ts";

test("the same torrent release shares a subtitle key across providers", () => {
  const a = subtitleStreamKey({ infoHash: "ABC123", fileIdx: 4, addonId: "provider-a" });
  const b = subtitleStreamKey({ infoHash: "abc123", fileIdx: 4, addonId: "provider-b" });

  assert.equal(a, b);
});

test("different releases receive different subtitle keys", () => {
  const a = subtitleStreamKey({ parsedTitle: "Movie.2024.BluRay.REMUX-GROUP" });
  const b = subtitleStreamKey({ parsedTitle: "Movie.2024.WEB-DL-GROUP" });

  assert.notEqual(a, b);
});

test("subtitle keys never contain a playable URL", () => {
  const key = subtitleStreamKey({
    addonId: "addon",
    parsedTitle: "Movie.2024.1080p.WEB-DL-GROUP",
    source: "webdl",
  });

  assert.ok(key);
  assert.doesNotMatch(key, /https?:|token|signature/i);
});

test("a remembered external subtitle is not restored onto another release", () => {
  const first = { infoHash: "first", fileIdx: 0 };
  const second = { infoHash: "second", fileIdx: 0 };
  const remembered = {
    source: "downloaded-subtitle.srt",
    streamKey: subtitleStreamKey(first),
    updatedAt: 1,
  };

  assert.equal(rememberedSubAppliesToStream(remembered, first), true);
  assert.equal(rememberedSubAppliesToStream(remembered, second), false);
});

test("legacy external choices do not override an identifiable current release", () => {
  const remembered = { source: "downloaded-subtitle.srt", updatedAt: 1 };

  assert.equal(
    rememberedSubAppliesToStream(remembered, { infoHash: "current", fileIdx: 0 }),
    false,
  );
});

test("manual subtitle memory keeps provider identity and non-secret download auth", async () => {
  const downloadAuth = await bindSubtitleDownloadAuth("subsource-api-key", "test-secret");
  assert.ok(downloadAuth);
  const choice = rememberedChoiceFromLoad("memory:prepared-subtitle", "ar", "Release title", {
    originalUrl: "https://example.test/subtitle/42",
    format: "srt",
    encoding: "utf-8",
    provider: "SubSource",
    providerDerived: true,
    release: "Show.S01E02.WEB-DL-GROUP",
    subId: "subsource:42",
    downloadAuth,
    matchScore: 91,
    matchConfidence: "high",
  });
  const remembered = rememberedFromChoice(choice);

  assert.equal(remembered.source, "https://example.test/subtitle/42");
  assert.equal(remembered.provider, "SubSource");
  assert.equal(remembered.providerDerived, true);
  assert.equal(remembered.release, "Show.S01E02.WEB-DL-GROUP");
  assert.equal(remembered.subId, "subsource:42");
  assert.equal(remembered.downloadAuthKind, "subsource-api-key");
  assert.equal("downloadAuth" in remembered, false);
  assert.doesNotMatch(JSON.stringify(remembered), new RegExp(downloadAuth.credentialId));
  assert.doesNotMatch(JSON.stringify(remembered), /test-secret/);
});

test("saved Live Sync subtitles restore as trusted local files, including legacy memories", () => {
  const source = "C:\\Users\\viewer\\AppData\\Roaming\\Harbor\\synced.srt";
  const remembered = rememberedFromChoice({
    source,
    external: true,
    imported: true,
    provider: "Harbor Live Sync",
    providerDerived: false,
  });
  const legacyRemembered = { ...remembered, providerDerived: undefined, updatedAt: 1 };

  assert.equal(remembered.providerDerived, false);
  assert.equal(rememberedSubtitleLoadMetadata(remembered).providerDerived, false);
  assert.equal(rememberedSubtitleLoadMetadata(legacyRemembered).providerDerived, false);
  assert.equal(rememberedSubtitleLoadMetadata(legacyRemembered).originalUrl, source);
});

test("the main player rebinds modal auth handles instead of trusting another WebView registry", () => {
  const menu = readFileSync(
    new URL("../src/components/player/subtitle-menu.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    menu,
    /authKind === "subsource-api-key"[\s\S]*settings\.subsourceApiKey[\s\S]*authKind === "subdl-api-key"[\s\S]*settings\.subdlApiKey/,
  );
  assert.match(menu, /bindSubtitleDownloadAuth\([\s\S]*authKind,[\s\S]*apiKey/);
  assert.match(menu, /onAddSubtitle\(url, lang, title, mainWindowMetadata\)/);
});

test("remembered external subtitles remain authoritative until selection is observed", () => {
  const autoload = readFileSync(
    new URL("../src/views/player/hooks/use-track-autoload.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    autoload,
    /if \(existing\.selected\) \{[\s\S]*subRestoreSelectRef\.current = null/,
    "restoration must complete only after the remembered track is visibly selected",
  );
  assert.match(
    autoload,
    /attempts < 4 && elapsed >= 750[\s\S]*bridge\.setSubtitleTrack\(existing\.id\)/,
    "a track-list race must retry the remembered selection with a bound",
  );
  assert.match(
    autoload,
    /scheduleRestoreCheck\(12_000 - waited \+ 1\)/,
    "the direct-source fallback must run even when no later track event rerenders the player",
  );
  assert.match(
    autoload,
    /remembered\.downloadAuthKind === "subsource-api-key"[\s\S]*settings\.subsourceApiKey[\s\S]*remembered\.downloadAuthKind === "subdl-api-key"[\s\S]*settings\.subdlApiKey/,
    "restoration must rebind the persisted auth kind to the active profile credential",
  );
  assert.match(
    autoload,
    /bindSubtitleDownloadAuth\([\s\S]*remembered\.downloadAuthKind,[\s\S]*rememberedApiKey/,
  );
  assert.match(
    autoload,
    /rememberedSubtitleLoadMetadata\(remembered, downloadAuth\)/,
    "restoration must recover the trust classification of saved local subtitles",
  );
  assert.match(
    autoload,
    /subRestoreTick,[\s\S]*settings\.subsourceApiKey,[\s\S]*settings\.subdlApiKey,[\s\S]*\]\);/,
    "credential changes must rerun remembered subtitle restoration with a fresh handle",
  );
});
