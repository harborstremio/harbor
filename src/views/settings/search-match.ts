export type SettingsSearchTranslator = (value: string) => string;

const SEPARATOR = "\n";

const FILLER = new Set([
  "a", "an", "the", "my", "me", "i", "is", "are", "was", "be", "to", "of", "on", "in", "at",
  "for", "and", "or", "it", "its", "this", "that", "these", "those", "with", "from", "by",
  "how", "do", "does", "did", "can", "cant", "dont", "doesnt", "wont", "when", "why", "what",
  "where", "which", "who", "not", "no", "so", "too", "very", "just", "get", "got", "keep",
  "turn", "want", "wants", "need", "needs", "please", "make", "makes", "off",
]);

const APOSTROPHES = /[‘’‚‛′‵']/g;
const QUOTES = /[“”„‟″‶"]/g;
const DIACRITICS = /[̀-ͯ]/g;
const WORD_SPLIT = /[^\p{L}\p{N}]+/u;

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .replace(APOSTROPHES, "")
    .replace(QUOTES, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string): string[] {
  return text.split(WORD_SPLIT).filter((w) => w.length > 1);
}

let vocabulary: Set<string> | null = null;
let lastNeedle = "";
let lastRequired: string[] = [];

export function setSettingsSearchVocabulary(values: Iterable<string>): void {
  const next = new Set<string>();
  for (const value of values) {
    for (const word of tokens(normalizeSearchText(value))) next.add(word);
  }
  vocabulary = next;
  lastNeedle = "";
  lastRequired = [];
}

function forms(word: string): string[] {
  const out = [word];
  if (word.length > 3 && word.endsWith("s")) out.push(word.slice(0, -1));
  return out;
}

function fuzzBudget(word: string): number {
  if (word.length >= 8) return 2;
  if (word.length >= 4) return 1;
  return 0;
}

function editDistance(a: string, b: string, max: number): number {
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;
  let prevPrev: number[] = [];
  let prev: number[] = [];
  for (let j = 0; j <= lb; j++) prev.push(j);
  for (let i = 1; i <= la; i++) {
    const cur: number[] = [i];
    let rowMin = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prevPrev[j - 2] + 1);
      }
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prevPrev = prev;
    prev = cur;
  }
  return prev[lb];
}

function fuzzyIn(word: string, candidates: Iterable<string>): boolean {
  const budget = fuzzBudget(word);
  if (!budget) return false;
  for (const candidate of candidates) {
    if (editDistance(word, candidate, budget) <= budget) return true;
  }
  return false;
}

function wordHits(word: string, haystack: string, hayTokens: string[]): boolean {
  if (forms(word).some((f) => haystack.includes(f))) return true;
  return fuzzyIn(word, hayTokens);
}

function requiredWords(needle: string): string[] {
  if (needle === lastNeedle) return lastRequired;
  const words = tokens(needle).filter((w) => !forms(w).some((f) => FILLER.has(f)));
  const vocab = vocabulary;
  const known = vocab
    ? words.filter((w) => forms(w).some((f) => vocab.has(f)) || fuzzyIn(w, vocab))
    : words;
  lastNeedle = needle;
  lastRequired = known.length ? known : words;
  return lastRequired;
}

export function matchesSettingsSearch(
  query: string,
  values: readonly string[],
  translate: SettingsSearchTranslator,
  plain: readonly string[] = [],
): boolean {
  const needle = normalizeSearchText(query);
  if (!needle) return false;

  const parts: string[] = [];
  for (const value of values) {
    parts.push(normalizeSearchText(value));
    parts.push(normalizeSearchText(translate(value)));
  }
  for (const value of plain) parts.push(normalizeSearchText(value));
  const haystack = parts.join(SEPARATOR);

  if (haystack.includes(needle)) return true;

  const required = requiredWords(needle);
  if (!required.length) return false;

  const hayTokens = tokens(haystack);
  const hits = required.filter((word) => wordHits(word, haystack, hayTokens)).length;
  const allowedMisses = Math.floor(required.length / 4);
  return hits >= required.length - allowedMisses;
}

export function rankSettingsSearch(
  query: string,
  label: string,
  keywords: readonly string[] = [],
): number {
  const needle = normalizeSearchText(query);
  const name = normalizeSearchText(label);
  if (!needle) return 9000;

  let tier = 5;
  if (name === needle) tier = 0;
  else if (name.startsWith(needle)) tier = 1;
  else if (name.includes(needle)) tier = 2;
  else if (keywords.some((k) => normalizeSearchText(k) === needle)) tier = 3;
  else if (keywords.some((k) => normalizeSearchText(k).startsWith(needle))) tier = 4;

  if (tier < 5) {
    const at = name.indexOf(needle);
    return tier * 1000 + (at < 0 ? 200 : at) + name.length / 500;
  }

  // a whole-phrase match failed, so rank on how much of the query the label itself carries
  const words = tokens(needle).filter((w) => !forms(w).some((f) => FILLER.has(f)));
  const nameTokens = tokens(name);
  const inLabel = words.filter(
    (w) => forms(w).some((f) => name.includes(f)) || fuzzyIn(w, nameTokens),
  ).length;
  return 5000 - inLabel * 100 + name.length / 500;
}
