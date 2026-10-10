// @ts-expect-error Node test types are outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are outside the browser-only tsconfig.
import test from "node:test";
import { prepareSubtitle, SubtitlePreparationError } from "../src/lib/subtitles/prepare.ts";
import { createSubtitleTranslationQueue, subtitleTranslationStatus, publishSubtitleTranslations } from "../src/lib/subtitles/translation-jobs.ts";
import { fetchSubtitlesIntoPlayer } from "../src/lib/subtitles/fetch-into-player.ts";
import { rankSubtitleCandidates } from "../src/lib/subtitles/candidate-ranking.ts";
import { prepareConsensusCandidate } from "../src/lib/subtitles/autosync/consensus.ts";
import { isGeneratedLangLabel, isPlausibleLang } from "../src/lib/subtitles/language.ts";
import { subtitleLoadMetadataOf, subtitleTitleOf } from "../src/lib/subtitles/provider-label.ts";
import { deferred, flushBridge, mpvBridgeHarness } from "./helpers/mpv-bridge-harness.ts";

const url = "https://subtitles.test/addon/config/translate/source/hi.srt";
const pending = () => new SubtitlePreparationError("translation-pending", "fixture pending");
const srt = "1\n00:00:01,000 --> 00:00:03,000\nOne\n\n2\n00:00:04,000 --> 00:00:06,000\nTwo\n";
const candidate = { id: "translation", url, source: "addon" as const, lang: "Make Hindi", label: "Make Hindi • source release", title: "SubMaker" };
const prepared = (cleanup = () => {}) => ({ playableUrl: "memory:final.srt", format: "srt", cues: [{ start: 1, end: 3, text: "Final translation" }], cleanup });

test("only advertised pending responses are retried; corrupt/final error payloads stay failures", async () => {
  for (const filename of ["translating_hi.srt", "click_to_translate_hi.srt"]) {
    await assert.rejects(prepareSubtitle({ url, translation: true }, {
      fetchBytes: async () => new Response(srt, { headers: { "content-disposition": `attachment; filename="${filename}"` } }),
      createPlayable: async () => { throw new Error("Pending bytes must not be played"); },
    }), (error) => error.reason === "translation-pending");
  }
  for (const body of ["<html>Bad gateway</html>", "1\n00:00:00,000 --> 04:00:00,000\nTranslation failed"]) {
    await assert.rejects(prepareSubtitle({ url, translation: true }, {
      fetchBytes: async () => new Response(body, { headers: { "content-disposition": 'attachment; filename="translated_hi.srt"' } }),
    }), (error) => error.reason !== "translation-pending");
  }
  const final = await prepareSubtitle({ url, translation: true }, {
    fetchBytes: async () => new Response(srt, { headers: { "content-disposition": 'attachment; filename="translated_hi.srt"' } }),
    createPlayable: async () => ({ url: "memory:final", cleanup() {} }),
  });
  assert.equal(final.cues.length, 2);
  final.cleanup();
});

for (const deep of [false, true]) {
  test(`translation offers are discoverable but never prefetched (${deep ? "deep" : "initial"})`, async () => {
    const downloads: string[] = [];
    const result = await fetchSubtitlesIntoPlayer({
      bridge: { addSubtitle: async (url) => { downloads.push(url); return true; } } as never,
      src: { url: "fixture.mkv", meta: { id: "tt123", name: "Fixture", type: "movie" } } as never,
      settings: { subProvidersEnabled: {} } as never,
      addons: [], langs: [], isActive: () => true, deep,
    }, {
      search: async (_query, options) => { options.onPartial?.([candidate], 0); return [candidate]; },
      prepare: async (input) => { downloads.push(input.url); throw new Error("Must not fetch an action"); },
    });
    assert.deepEqual(downloads, []);
    assert.equal(result.generated[0].label, "Make Hindi");
    assert.equal(result.generated[0].count, 1);
    assert.equal(subtitleTitleOf(candidate), candidate.label);
    assert.equal(subtitleLoadMetadataOf(candidate).translation, true);
    assert.equal(isGeneratedLangLabel("Brazilian Portuguese"), false);
    assert.equal(isGeneratedLangLabel("SubMaker Notice"), false);
    assert.equal(isPlausibleLang("Make Portuguese (Brazil)"), true);
  });
}

