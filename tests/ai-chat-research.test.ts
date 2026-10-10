import assert from "node:assert/strict";
import test from "node:test";
import {
  buildChatHistory,
  buildSystemPrompt,
  prepareChatRequest,
  extractFollowUps,
} from "../src/lib/ai-chat-prompts.ts";
import { extractRecommendations, validReleaseDate } from "../src/lib/ai-chat-recommendations.ts";
import {
  normalizeChatSources,
  researchChat,
  sonarResearchFromResponse,
  tavilyCreditsFromResponse,
} from "../src/lib/ai-chat-research.ts";
import { buildResearchPlanningPrompt } from "../src/lib/ai-chat-prompts.ts";
import {
  recommendationReleaseFallback,
  pickRecommendationMatch,
} from "../src/lib/ai-chat-recommendations.ts";

test("both model instruction prompts stay in English for Arabic requests", () => {
  assert.doesNotMatch(
    buildSystemPrompt("عطني فيلم مثل The Lord of the Rings"),
    /\p{Script=Arabic}/u,
  );
  assert.doesNotMatch(buildResearchPlanningPrompt(), /\p{Script=Arabic}/u);
  assert.match(buildSystemPrompt("عطني فيلم مثل The Lord of the Rings"), /Reply in Arabic/);
});

test("history preserves catalog identities while dropping failed and pending replies", () => {
  const history = buildChatHistory([
    { id: "u", role: "user", text: "Suggest something", timestamp: 1 },
    {
      id: "m",
      role: "model",
      text: "A good fit",
      timestamp: 2,
      recommendations: [{ title: "Arrival", year: 2016, type: "movie" }],
    },
    { id: "e", role: "model", text: "", error: "Unavailable", timestamp: 3 },
  ]);
  assert.equal(history.length, 2);
  assert.match(history[1].text, /Arrival/);
  assert.match(history[1].text, /2016/);
});

test("research is attached only to the latest turn and cannot become a system instruction", () => {
  const original = [
    { role: "user" as const, text: "First question" },
    { role: "model" as const, text: "First answer" },
    { role: "user" as const, text: "Next question" },
  ];
  const request = prepareChatRequest(original, "[1] Source text");
  assert.equal(request.history[0].text, "First question");
  assert.match(request.history[2].text, /untrusted research evidence/);
  assert.doesNotMatch(request.systemPrompt, /\[1\] Source text/);
  assert.equal(original[2].text, "Next question");
});

test("large conversations keep a bounded recent context and the latest question", () => {
  const request = prepareChatRequest([
    { role: "user", text: "x".repeat(60_000) },
    { role: "model", text: "Old reply" },
    { role: "user", text: "Latest question" },
  ]);
  assert.equal(request.history.at(-1)?.text, "Latest question");
  assert.equal(request.history[0].role, "user");
  assert.ok(request.history.reduce((sum, message) => sum + message.text.length, 0) <= 48_000);
});

test("recommendation handoffs validate dates and identity without swallowing unrelated JSON", () => {
  const raw =
    'Example:\n```json\n{"setting":true}\n```\nMy pick:\n```recommendations\n[{"title":"Arrival","year":2016,"type":"movie","releaseDate":"2016-02-30"},{"title":"Arrival","year":2016,"type":"movie"},{"title":"Wrong","year":2026,"type":"unknown"}]\n```';
  const parsed = extractRecommendations(raw);
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].releaseDate, undefined);
  assert.match(parsed.cleanText, /"setting":true/);
  assert.doesNotMatch(parsed.cleanText, /recommendations/);
  assert.equal(validReleaseDate("2024-02-29"), "2024-02-29");
});

test("current-year unknown status is not silently marked released", () => {
  assert.equal(
    recommendationReleaseFallback({ year: 2026 }, 2026, Date.parse("2026-09-24")),
    undefined,
  );
});

