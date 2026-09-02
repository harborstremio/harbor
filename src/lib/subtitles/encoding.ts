export type SubtitleEncodingOptions = {
  encoding?: string;
  lang?: string;
};

export type SubtitleDecodeDiagnostic = {
  code:
    | "bom-detected"
    | "invalid-utf8"
    | "ambiguous-legacy-encoding"
    | "declared-encoding-unavailable"
    | "legacy-encoding-selected"
    | "replacement-characters"
    | "control-characters"
    | "low-decode-health";
  severity: "info" | "warning" | "error";
  message: string;
  count?: number;
};

export type SubtitleDecodeCandidate = {
  encoding: string;
  score: number;
  replacementCount: number;
  controlCount: number;
  mojibakeCount: number;
  timestampCount: number;
  printableRatio: number;
  arabicRatio: number;
};

export type SubtitleDecodeResult = {
  text: string;
  encoding: string;
  healthScore: number;
  healthy: boolean;
  diagnostics: SubtitleDecodeDiagnostic[];
  candidates: SubtitleDecodeCandidate[];
};

type AssessedCandidate = SubtitleDecodeCandidate & { text: string };

const HEALTHY_SCORE = 0.72;
const ARABIC_LANGUAGE_TAGS = new Set(["ar", "ara", "arabic"]);
const ARABIC_SINGLE_BYTE_ENCODINGS = ["windows-1256", "iso-8859-6", "windows-1252"];
const GENERAL_SINGLE_BYTE_ENCODINGS = ["windows-1252", "windows-1256", "iso-8859-6"];
const COMMON_ARABIC_WORDS = new Set([
  "أنا",
  "أنت",
  "إلى",
  "الآن",
  "التي",
  "الذي",
  "السلام",
  "الله",
  "في",
  "كان",
  "لا",
  "لكن",
  "لم",
  "لن",
  "ما",
  "من",
  "هذا",
  "هذه",
  "هو",
  "هي",
  "وهو",
  "يا",
  "سلام",
  "عالم",
  "العالم",
  "بالعالم",
  "مرحبا",
]);

const COMMON_ARABIC_SEQUENCES = [
  "ال",
  "لا",
  "بال",
  "وال",
  "لل",
  "من",
  "في",
  "على",
  "إلى",
  "أن",
  "إن",
  "ما",
  "هو",
  "هي",
  "هذا",
  "هذه",
  "كان",
  "مر",
  "رح",
  "حب",
  "عا",
  "عال",
  "الم",
] as const;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function normalizeEncodingLabel(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/_/g, "-");
  if (normalized === "utf8") return "utf-8";
  if (normalized === "utf16le" || normalized === "utf-16") return "utf-16le";
  if (normalized === "utf16be") return "utf-16be";
  if (normalized === "cp1256" || normalized === "windows1256") return "windows-1256";
  if (normalized === "cp1252" || normalized === "windows1252") return "windows-1252";
  if (normalized === "iso8859-6" || normalized === "iso-8859-6-i") return "iso-8859-6";
  return normalized;
}

function isArabicLanguage(lang: string | undefined): boolean {
  const normalized = (lang ?? "").trim().toLowerCase().replace(/_/g, "-");
  return ARABIC_LANGUAGE_TAGS.has(normalized) || normalized.startsWith("ar-");
}

function countMatches(text: string, pattern: RegExp): number {
  return [...text.matchAll(pattern)].length;
}

function isControlCharacter(character: string): boolean {
  const code = character.codePointAt(0) ?? 0;
  if (character === "\n" || character === "\r" || character === "\t") return false;
  return code < 0x20 || (code >= 0x7f && code <= 0x9f);
}

function arabicLexicalPlausibility(text: string): number {
  const words =
    text
      .normalize("NFKC")
      .replace(/[\u0610-\u061a\u0640\u064b-\u065f\u0670\u06d6-\u06ed]/gu, "")
      .match(/\p{Script=Arabic}{2,}/gu) ?? [];
  if (words.length === 0) return 0;
  const commonWords = words.filter((word) => COMMON_ARABIC_WORDS.has(word)).length / words.length;
  const joined = words.join(" ");
  const sequenceHits = COMMON_ARABIC_SEQUENCES.reduce(
    (total, sequence) => total + countMatches(joined, new RegExp(sequence, "gu")),
    0,
  );
  const sequenceDensity = Math.min(1, sequenceHits / Math.max(2, joined.length / 3));
  return commonWords * 0.7 + sequenceDensity * 0.3;
}

