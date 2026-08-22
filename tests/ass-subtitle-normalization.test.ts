// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

type AssStyle = { size: number; order: number };
type AssHeaderModule = {
  inferPlayResY: (text: string) => number;
  parseAssStyles: (text: string) => Map<string, AssStyle>;
  dominantDialogueStyle: (text: string, styles: Map<string, AssStyle>) => string;
  computeAssBaseFactor: (text: string) => number | null;
  assScaleFromFactor: (factor: number, targetFontSize: number) => number;
};
type AssTrack = {
  id: string;
  external?: boolean;
  url?: string;
  externalFilename?: string;
};
type AssLoadRequest = {
  sourceUrl: string;
  track: AssTrack;
  tracks: AssTrack[];
  headers?: Record<string, string>;
};
type AssLoaderDeps = {
  loadExternal: (url: string, signal: AbortSignal) => Promise<string | null>;
  loadEmbedded: (
    sourceUrl: string,
    streamIndex: number,
    headers: Record<string, string> | undefined,
  ) => Promise<string | null>;
};
type AssLoaderModule = {
  loadAssBaseFactor: (
    request: AssLoadRequest,
    deps: AssLoaderDeps,
    signal: AbortSignal,
  ) => Promise<number | null>;
  clearAssNormalizeCache: () => void;
};

const assHeader = (await import("../src/lib/player/ass-header.ts").catch(
  () => ({}),
)) as Partial<AssHeaderModule>;
const assLoader = (await import("../src/lib/player/ass-normalize-loader.ts").catch(
  () => ({}),
)) as Partial<AssLoaderModule>;

function requireParser(): AssHeaderModule {
  assert.equal(typeof assHeader.inferPlayResY, "function");
  assert.equal(typeof assHeader.parseAssStyles, "function");
  assert.equal(typeof assHeader.dominantDialogueStyle, "function");
  assert.equal(typeof assHeader.computeAssBaseFactor, "function");
  assert.equal(typeof assHeader.assScaleFromFactor, "function");
  return assHeader as AssHeaderModule;
}

function requireLoader(): AssLoaderModule {
  assert.equal(typeof assLoader.loadAssBaseFactor, "function");
  assert.equal(typeof assLoader.clearAssNormalizeCache, "function");
  return assLoader as AssLoaderModule;
}

function assDocument({
  playRes = "PlayResX: 1280\nPlayResY: 720",
  styles,
  events,
}: {
  playRes?: string;
  styles: string;
  events: string;
}): string {
  return `[Script Info]
${playRes}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour
${styles}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events}`;
}

test("ASS PlayResY prefers an explicit value and conservatively infers missing values", () => {
  const { inferPlayResY } = requireParser();

  assert.equal(inferPlayResY("[Script Info]\nPlayResX: 1920\nPlayResY: 1080"), 1080);
  assert.equal(inferPlayResY("[Script Info]\nPlayResX: 1920"), 1440);
  assert.equal(inferPlayResY("[Script Info]\nTitle: Missing dimensions"), 288);
});

test("ASS styles follow the declared format and preserve first-seen order", () => {
  const { parseAssStyles } = requireParser();
  const text = `[V4 Styles]
Format: Fontname, Fontsize, Name, PrimaryColour
Style: Arial, 36, Default, &H00FFFFFF
Style: Arial, 48, Signs, &H00FFFFFF
Style: Arial, 40, Default, &H00FFFFFF`;

  assert.deepEqual(
    [...parseAssStyles(text)],
    [
      ["Default", { size: 40, order: 0 }],
      ["Signs", { size: 48, order: 1 }],
    ],
  );
});

test("dominant ASS dialogue ignores positioned, clipped, moved, and drawing events", () => {
  const parser = requireParser();
  const text = assDocument({
    styles: ["Style: Default,Arial,36,&H00FFFFFF", "Style: Signs,Arial,60,&H00FFFFFF"].join("\n"),
    events: [
      "Dialogue: 0,0:00:01.00,0:00:02.00,Signs,,0,0,0,,{\\pos(320,40)}Store",
      "Dialogue: 0,0:00:02.00,0:00:03.00,Signs,,0,0,0,,{\\move(0,0,100,100)}Moving",
      "Dialogue: 0,0:00:03.00,0:00:04.00,Signs,,0,0,0,,{\\clip(0,0,100,100)}Clipped",
      "Dialogue: 0,0:00:04.00,0:00:05.00,Signs,,0,0,0,,{\\p1}m 0 0 l 10 10",
      "Dialogue: 0,0:00:05.00,0:00:06.00,Default,,0,0,0,,Hello, world",
      "Dialogue: 0,0:00:06.00,0:00:07.00,Default,,0,0,0,,How are you?",
    ].join("\n"),
  });
  const styles = parser.parseAssStyles(text);

  assert.equal(parser.dominantDialogueStyle(text, styles), "Default");
});

test("dominant ASS dialogue falls back to a positive Default style", () => {
  const parser = requireParser();
  const text = assDocument({
    styles: ["Style: Signs,Arial,70,&H00FFFFFF", "Style: Default,Arial,42,&H00FFFFFF"].join("\n"),
    events: "",
  });

  assert.equal(parser.dominantDialogueStyle(text, parser.parseAssStyles(text)), "Default");
});

