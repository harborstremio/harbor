import assert from "node:assert/strict";
import test from "node:test";
import { explainPassage, explainWord } from "../src/lib/ebook/explain.ts";

test("Explain selects the Wiktionary meaning supported by passage context", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        en: [
          {
            partOfSpeech: "Noun",
            definitions: [
              { definition: "A financial institution that keeps money." },
              { definition: "The land along the edge of a river." },
            ],
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  try {
    const result = await explainWord("bank", "He sat on the bank of the river.", "en");
    assert.equal(result.meaning, "The land along the edge of a river.");
    assert.equal(result.confidence, "medium");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Explain supports a full passage and returns context-ranked key meanings", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const word = decodeURIComponent(String(input).split("/").at(-1) ?? "");
    return new Response(
      JSON.stringify({
        en: [
          {
            partOfSpeech: "Noun",
            definitions: [
              {
                definition:
                  word === "river"
                    ? "A large natural stream of water."
                    : `A definition of ${word}.`,
              },
            ],
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  try {
    const results = await explainPassage(
      "He rested beside the flowing river",
      "After walking all day, he rested beside the flowing river.",
      "en",
    );
    assert.ok(results.length > 1);
    assert.ok(results.some((result) => result.word === "river"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