test("translation polling is serialized and ends at ten minutes", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
  const queue = createSubtitleTranslationQueue();
  t.after(() => { queue.clear(); t.mock.timers.reset(); });
  let calls = 0;
  const slow = deferred<boolean>();
  await queue.run(url, () => true, async () => { if (++calls === 1) throw pending(); return slow.promise; });
  assert.equal(subtitleTranslationStatus(url), "pending");
  t.mock.timers.tick(30_000);
  await flushBridge();
  t.mock.timers.tick(90_000);
  await flushBridge();
  assert.equal(calls, 2, "no overlapping request while a response is unresolved");
  slow.reject(pending());
  await flushBridge();
  t.mock.timers.tick(10 * 60_000);
  await flushBridge();
  assert.equal(calls, 2);
  assert.equal(subtitleTranslationStatus(url), "failed");
});

test("cancelled in-flight work cannot republish a pending/failed state", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
  const queue = createSubtitleTranslationQueue();
  t.after(() => { queue.clear(); t.mock.timers.reset(); });
  const response = deferred<boolean>();
  const first = queue.run(url, () => true, () => response.promise);
  queue.clear();
  response.reject(pending());
  assert.equal(await first, false);
  t.mock.timers.tick(60_000);
  assert.equal(subtitleTranslationStatus(url), null);
});

for (const action of ["off", "other-track", "next-media", "destroy", "detach"]) {
  test(`mpv translation response cannot override ${action}`, async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
    const h = mpvBridgeHarness();
    t.after(() => { h.bridge.destroy(); publishSubtitleTranslations([]); t.mock.timers.reset(); });
    await h.bridge.load({ url: "first.mkv" });
    h.emit("track-list", [{ id: 1, type: "sub", selected: true }, { id: 2, type: "sub" }]);
    h.emit("sub-text", "Working subtitle");
    let calls = 0;
    let cleanups = 0;
    const final = deferred<unknown>();
    h.prepareWith(async () => { if (++calls === 1) throw pending(); return final.promise; });
    assert.equal(await h.bridge.addSubtitle(url, "Make Hindi", "Translation", true, { translation: true }), false);
    assert.equal(h.snapshot().subText, "Working subtitle");
    assert.equal(h.commands.some((entry) => entry.command === "mpv_sub_remove"), false);
    t.mock.timers.tick(30_000);
    await flushBridge();
    if (action === "off") h.bridge.setSubtitleTrack(null);
    if (action === "other-track") h.bridge.setSubtitleTrack("2");
    if (action === "next-media") await h.bridge.load({ url: "second.mkv" });
    if (action === "destroy") h.bridge.destroy();
    if (action === "detach") h.bridge.detach();
    final.resolve(prepared(() => cleanups++));
    await flushBridge();
    assert.equal(h.commands.filter((entry) => entry.command === "mpv_sub_add").length, 0);
    assert.equal(cleanups, 1);
    assert.equal(subtitleTranslationStatus(url), null);
  });
}

test("mpv adds one completed translation and preserves its original selection request", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
  const h = mpvBridgeHarness();
  t.after(() => { h.bridge.destroy(); t.mock.timers.reset(); });
  await h.bridge.load({ url: "fixture.mkv" });
  let calls = 0;
  h.prepareWith(async () => { if (++calls === 1) throw pending(); return prepared(); });
  assert.equal(await h.bridge.addSubtitle(url, "Make Hindi", "Translation", true, { translation: true }), false);
  t.mock.timers.tick(30_000);
  await flushBridge();
  const additions = h.commands.filter((entry) => entry.command === "mpv_sub_add");
  assert.equal(additions.length, 1);
  assert.equal(additions[0].args.select, true);
  assert.equal(additions[0].args.lang, "hi", "completed translations use a real language code");
  assert.equal(subtitleTranslationStatus(url), null);
  t.mock.timers.tick(60_000);
  assert.equal(calls, 2);
});

test("the bridge refuses to start a translation from automatic or preload calls", async () => {
  const h = mpvBridgeHarness();
  let calls = 0;
  h.prepareWith(async () => { calls++; return prepared(); });
  assert.equal(await h.bridge.addSubtitle(url, "Make Hindi", "Translation", false, { translation: true }), false);
  assert.equal(await h.bridge.addSubtitle(url, "Make Hindi", "Translation", true, { translation: true }, "automatic"), false);
  assert.equal(calls, 0);
  h.bridge.destroy();
});

test("automatic ranking and timing consensus never download translation offers", async () => {
  assert.deepEqual(rankSubtitleCandidates([candidate], []), []);
  assert.equal(await prepareConsensusCandidate(candidate, 100, {} as never), null);
});
