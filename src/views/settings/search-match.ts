export type SettingsSearchTranslator = (value: string) => string;

const SEPARATOR = "\n";

const FILLER = new Set([
  "a", "an", "the", "my", "me", "i", "is", "are", "was", "be", "to", "of", "on", "in", "at",
  "for", "and", "or", "it", "its", "this", "that", "these", "those", "with", "from", "by",
  "how", "do", "does", "did", "can", "cant", "dont", "doesnt", "wont", "when", "why", "what",
  "where", "which", "who", "not", "no", "so", "too", "very", "just", "get", "got", "keep",
  "turn", "want", "wants", "need", "needs", "please", "make", "makes", "off",
]);

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

let vocabulary: Set<string> | null = null;

export function setSettingsSearchVocabulary(values: Iterable<string>): void {
  const next = new Set<string>();
  for (const value of values) {
    for (const word of normalizeSearchText(value).split(/[^\p{L}\p{N}]+/u)) {
      if (word.length > 1) next.add(word);
    }
  }
  vocabulary = next;
}

function forms(word: string): string[] {
  const out = [word];
  if (word.length > 3 && word.endsWith("s")) out.push(word.slice(0, -1));
  return out;
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

  const words = needle
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1 && !forms(w).some((f) => FILLER.has(f)));
  if (!words.length) return false;

  const vocab = vocabulary;
  const known = vocab ? words.filter((w) => forms(w).some((f) => vocab.has(f))) : words;
  const required = known.length ? known : words;
  const hits = required.filter((word) => forms(word).some((f) => haystack.includes(f))).length;
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
  const words = needle
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1 && !forms(w).some((f) => FILLER.has(f)));
  const inLabel = words.filter((w) => forms(w).some((f) => name.includes(f))).length;
  return 5000 - inLabel * 100 + name.length / 500;
}