test("series identity matches its premiere year, not any year in its run", () => {
  const pool = [
    { id: "series", type: "series" as const, name: "Example", releaseInfo: "2010–2020" },
  ];
  assert.equal(
    pickRecommendationMatch(pool, { title: "Example", type: "series", year: 2020 }),
    null,
  );
  assert.equal(
    pickRecommendationMatch(pool, { title: "Example", type: "series", year: 2010 })?.id,
    "series",
  );
});

test("search sources reject executable URLs, credentials, and duplicates", () => {
  const sources = normalizeChatSources([
    { title: "Unsafe", url: "javascript:alert(1)", snippet: "bad" },
    { title: "Credential", url: "https://user:secret@example.com", snippet: "bad" },
    { title: "Official", url: "https://example.com/release", snippet: "facts" },
    { title: "Duplicate", url: "https://example.com/release", snippet: "more" },
  ]);
  assert.equal(sources.length, 1);
  assert.equal(sources[0].title, "Official");
});

test("Sonar uses actual citation metadata and requires sources before claiming research", () => {
  const result = sonarResearchFromResponse({
    choices: [
      {
        message: {
          content: "Claim [7]",
          annotations: [
            {
              type: "url_citation",
              url_citation: {
                url: "https://example.com",
                title: "Official",
                content: "Source facts",
              },
            },
          ],
        },
      },
    ],
    usage: { total_tokens: 99 },
  });
  assert.equal(result.sources[0].title, "Official");
  assert.equal(result.totalTokens, 99);
  assert.match(result.context, /\[1\] Official/);
  assert.doesNotMatch(result.context, /\[7\]/);
  assert.equal(
    sonarResearchFromResponse({ choices: [{ message: { content: "An unsupported claim" } }] })
      .context,
    "",
  );
});

test("explicit Tavily selection never silently falls back to another provider", async (context) => {
  const calls: string[] = [];
  context.mock.method(globalThis, "fetch", async (url: string) => {
    calls.push(url);
    return new Response("Unauthorized", { status: 401 });
  });
  const result = await researchChat("tavily", "release dates", {
    tavilyKey: "test-key",
    openrouterKey: "",
    fresh: true,
    signal: new AbortController().signal,
  });
  assert.equal(result.unavailable, true);
  assert.deepEqual(calls, ["https://api.tavily.com/search"]);
});

test("Tavily request uses original query, header authentication, and general search", async (context) => {
  let body: Record<string, unknown> = {};
  context.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    body = JSON.parse(String(init.body));
    assert.equal(new Headers(init.headers).get("Authorization"), "Bearer test-key");
    return Response.json({
      results: [{ title: "Studio", url: "https://example.com", content: "Release confirmed" }],
      usage: { credits: 2 },
    });
  });
  const result = await researchChat("tavily", "عطني أفلام بدون رعب", {
    tavilyKey: "test-key",
    openrouterKey: "",
    fresh: true,
    signal: new AbortController().signal,
  });
  assert.equal(body.query, "عطني أفلام بدون رعب");
  assert.equal(body.topic, "general");
  assert.equal(body.include_answer, false);
  assert.equal(body.include_usage, true);
  assert.equal(body.api_key, undefined);
  assert.equal(result.creditsUsed, 2);
  assert.equal(result.unavailable, false);
  assert.match(result.context, /\[1\] Studio/);
});

