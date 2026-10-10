import assert from "node:assert/strict";
import test from "node:test";
import type { Meta } from "../src/lib/cinemeta.ts";
import {
  catalogReleaseVerdict,
  pickRecommendationMatch,
  recommendationReleaseFallback,
  recommendationReleaseInfo,
} from "../src/lib/ai-chat-recommendations.ts";
import { parseChatResearchPlan } from "../src/lib/ai-chat-prompts.ts";
import { positionChatModelPicker } from "../src/components/ai-chat/chat-context.ts";
import { buildChatQuickPrompts } from "../src/components/ai-chat/chat-context.ts";
import {
  DEFAULT_GEMINI_CHAT_MODEL,
  detectChatReplyLanguage,
  isSupportedGeminiChatModel,
  sortGeminiChatModelIds,
} from "../src/lib/ai-chat-models.ts";

function meta(overrides: Partial<Meta> = {}): Meta {
  return {
    id: "tt1234567",
    type: "movie",
    name: "Example Film",
    ...overrides,
  };
}

test("recommendation matching picks the requested year when titles are shared", () => {
  const oldFilm = meta({ id: "old", releaseInfo: "2025" });
  const newFilm = meta({ id: "new", releaseInfo: "2026" });

  assert.equal(
    pickRecommendationMatch([oldFilm, newFilm], {
      title: "Example Film",
      year: 2026,
      type: "movie",
    })?.id,
    "new",
  );
});

test("recommendation matching does not fall back to the wrong year", () => {
  assert.equal(
    pickRecommendationMatch([meta({ releaseInfo: "2025" })], {
      title: "Example Film",
      year: 2026,
      type: "movie",
    }),
    null,
  );
});

test("catalog year without a full date is not treated as an exact future premiere", () => {
  const result = catalogReleaseVerdict(
    meta({ releaseInfo: "2026" }),
    Date.parse("2026-09-24"),
    2026,
  );
  assert.deepEqual(result, {});
});

test("a previous-year release overrides a stale upcoming label from the model", () => {
  assert.equal(
    recommendationReleaseFallback(
      { isReleased: false, year: 2025 },
      2026,
      Date.parse("2026-09-24"),
    ),
    true,
  );
});

test("an exact future premiere date still marks a title as upcoming", () => {
  assert.equal(
    recommendationReleaseFallback(
      { isReleased: true, year: 2026, releaseDate: "2026-11-15" },
      2026,
      Date.parse("2026-09-24"),
    ),
    false,
  );
});

test("resolved card year prefers catalog release year over a mismatched model year", () => {
  assert.equal(recommendationReleaseInfo(meta({ releaseInfo: "2026" }), 2025), "2026");
});

test("failed planning preserves Arabic request words and exact constraints", () => {
  const query = "عطني أفلام 2020 بدون رعب";
  assert.deepEqual(parseChatResearchPlan("invalid", query), {
    needsSearch: true,
    query,
    fresh: false,
    useCurrentTitle: false,
  });
});

test("valid planning supports contextual follow-ups without modifying the original language", () => {
  assert.deepEqual(
    parseChatResearchPlan(
      JSON.stringify({
        needsSearch: true,
        query: "Arrival 2016 cast",
        fresh: false,
        useCurrentTitle: false,
      }),
      "مين الممثلين؟",
    ),
    { needsSearch: true, query: "Arrival 2016 cast", fresh: false, useCurrentTitle: false },
  );
});

test("malformed planning cannot disable research with string booleans", () => {
  assert.equal(parseChatResearchPlan('{"needsSearch":"false"}', "release dates").needsSearch, true);
});

test("greetings can skip external research", () => {
  assert.equal(
    parseChatResearchPlan(
      '{"needsSearch":false,"query":"","fresh":false,"useCurrentTitle":false}',
      "هلا",
    ).needsSearch,
    false,
  );
});

test("Gemini chat defaults to current Flash and excludes the 2.x model family", () => {
  assert.equal(DEFAULT_GEMINI_CHAT_MODEL, "gemini-3-flash-preview");
  assert.equal(isSupportedGeminiChatModel("gemini-2.5-pro"), false);
  assert.equal(isSupportedGeminiChatModel("gemini-2.5-flash"), false);
  assert.equal(isSupportedGeminiChatModel("gemini-3-flash-preview"), true);
  assert.deepEqual(sortGeminiChatModelIds(["gemini-3.1-pro-preview", "gemini-3-flash-preview"]), [
    "gemini-3-flash-preview",
    "gemini-3.1-pro-preview",
  ]);
});

test("reply language follows the latest English message despite Arabic chat context", () => {
  assert.equal(detectChatReplyLanguage("What's the story?"), "English");
});

