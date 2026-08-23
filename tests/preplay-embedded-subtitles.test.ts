// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

async function loadChoiceModule() {
  try {
    return await import("../src/views/play-picker/subtitle-choice.ts");
  } catch (error) {
    assert.fail(`pre-play subtitle choice support is missing: ${String(error)}`);
  }
}

async function loadEmbeddedPreselectModule() {
  try {
    return await import("../src/lib/subtitles/embedded-preselect.ts");
  } catch (error) {
    assert.fail(`embedded preselection support is missing: ${String(error)}`);
  }
}

async function loadMpvTrackListModule() {
  try {
    return await import("../src/lib/player/mpv-track-list.ts");
  } catch (error) {
    assert.fail(`mpv track-list identity parsing is missing: ${String(error)}`);
  }
}

const external = {
  id: "embedded:5:0",
  url: "https://subtitles.example.test/en.srt",
  lang: "en",
  title: "External English",
  source: "opensubtitles" as const,
  format: "srt" as const,
};

const embedded = {
  ffIndex: 5,
  subIndex: 0,
  lang: "en",
  title: "English SDH",
  codec: "ass",
  isDefault: true,
  isForced: false,
  isHearingImpaired: true,
};

test("external and embedded picker choices have collision-safe identities", async () => {
  const { mergeSubtitleChoices } = await loadChoiceModule();
  const choices = mergeSubtitleChoices([external], [embedded]);

  assert.deepEqual(choices.map((choice) => choice.key).sort(), [
    "embedded:5:0",
    "external:embedded:5:0",
  ]);
});

test("embedded picker choices appear before provider results", async () => {
  const { mergeSubtitleChoices } = await loadChoiceModule();
  const choices = mergeSubtitleChoices([external], [embedded]);

  assert.deepEqual(
    choices.map((choice) => choice.kind),
    ["embedded", "external"],
  );
});

test("embedded probing starts alongside provider search", async () => {
  const { loadSubtitleChoices } = await loadChoiceModule();
  const started: string[] = [];
  let resolveExternal!: (value: (typeof external)[]) => void;

  const pending = loadSubtitleChoices(
    () => {
      started.push("external");
      return new Promise<(typeof external)[]>((resolve) => {
        resolveExternal = resolve;
      });
    },
    async () => {
      started.push("embedded");
      return [embedded];
    },
  );

  await Promise.resolve();
  assert.deepEqual(started, ["external", "embedded"]);
  resolveExternal([external]);

  const result = await pending;
  assert.equal(result.externalError, false);
  assert.equal(result.embeddedError, false);
  assert.deepEqual(
    result.choices.map((choice) => choice.kind),
    ["embedded", "external"],
  );
});

test("provider results become usable while embedded probing is still pending", async () => {
  const { loadSubtitleChoices } = await loadChoiceModule();
  let resolveEmbedded!: (value: (typeof embedded)[]) => void;
  const snapshots: { choices: { kind: string }[]; externalError: boolean }[] = [];

  const pending = loadSubtitleChoices(
    async () => [external],
    () =>
      new Promise<(typeof embedded)[]>((resolve) => {
        resolveEmbedded = resolve;
      }),
    (result: { choices: { kind: string }[]; externalError: boolean }) => {
      snapshots.push(result);
    },
  );

  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(
    snapshots.map((result) => result.choices.map((choice) => choice.kind)),
    [["external"]],
  );

  resolveEmbedded([embedded]);
  assert.deepEqual(
    (await pending).choices.map((choice: { kind: string }) => choice.kind),
    ["embedded", "external"],
  );
});

test("mpv-unavailable playback does not invoke the native embedded probe", async () => {
  const { loadEmbeddedTracksWhenMpvAvailable } = await loadChoiceModule();
  let nativeProbeCalls = 0;

  const tracks = await loadEmbeddedTracksWhenMpvAvailable(
    async () => ({ available: false }),
    async () => {
      nativeProbeCalls += 1;
      return [embedded];
    },
  );

  assert.deepEqual(tracks, []);
  assert.equal(nativeProbeCalls, 0);
});

test("a failed embedded probe preserves external subtitle results", async () => {
  const { loadSubtitleChoices } = await loadChoiceModule();
  const result = await loadSubtitleChoices(
    async () => [external],
    async () => {
      throw new Error("ffprobe unavailable");
    },
  );

  assert.equal(result.externalError, false);
  assert.equal(result.embeddedError, true);
  assert.deepEqual(
    result.choices.map((choice) => choice.kind),
    ["external"],
  );
});

