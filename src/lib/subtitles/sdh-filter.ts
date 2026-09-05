const NON_LATIN = /[\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0900-\u097F\u0E00-\u0E7F\u0370-\u03FF\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF]/;

export function sdhSafeForLanguage(lang: string | null | undefined): boolean {
  if (!lang) return true;
  const code = lang.trim().toLowerCase().split(/[-_]/)[0];
  return !NON_LATIN_LANGS.has(code);
}

const NON_LATIN_LANGS = new Set([
  "ar", "arb", "he", "heb", "iw", "fa", "per", "fas", "ur", "urd",
  "ru", "rus", "uk", "ukr", "bg", "bul", "sr", "srp", "mk", "mkd", "be", "bel",
  "el", "gre", "ell", "hy", "hye", "ka", "kat", "th", "tha", "km", "khm", "lo", "lao",
  "ja", "jpn", "zh", "zho", "chi", "yue", "ko", "kor",
  "hi", "hin", "bn", "ben", "ta", "tam", "te", "tel", "ml", "mal", "kn", "kan",
  "mr", "mar", "gu", "guj", "pa", "pan", "si", "sin", "am", "amh", "yi", "yid",
]);

const SPEAKER_LABEL = /^(-[ \t]+)?([A-Z0-9][A-Z0-9 \t.'’&#/-]{0,39}):[ \t]*/;
const SQUARE_ENCLOSURE = /\[[^[\]]*\]/g;
const NOTHING_LEFT = /^[-\s–—]*$/;

function stripSpeakerLabel(line: string): string {
  const m = SPEAKER_LABEL.exec(line);
  if (!m) return line;
  if (!/[A-Z]/.test(m[2])) return line;
  return (m[1] ?? "") + line.slice(m[0].length);
}

const EDGE_ROUND = /^([\s♪♫-]*)(\([^()]*\))|(\([^()]*\))([\s♪♫-]*)$/g;

function stripEnclosures(line: string): string {
  const withoutSquare = line.replace(SQUARE_ENCLOSURE, "");
  return withoutSquare.replace(EDGE_ROUND, (whole, lead, headParen, tailParen, trail) => {
    const paren = headParen ?? tailParen;
    const inner = paren.slice(1, -1);
    if (!/[A-Z]/.test(inner) || /[a-z]/.test(inner)) return whole;
    return (lead ?? "") + (trail ?? "");
  });
}

export function stripSdhText(text: string): string {
  if (!text) return text;
  const kept: string[] = [];
  for (const raw of text.split("\n")) {
    if (NON_LATIN.test(raw)) {
      kept.push(raw);
      continue;
    }
    const line = stripSpeakerLabel(stripEnclosures(raw).trimStart())
      .replace(/[ \t]+/g, " ")
      .trim();
    if (NOTHING_LEFT.test(line)) continue;
    kept.push(line);
  }
  return kept.join("\n");
}