function assessCandidate(
  text: string,
  encoding: string,
  options: SubtitleEncodingOptions,
  validUtf8: boolean,
): AssessedCandidate {
  const characters = [...text];
  const contentCharacters = characters.filter((character) => !/\s/u.test(character));
  const denominator = Math.max(1, contentCharacters.length);
  const replacementCount = countMatches(text, /\uFFFD/gu);
  const controlCount = characters.filter(isControlCharacter).length;
  const mojibakeCount = countMatches(text, /(?:Ã.|Â.|â.|Ø.|Ù.)/gu);
  const timestampCount =
    countMatches(text, /\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->/gu) +
    countMatches(text, /^Dialogue:[^\n]*,\d+:\d{2}:\d{2}\.\d{1,3},/gimu);
  const printableCount = contentCharacters.filter(
    (character) => character !== "\uFFFD" && !isControlCharacter(character),
  ).length;
  const printableRatio = printableCount / denominator;
  const letterCount = countMatches(text, /\p{L}/gu);
  const arabicCount = countMatches(text, /\p{Script=Arabic}/gu);
  const arabicRatio = arabicCount / Math.max(1, letterCount);

  const arabicLanguage = isArabicLanguage(options.lang);
  const hasDeclaredNonArabicLanguage = Boolean(options.lang?.trim()) && !arabicLanguage;
  let score = 0.16 + printableRatio * 0.64;
  if (replacementCount > 0) score -= 0.32 + Math.min(0.4, replacementCount / denominator);
  score -= Math.min(0.5, (controlCount / Math.max(1, characters.length)) * 6);
  score -= Math.min(0.35, (mojibakeCount / denominator) * 8);
  if (timestampCount > 0) score += 0.06;
  if (!options.lang?.trim() && arabicRatio >= 0.25) score += 0.03;
  if (hasDeclaredNonArabicLanguage && arabicRatio >= 0.25) score -= 0.08;

  const declaredEncoding = options.encoding ? normalizeEncodingLabel(options.encoding) : undefined;
  if (declaredEncoding === encoding) score += 0.07;
  if (encoding === "utf-8" && validUtf8) score += 0.08;
  if (arabicLanguage) {
    if (arabicRatio >= 0.25) score += 0.05;
    else if (letterCount >= 8) score -= 0.18;
    if (letterCount >= 8) score -= (1 - arabicRatio) * 0.08;
    score += arabicLexicalPlausibility(text) * 0.08;
  }

  return {
    text,
    encoding,
    score: clamp01(score),
    replacementCount,
    controlCount,
    mojibakeCount,
    timestampCount,
    printableRatio,
    arabicRatio,
  };
}

function tryDecode(
  bytes: Uint8Array,
  encoding: string,
  options: SubtitleEncodingOptions,
  validUtf8: boolean,
): AssessedCandidate | null {
  try {
    const text = new TextDecoder(encoding).decode(bytes);
    return assessCandidate(text, encoding, options, validUtf8);
  } catch {
    return null;
  }
}

function hasPrefix(bytes: Uint8Array, prefix: number[]): boolean {
  return prefix.every((value, index) => bytes[index] === value);
}

function withoutBom(bytes: Uint8Array, length: number): Uint8Array {
  return bytes.subarray(Math.min(length, bytes.length));
}

function publicCandidate(candidate: AssessedCandidate): SubtitleDecodeCandidate {
  const { text: _text, ...summary } = candidate;
  return summary;
}