test("media without embedded tracks keeps provider-only choices", async () => {
  const { loadSubtitleChoices } = await loadChoiceModule();
  const result = await loadSubtitleChoices(
    async () => [external],
    async () => [],
  );

  assert.deepEqual(
    result.choices.map((choice) => choice.key),
    ["external:embedded:5:0"],
  );
});

test("external, off, and skip selections preserve their existing behavior", async () => {
  const { buildPlayerSubtitleSelection, mergeSubtitleChoices } = await loadChoiceModule();
  const source = {
    meta: { id: "tt0848228", name: "The Avengers", type: "movie" },
    url: "https://media.example.test/movie.mkv",
    title: "The Avengers",
  };
  const choices = mergeSubtitleChoices([external], [embedded]);

  assert.deepEqual(
    buildPlayerSubtitleSelection(source, "external:embedded:5:0", choices).subtitlePreselect,
    {
      off: false,
      url: external.url,
      lang: "en",
      title: "External English",
    },
  );
  assert.deepEqual(buildPlayerSubtitleSelection(source, "off", choices).subtitlePreselect, {
    off: true,
  });
  assert.strictEqual(buildPlayerSubtitleSelection(source, "skip", choices), source);
});

test("an embedded picker selection carries both stable probe identities", async () => {
  const { buildPlayerSubtitleSelection, mergeSubtitleChoices } = await loadChoiceModule();
  const source = {
    meta: { id: "tt0848228", name: "The Avengers", type: "movie" },
    url: "https://media.example.test/movie.mkv",
    title: "The Avengers",
  };
  const choices = mergeSubtitleChoices([], [embedded]);

  assert.deepEqual(
    buildPlayerSubtitleSelection(source, "embedded:5:0", choices).subtitlePreselect,
    {
      off: false,
      embedded: { ffIndex: 5, subIndex: 0 },
    },
  );
});

test("an explicit pre-play choice overrides stored subtitles-off policy", async () => {
  const { shouldEnforceSubtitleOff } = await loadEmbeddedPreselectModule();

  assert.equal(shouldEnforceSubtitleOff(undefined, true), true);
  assert.equal(shouldEnforceSubtitleOff({ off: true }, true), true);
  assert.equal(
    shouldEnforceSubtitleOff({ off: false, embedded: { ffIndex: 5, subIndex: 0 } }, true),
    false,
  );
  assert.equal(
    shouldEnforceSubtitleOff({ off: false, url: "https://subtitles.example.test/en.srt" }, true),
    false,
  );
});

test("explicit no-subtitles remains enforced when runtime tracks arrive late", async () => {
  const { enforceSubtitleOff } = await loadEmbeddedPreselectModule();
  const selections: null[] = [];

  assert.equal(
    enforceSubtitleOff({ off: true }, false, [], () => selections.push(null)),
    false,
  );
  assert.equal(
    enforceSubtitleOff({ off: true }, false, [{ selected: true }], () => selections.push(null)),
    true,
  );
  assert.deepEqual(selections, [null]);
});

test("pre-play no-subtitles clears a late default once and then allows manual selection", async () => {
  const { applySubtitleOffPreselect, enforceStoredSubtitleOff, shouldEnforceStoredSubtitleOff } =
    await loadEmbeddedPreselectModule();
  const selections: null[] = [];
  const choice = { off: true };
  let consumed = false;
  const render = (tracks: { selected: boolean }[]) => {
    if (!consumed) {
      consumed = applySubtitleOffPreselect(tracks, () => selections.push(null));
    }
    if (shouldEnforceStoredSubtitleOff(choice, true) && tracks.some((track) => track.selected)) {
      selections.push(null);
    }
    enforceStoredSubtitleOff(choice, true, tracks, () => selections.push(null));
  };

  render([]);
  assert.equal(consumed, false);

  render([{ selected: true }]);
  assert.equal(consumed, true);
  assert.deepEqual(selections, [null]);

  render([{ selected: true }]);
  assert.deepEqual(selections, [null]);
});

