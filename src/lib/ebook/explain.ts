export type WordExplanation = {
  word: string;
  partOfSpeech: string;
  meaning: string;
  contextMeaning: string;
  translation?: string;
  confidence: "high" | "medium" | "low";
  sourceUrl: string;
};

type Definition = {
  definition?: string;
  examples?: string[];
  parsedExamples?: Array<{ example?: string }>;
};

type DefinitionGroup = {
  partOfSpeech?: string;
  definitions?: Definition[];
};

const pending = new Map<string, Promise<WordExplanation>>();
const stopWords = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "he", "her", "his",
  "in", "is", "it", "of", "on", "or", "she", "that", "the", "their", "this", "to", "was",
  "were", "with",
]);

const plain = (html = "") => {
  if (typeof DOMParser !== "undefined")
    return new DOMParser().parseFromString(html, "text/html").body.textContent?.trim() ?? "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
};

const words = (text: string) =>
  new Set(
    (text.toLocaleLowerCase().match(/[\p{L}\p{M}\p{N}'’]+/gu) ?? []).filter(
      (word) => word.length > 1 && !stopWords.has(word),
    ),
  );

async function http(url: string): Promise<Response> {
  const request = "__TAURI_INTERNALS__" in globalThis
    ? (await import("@tauri-apps/plugin-http")).fetch
    : fetch;
  const response = await request(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Wiktionary HTTP ${response.status}`);
  return response;
}

async function arabicTranslations(word: string): Promise<string[]> {
  const url = new URL("https://ar.wiktionary.org/w/api.php");
  url.search = new URLSearchParams({
    action: "parse",
    page: word,
    prop: "text",
    formatversion: "2",
    format: "json",
    origin: "*",
  }).toString();
  try {
    const data = (await (await http(url.toString())).json()) as { parse?: { text?: string } };
    const html = data.parse?.text ?? "";
    if (!html || typeof DOMParser === "undefined") return [];
    const doc = new DOMParser().parseFromString(html, "text/html");
    return [...doc.querySelectorAll("ol > li")]
      .map((item) => item.textContent?.trim() ?? "")
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function explainWord(
  selectedWord: string,
  context: string,
  targetLanguage: string,
): Promise<WordExplanation> {
  const word = selectedWord.trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  if (!word || /\s/u.test(word)) return Promise.reject(new Error("Select one word to explain."));
  const key = `${word.toLocaleLowerCase()}\n${context}\n${targetLanguage}`;
  const existing = pending.get(key);
  if (existing) return existing;
  const task = (async (): Promise<WordExplanation> => {
    const sourceUrl = `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}`;
    const response = await http(
      `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`,
    );
    const data = (await response.json()) as Record<string, DefinitionGroup[]>;
    const groups = Object.values(data).flat();
    const contextWords = words(context);
    contextWords.delete(word.toLocaleLowerCase());
    const candidates = groups.flatMap((group, groupIndex) =>
      (group.definitions ?? []).flatMap((definition) => {
        const meaning = plain(definition.definition);
        if (!meaning) return [];
        const examples = [
          ...(definition.examples ?? []),
          ...(definition.parsedExamples ?? []).map((example) => example.example ?? ""),
        ].map(plain);
        const definitionWords = words(`${meaning} ${examples.join(" ")}`);
        const overlap = [...definitionWords].filter((token) => contextWords.has(token)).length;
        return [{ groupIndex, partOfSpeech: group.partOfSpeech ?? "word", meaning, overlap }];
      }),
    );
    if (!candidates.length) throw new Error(`No Wiktionary definition was found for “${word}”.`);
    candidates.sort((left, right) => right.overlap - left.overlap);
    const best = candidates[0];
    const translations = targetLanguage === "ar" ? await arabicTranslations(word) : [];
    return {
      word,
      partOfSpeech: best.partOfSpeech.toLocaleLowerCase(),
      meaning: best.meaning,
      contextMeaning: `Here, “${word}” means ${best.meaning.replace(/^[Aa]n?\s+/, "").replace(/\.$/, "")}.`,
      translation: translations[best.groupIndex],
      confidence: best.overlap >= 2 ? "high" : best.overlap === 1 ? "medium" : "low",
      sourceUrl,
    };
  })().finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
}

export async function explainPassage(
  selection: string,
  context: string,
  targetLanguage: string,
): Promise<WordExplanation[]> {
  const terms = [
    ...new Set(
      (selection.match(/[\p{L}\p{M}\p{N}'’]+/gu) ?? [])
        .filter((word) => word.length > 2 && !stopWords.has(word.toLocaleLowerCase()))
        .sort((left, right) => right.length - left.length),
    ),
  ].slice(0, 6);
  if (!terms.length) throw new Error("No explainable words were found in this passage.");
  const settled = await Promise.allSettled(
    terms.map((word) => explainWord(word, context, targetLanguage)),
  );
  const explanations = settled.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  if (!explanations.length)
    throw new Error("No Wiktionary definitions were found for this passage.");
  const confidence = { high: 2, medium: 1, low: 0 };
  return explanations.sort(
    (left, right) => confidence[right.confidence] - confidence[left.confidence],
  );
}