test("current-title context does not override the language of the user's message", () => {
  assert.equal(
    detectChatReplyLanguage(
      'ما قصة الفيلم؟\n[Current title open in Harbor: "Oppenheimer" (2023, movie, id: tt15398776)]',
    ),
    "Arabic",
  );
  assert.equal(
    detectChatReplyLanguage(
      'What is this about?\n[Current title open in Harbor: "Oppenheimer" (2023, movie, id: tt15398776)]',
    ),
    "English",
  );
});

test("model picker positions itself above the anchor when the chat header is near the viewport bottom", () => {
  const layout = positionChatModelPicker(
    { top: 690, right: 400, bottom: 720, left: 170 },
    { width: 420, height: 760 },
    false,
  );
  assert.ok(layout.top < 690);
  assert.ok(layout.top + layout.maxHeight <= 748);
  assert.ok(layout.left + layout.width <= 408);
});

test("model picker keeps RTL alignment and dimensions inside a narrow viewport", () => {
  const layout = positionChatModelPicker(
    { top: 20, right: 380, bottom: 50, left: 250 },
    { width: 320, height: 540 },
    true,
  );
  assert.equal(layout.left, 52);
  assert.ok(layout.top >= 12);
  assert.ok(layout.left + layout.width <= 308);
});

const translate = (key: string, vars?: Record<string, string | number>) =>
  key.replace(/\{(\w+)\}/g, (_, name) => String(vars?.[name] ?? ""));

test("conversation suggestions come from the reply instead of the first card or open page", () => {
  const followUps = [
    "Compare Arrival and Dune for tonight",
    "Which pick is under two hours?",
    "Suggest a lighter option without horror",
  ];
  const result = buildChatQuickPrompts(
    [
      {
        id: "user",
        role: "user",
        text: "Two science fiction picks under two hours, no horror",
        timestamp: 1,
      },
      {
        id: "reply",
        role: "model",
        text: "Here are the choices",
        timestamp: 2,
        followUps,
        resolvedMeta: [{ meta: meta({ name: "Arrival" }) }, { meta: meta({ name: "Dune" }) }],
      },
    ],
    meta({ name: "Unrelated page" }),
    translate,
  );
  assert.deepEqual(result.quickPrompts, followUps);
  assert.equal(result.quickPromptContext.media, null);
});

test("new questions and pending replies cannot reuse old follow-up suggestions", () => {
  const previous = [
    { id: "u1", role: "user" as const, text: "Science fiction", timestamp: 1 },
    {
      id: "a1",
      role: "model" as const,
      text: "Arrival",
      followUps: ["Compare Arrival and Dune"],
      timestamp: 2,
    },
  ];
  const next = [
    ...previous,
    { id: "u2", role: "user" as const, text: "Now comedy series", timestamp: 3 },
  ];
  assert.deepEqual(buildChatQuickPrompts(next, null, translate).quickPrompts, []);
  assert.deepEqual(
    buildChatQuickPrompts(
      [...next, { id: "a2", role: "model", text: "", loading: true, timestamp: 4 }],
      null,
      translate,
    ).quickPrompts,
    [],
  );
});

test("missing or failed suggestion metadata does not turn the full user question into a topic", () => {
  const history = [
    { id: "u", role: "user" as const, text: "ليش نهاية الفيلم كذا؟ أبغى شرح كامل", timestamp: 1 },
    { id: "a", role: "model" as const, text: "The explanation", timestamp: 2 },
  ];
  assert.deepEqual(
    buildChatQuickPrompts(history, meta({ name: "Another film" }), translate).quickPrompts,
    [],
  );
  assert.deepEqual(
    buildChatQuickPrompts(
      [
        ...history.slice(0, 1),
        { ...history[1], error: "Request failed", followUps: ["Old choice"] },
      ],
      null,
      translate,
    ).quickPrompts,
    [],
  );
});

test("suggestions cannot repeat the latest question even when punctuation differs", () => {
  const result = buildChatQuickPrompts(
    [
      { id: "u", role: "user", text: "ما قصة Arrival؟", timestamp: 1 },
      {
        id: "a",
        role: "model",
        text: "The story",
        followUps: ["ما قصة Arrival", "من الممثلون في Arrival؟"],
        timestamp: 2,
      },
    ],
    null,
    translate,
  );
  assert.deepEqual(result.quickPrompts, ["من الممثلون في Arrival؟"]);
});

test("initial suggestions still refer to the open title before conversation starts", () => {
  const result = buildChatQuickPrompts([], meta({ name: "Arrival" }), translate);
  assert.equal(result.quickPrompts.length, 3);
  assert.ok(result.quickPrompts.every((prompt) => prompt.includes("Arrival")));
});