test("ffprobe index, subtitle ordinal, and mpv runtime id remain distinct", async () => {
  const { parseMpvTrackList } = await loadMpvTrackListModule();
  const { resolveEmbeddedSubtitleTrack } = await loadEmbeddedPreselectModule();
  const parsed = parseMpvTrackList(
    [
      { type: "sub", id: 41, "ff-index": 9, lang: "es" },
      { type: "sub", id: 77, "ff-index": 5, lang: "en", title: "English SDH" },
    ],
    null,
    new Map(),
  );

  const selected = resolveEmbeddedSubtitleTrack(parsed.subtitleTracks, {
    ffIndex: 5,
    subIndex: 0,
  });

  assert.equal(selected?.id, "77");
  assert.equal(selected?.ffIndex, 5);
});

test("mpv track parsing preserves existing audio and external subtitle metadata", async () => {
  const { parseMpvTrackList } = await loadMpvTrackListModule();
  const parsed = parseMpvTrackList(
    [
      {
        type: "audio",
        id: 2,
        selected: true,
        lang: "en",
        "codec-desc": "aac",
        "demux-channels": "stereo",
        "demux-channel-count": 2,
      },
      {
        type: "sub",
        id: 8,
        selected: true,
        "main-selection": 1,
        external: true,
        "external-filename": "downloaded.srt",
      },
    ],
    "8",
    new Map([
      [
        "downloaded.srt",
        {
          url: "https://subtitles.example.test/external.srt",
          provider: "opensubtitles",
          subId: "external-8",
        },
      ],
    ]),
  );

  assert.equal(parsed.audioTracks[0]?.selected, true);
  assert.equal(parsed.audioTracks[0]?.codec, "AAC");
  assert.equal(parsed.audioTracks[0]?.channelCount, 2);
  assert.equal(parsed.subtitleTracks[0]?.selected, false);
  assert.equal(parsed.subtitleTracks[0]?.secondary, true);
  assert.equal(parsed.subtitleTracks[0]?.url, "https://subtitles.example.test/external.srt");
  assert.equal(parsed.subtitleTracks[0]?.subId, "external-8");
});

test("embedded selection waits for delayed runtime tracks", async () => {
  const { applyEmbeddedSubtitlePreselect } = await loadEmbeddedPreselectModule();
  const selectedIds: string[] = [];
  const identity = { ffIndex: 5, subIndex: 1 };

  assert.equal(
    applyEmbeddedSubtitlePreselect([], identity, (id) => selectedIds.push(id)),
    false,
  );
  assert.deepEqual(selectedIds, []);

  const tracks = [
    { id: "41", label: "Spanish", lang: "es", kind: "subtitle" as const, selected: false },
    {
      id: "77",
      ffIndex: 5,
      label: "English SDH",
      lang: "en",
      kind: "subtitle" as const,
      selected: false,
    },
  ];
  assert.equal(
    applyEmbeddedSubtitlePreselect(tracks, identity, (id) => selectedIds.push(id)),
    true,
  );
  assert.deepEqual(selectedIds, ["77"]);
});

test("ordinal fallback is used only when mpv exposes no ff-index values", async () => {
  const { resolveEmbeddedSubtitleTrack } = await loadEmbeddedPreselectModule();
  const withoutFfIndex = [
    { id: "10", label: "First", kind: "subtitle" as const, selected: false },
    { id: "11", label: "Second", kind: "subtitle" as const, selected: false },
  ];
  assert.equal(
    resolveEmbeddedSubtitleTrack(withoutFfIndex, { ffIndex: 99, subIndex: 1 })?.id,
    "11",
  );

  const withDifferentFfIndices = withoutFfIndex.map((track, index) => ({
    ...track,
    ffIndex: index + 20,
  }));
  assert.equal(
    resolveEmbeddedSubtitleTrack(withDifferentFfIndices, { ffIndex: 99, subIndex: 1 }),
    null,
  );
});

test("the applied guard key includes media and embedded choice identity", async () => {
  const { subtitlePreselectApplyKey } = await loadEmbeddedPreselectModule();
  const base = {
    meta: { id: "tt0848228", name: "The Avengers", type: "movie" },
    url: "https://media.example.test/movie.mkv",
    title: "The Avengers",
    subtitlePreselect: { off: false, embedded: { ffIndex: 5, subIndex: 0 } },
  };

  const first = subtitlePreselectApplyKey(base, base.subtitlePreselect);
  const differentMedia = subtitlePreselectApplyKey(
    { ...base, meta: { ...base.meta, id: "tt9999999" } },
    base.subtitlePreselect,
  );
  const differentChoice = subtitlePreselectApplyKey(base, {
    off: false,
    embedded: { ffIndex: 6, subIndex: 1 },
  });

  assert.notEqual(first, differentMedia);
  assert.notEqual(first, differentChoice);
});