test("ASS base factor rejects implausible dialogue sizes outside 2–22% of PlayResY", () => {
  const { computeAssBaseFactor } = requireParser();
  const small = assDocument({
    styles: "Style: Default,Arial,10,&H00FFFFFF",
    events: "Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Hello",
  });
  const plausible = assDocument({
    styles: "Style: Default,Arial,36,&H00FFFFFF",
    events: "Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Hello",
  });
  const large = assDocument({
    styles: "Style: Default,Arial,180,&H00FFFFFF",
    events: "Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Hello",
  });

  assert.equal(computeAssBaseFactor(small), null);
  assert.equal(computeAssBaseFactor(plausible), 1 / 36);
  assert.equal(computeAssBaseFactor(large), null);
});

test("ASS scale uses the requested font size and clamps unsafe results", () => {
  const { assScaleFromFactor } = requireParser();

  assert.equal(assScaleFromFactor(1 / 36, 54), 1.5);
  assert.equal(assScaleFromFactor(0.001, 16), 0.2);
  assert.equal(assScaleFromFactor(1, 120), 6);
  assert.equal(assScaleFromFactor(Number.NaN, 32), 0.2);
});

test("ASS factor loader reads external tracks and caches successful factors", async () => {
  const loader = requireLoader();
  loader.clearAssNormalizeCache();
  const calls: string[] = [];
  const deps: AssLoaderDeps = {
    loadExternal: async (url) => {
      calls.push(url);
      return assDocument({
        styles: "Style: Default,Arial,36,&H00FFFFFF",
        events: "Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Hello",
      });
    },
    loadEmbedded: async () => {
      throw new Error("embedded loader should not run");
    },
  };
  const request: AssLoadRequest = {
    sourceUrl: "https://video.test/show.mkv",
    track: {
      id: "external-1",
      external: true,
      url: "https://subs.test/show.ass",
    },
    tracks: [],
  };

  assert.equal(await loader.loadAssBaseFactor(request, deps, new AbortController().signal), 1 / 36);
  assert.equal(await loader.loadAssBaseFactor(request, deps, new AbortController().signal), 1 / 36);
  assert.deepEqual(calls, ["https://subs.test/show.ass"]);
});

test("ASS factor loader maps embedded subtitle ids to ffmpeg stream indexes", async () => {
  const loader = requireLoader();
  loader.clearAssNormalizeCache();
  const embeddedCalls: Array<{
    sourceUrl: string;
    streamIndex: number;
    headers: Record<string, string> | undefined;
  }> = [];
  const deps: AssLoaderDeps = {
    loadExternal: async () => {
      throw new Error("external loader should not run");
    },
    loadEmbedded: async (sourceUrl, streamIndex, headers) => {
      embeddedCalls.push({ sourceUrl, streamIndex, headers });
      return assDocument({
        styles: "Style: Default,Arial,36,&H00FFFFFF",
        events: "Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Hello",
      });
    },
  };
  const request: AssLoadRequest = {
    sourceUrl: "https://video.test/show.mkv",
    track: { id: "embedded-2" },
    tracks: [{ id: "external", external: true }, { id: "embedded-1" }, { id: "embedded-2" }],
    headers: { Authorization: "secret" },
  };

  assert.equal(await loader.loadAssBaseFactor(request, deps, new AbortController().signal), 1 / 36);
  assert.deepEqual(embeddedCalls, [
    {
      sourceUrl: "https://video.test/show.mkv",
      streamIndex: 1,
      headers: { Authorization: "secret" },
    },
  ]);
});

test("ASS factor loader caches completed failures per source and track", async () => {
  const loader = requireLoader();
  loader.clearAssNormalizeCache();
  let calls = 0;
  const deps: AssLoaderDeps = {
    loadExternal: async () => {
      calls += 1;
      throw new Error("network unavailable");
    },
    loadEmbedded: async () => null,
  };
  const request: AssLoadRequest = {
    sourceUrl: "https://video.test/show.mkv",
    track: { id: "external-failure", external: true, url: "https://subs.test/fail.ass" },
    tracks: [],
  };

  assert.equal(await loader.loadAssBaseFactor(request, deps, new AbortController().signal), null);
  assert.equal(await loader.loadAssBaseFactor(request, deps, new AbortController().signal), null);
  assert.equal(calls, 1);
});

test("cancelled ASS loads do not publish or cache stale embedded results", async () => {
  const loader = requireLoader();
  loader.clearAssNormalizeCache();
  let calls = 0;
  let resolveFirst: ((text: string) => void) | undefined;
  const text = assDocument({
    styles: "Style: Default,Arial,36,&H00FFFFFF",
    events: "Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Hello",
  });
  const deps: AssLoaderDeps = {
    loadExternal: async () => null,
    loadEmbedded: async () => {
      calls += 1;
      if (calls === 1) {
        return new Promise<string>((resolve) => {
          resolveFirst = resolve;
        });
      }
      return text;
    },
  };
  const request: AssLoadRequest = {
    sourceUrl: "file:///show.mkv",
    track: { id: "embedded-cancel" },
    tracks: [{ id: "embedded-cancel" }],
  };
  const controller = new AbortController();
  const first = loader.loadAssBaseFactor(request, deps, controller.signal);
  controller.abort();
  resolveFirst?.(text);

  await assert.rejects(first, (error: unknown) => {
    return error instanceof DOMException && error.name === "AbortError";
  });
  assert.equal(await loader.loadAssBaseFactor(request, deps, new AbortController().signal), 1 / 36);
  assert.equal(calls, 2);
});