test("aborted research cannot start another provider", async (context) => {
  let calls = 0;
  context.mock.method(globalThis, "fetch", async () => {
    calls++;
    return Response.json({});
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    researchChat("auto", "release dates", {
      tavilyKey: "test",
      openrouterKey: "",
      fresh: true,
      signal: controller.signal,
    }),
    { name: "AbortError" },
  );
  assert.equal(calls, 0);
});

test("Automatic research can fall back after Tavily fails without losing source numbering", async (context) => {
  const urls: string[] = [];
  context.mock.method(globalThis, "fetch", async (url: string) => {
    urls.push(url);
    if (url === "https://api.tavily.com/search")
      return new Response("Unavailable", { status: 503 });
    if (url.includes("html.duckduckgo.com"))
      return new Response("## [Official film release information](https://example.com/release)\n");
    return new Response("Official film release information and confirmed premiere date.");
  });
  const result = await researchChat("auto", "release dates", {
    tavilyKey: "test",
    openrouterKey: "",
    fresh: false,
    signal: new AbortController().signal,
  });
  assert.equal(result.provider, "web");
  assert.equal(result.unavailable, false);
  assert.equal(result.sources.length, 1);
  assert.match(result.context, /\[1\] Official film release information/);
  assert.equal(urls[0], "https://api.tavily.com/search");
});

test("Sonar research uses the selected search model and OpenRouter key independently", async (context) => {
  context.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
    assert.equal(new Headers(init.headers).get("Authorization"), "Bearer router-key");
    assert.equal(JSON.parse(String(init.body)).model, "perplexity/sonar-pro");
    return Response.json({
      choices: [
        {
          message: {
            content: "Confirmed information [1]",
            annotations: [
              {
                type: "url_citation",
                url_citation: {
                  url: "https://example.com/official",
                  title: "Official",
                  content: "Confirmed information",
                },
              },
            ],
          },
        },
      ],
      usage: { total_tokens: 123 },
    });
  });
  const result = await researchChat("sonar-pro", "Upcoming film", {
    tavilyKey: "",
    openrouterKey: "router-key",
    fresh: true,
    signal: new AbortController().signal,
  });
  assert.equal(result.provider, "sonar-pro");
  assert.equal(result.totalTokens, 123);
  assert.equal(result.creditsUsed, null);
  assert.equal(result.sources[0].url, "https://example.com/official");
});

test("last-request usage reads exact Tavily credits and never estimates missing values", () => {
  assert.equal(tavilyCreditsFromResponse({ usage: { credits: 2 } }), 2);
  assert.equal(tavilyCreditsFromResponse({ usage: { credits: 1 } }), 1);
  assert.equal(tavilyCreditsFromResponse({}), null);
});

test("hidden follow-up metadata stays separate from the visible answer and recommendations", () => {
  const raw =
    'A useful answer.\n\x60\x60\x60followups\n["Compare the two picks", "Which is shorter?", "A lighter option?"]\n\x60\x60\x60\n\x60\x60\x60recommendations\n[{"title":"Arrival","year":2016,"type":"movie"}]\n\x60\x60\x60';
  const parsed = extractFollowUps(raw);
  assert.deepEqual(parsed.followUps, [
    "Compare the two picks",
    "Which is shorter?",
    "A lighter option?",
  ]);
  const recommendations = extractRecommendations(parsed.cleanText);
  assert.equal(recommendations.cleanText, "A useful answer.");
  assert.equal(recommendations.items[0].title, "Arrival");
});

test("follow-up metadata rejects duplicates, invalid values, links, and overly long prompts", () => {
  const parsed = extractFollowUps(
    "Answer\n\x60\x60\x60followups\n" +
      JSON.stringify([
        "  Compare the picks?  ",
        "COMPARE THE PICKS",
        null,
        3,
        "https://example.com",
        "x".repeat(161),
        "Pick a shorter film",
        "Suggest a lighter one",
        "A fourth suggestion",
      ]) +
      "\n\x60\x60\x60",
  );
  assert.equal(parsed.cleanText, "Answer");
  assert.deepEqual(parsed.followUps, [
    "Compare the picks?",
    "Pick a shorter film",
    "Suggest a lighter one",
  ]);
});

test("malformed or truncated follow-up blocks are hidden and produce no clickable suggestions", () => {
  for (const tail of [
    "\x60\x60\x60followups\nnot JSON\n\x60\x60\x60",
    '\x60\x60\x60followups\n["unfinished',
  ]) {
    assert.deepEqual(extractFollowUps("Answer\n" + tail), { cleanText: "Answer", followUps: [] });
  }
  assert.deepEqual(extractFollowUps("A normal answer with no metadata"), {
    cleanText: "A normal answer with no metadata",
    followUps: [],
  });
});