export function decodeSubtitleBytesDetailed(
  bytes: Uint8Array,
  options: SubtitleEncodingOptions = {},
): SubtitleDecodeResult {
  const diagnostics: SubtitleDecodeDiagnostic[] = [];
  const bom = hasPrefix(bytes, [0xff, 0xfe])
    ? { encoding: "utf-16le", length: 2 }
    : hasPrefix(bytes, [0xfe, 0xff])
      ? { encoding: "utf-16be", length: 2 }
      : hasPrefix(bytes, [0xef, 0xbb, 0xbf])
        ? { encoding: "utf-8", length: 3 }
        : null;

  let validUtf8 = false;
  if (!bom || bom.encoding === "utf-8") {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(
        bom?.encoding === "utf-8" ? withoutBom(bytes, 3) : bytes,
      );
      validUtf8 = true;
    } catch {
      diagnostics.push({
        code: "invalid-utf8",
        severity: "info",
        message: "The subtitle byte stream is not valid UTF-8.",
      });
    }
  }

  const candidates: AssessedCandidate[] = [];
  let selected: AssessedCandidate | null = null;
  if (bom) {
    selected = tryDecode(withoutBom(bytes, bom.length), bom.encoding, options, validUtf8);
    if (selected) candidates.push(selected);
    diagnostics.push({
      code: "bom-detected",
      severity: "info",
      message: `Decoded using the ${bom.encoding} byte-order mark.`,
    });
  } else {
    const requested = options.encoding ? normalizeEncodingLabel(options.encoding) : undefined;
    const fallbackEncodings = isArabicLanguage(options.lang)
      ? ARABIC_SINGLE_BYTE_ENCODINGS
      : GENERAL_SINGLE_BYTE_ENCODINGS;
    const encodings = [requested, "utf-8", ...fallbackEncodings].filter(
      (encoding, index, all): encoding is string =>
        Boolean(encoding) && all.indexOf(encoding) === index,
    );
    for (const encoding of encodings) {
      const candidate = tryDecode(bytes, encoding, options, validUtf8);
      if (candidate) candidates.push(candidate);
      else if (encoding === requested) {
        diagnostics.push({
          code: "declared-encoding-unavailable",
          severity: "warning",
          message: `The declared subtitle encoding ${encoding} is not available.`,
        });
      }
    }

    selected = validUtf8
      ? (candidates.find((candidate) => candidate.encoding === "utf-8") ?? null)
      : candidates.reduce<AssessedCandidate | null>((best, candidate) => {
          if (!best || candidate.score > best.score) return candidate;
          return best;
        }, null);
  }

  if (!selected) {
    selected = assessCandidate("", "utf-8", options, false);
    candidates.push(selected);
  }

  let ambiguousLegacy = false;
  if (!bom && !options.encoding && isArabicLanguage(options.lang) && !validUtf8) {
    const windows = candidates.find((candidate) => candidate.encoding === "windows-1256");
    const iso = candidates.find((candidate) => candidate.encoding === "iso-8859-6");
    ambiguousLegacy = Boolean(
      windows && iso && windows.text !== iso.text && Math.abs(windows.score - iso.score) < 0.012,
    );
    if (ambiguousLegacy) {
      diagnostics.push({
        code: "ambiguous-legacy-encoding",
        severity: "warning",
        message: "Arabic legacy encodings are too close to distinguish safely.",
      });
    }
  }

  if (!selected.encoding.startsWith("utf-")) {
    diagnostics.push({
      code: "legacy-encoding-selected",
      severity: "info",
      message: `Selected legacy subtitle encoding ${selected.encoding}.`,
    });
  }
  if (selected.replacementCount > 0) {
    diagnostics.push({
      code: "replacement-characters",
      severity: "warning",
      message: "Decoded text contains replacement characters.",
      count: selected.replacementCount,
    });
  }
  if (selected.controlCount > 0) {
    diagnostics.push({
      code: "control-characters",
      severity: "warning",
      message: "Decoded text contains unexpected control characters.",
      count: selected.controlCount,
    });
  }

  const healthy =
    !ambiguousLegacy &&
    selected.score >= HEALTHY_SCORE &&
    selected.replacementCount === 0 &&
    selected.controlCount === 0;
  if (!healthy) {
    diagnostics.push({
      code: "low-decode-health",
      severity: "error",
      message: `Subtitle decode health is low (${selected.score.toFixed(2)}).`,
    });
  }

  return {
    text: selected.text,
    encoding: selected.encoding,
    healthScore: selected.score,
    healthy,
    diagnostics,
    candidates: candidates
      .map(publicCandidate)
      .sort((a, b) => b.score - a.score || a.encoding.localeCompare(b.encoding)),
  };
}

export function decodeSubtitleBytes(
  bytes: Uint8Array,
  options: SubtitleEncodingOptions = {},
): string {
  return decodeSubtitleBytesDetailed(bytes, options).text;
}
