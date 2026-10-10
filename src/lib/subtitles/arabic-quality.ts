import type { SubCue } from "./parser";

export type ArabicSubtitleParseDiagnostics = {
  malformedBlocks?: number;
  emptyBlocks?: number;
};

export type ArabicSubtitleQualityOptions = {
  maxLinesPerCue?: number;
  maxCharactersPerSecond?: number;
  overlapToleranceSec?: number;
  encodingHealthy?: boolean;
  parseDiagnostics?: ArabicSubtitleParseDiagnostics;
};

export type ArabicSubtitleQualityIssue = {
  code:
    | "encoding-unhealthy"
    | "malformed-blocks"
    | "empty-cues"
    | "invalid-timing"
    | "overlapping-cues"
    | "too-many-lines"
    | "reading-speed"
    | "replacement-characters"
    | "unexpected-controls"
    | "unbalanced-bidi-controls";
  severity: "warning" | "error";
  count: number;
  message: string;
};

export type ArabicSubtitleQuality = {
  score: number;
  healthy: boolean;
  encodingHealthy: boolean;
  cueCount: number;
  arabicCueRatio: number;
  malformedCueCount: number;
  malformedBlockCount: number;
  emptyCueCount: number;
  invalidTimingCount: number;
  overlappingCueCount: number;
  overlapCount: number;
  excessiveLineCount: number;
  excessiveReadingSpeedCount: number;
  fastReadingCueCount: number;
  replacementCharacterCount: number;
  unexpectedControlCount: number;
  bidiControlCount: number;
  rtlControlIssues: number;
  unbalancedBidiControlCount: number;
  issues: ArabicSubtitleQualityIssue[];
};

export type ArabicCleanupResult = {
  text: string;
  changed: boolean;
  removedInvalidBidiControls: number;
  removedZeroWidthCharacters: number;
  normalizedWhitespaceRuns: number;
};

const EMBEDDING_OPENERS = new Set(["\u202A", "\u202B", "\u202D", "\u202E"]);
const ISOLATE_OPENERS = new Set(["\u2066", "\u2067", "\u2068"]);
const BIDI_CONTROLS = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/gu;
const BIDI_CONTROL_CHARACTER = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/u;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function countMatches(text: string, pattern: RegExp): number {
  return [...text.matchAll(pattern)].length;
}

function countUnexpectedControls(text: string): number {
  let count = 0;
  for (const character of text) {
    const code = character.charCodeAt(0);
    if (
      code <= 0x08 ||
      code === 0x0b ||
      code === 0x0c ||
      (code >= 0x0e && code <= 0x1f) ||
      (code >= 0x7f && code <= 0x9f)
    ) {
      count += 1;
    }
  }
  return count;
}

function invalidBidiIndices(text: string): Set<number> {
  const embedding: number[] = [];
  const isolate: number[] = [];
  const invalid = new Set<number>();
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (EMBEDDING_OPENERS.has(character)) embedding.push(index);
    else if (ISOLATE_OPENERS.has(character)) isolate.push(index);
    else if (character === "\u202C") {
      if (embedding.length === 0) invalid.add(index);
      else embedding.pop();
    } else if (character === "\u2069") {
      if (isolate.length === 0) invalid.add(index);
      else isolate.pop();
    }
  }
  for (const index of embedding) invalid.add(index);
  for (const index of isolate) invalid.add(index);
  return invalid;
}

function visibleCharacterCount(text: string): number {
  return [...text.replace(/<[^>]*>|\{[^}]*\}/gu, "")].filter(
    (character) => !/\s/u.test(character) && !BIDI_CONTROL_CHARACTER.test(character),
  ).length;
}

function makeIssue(
  code: ArabicSubtitleQualityIssue["code"],
  severity: ArabicSubtitleQualityIssue["severity"],
  count: number,
  message: string,
): ArabicSubtitleQualityIssue | null {
  return count > 0 ? { code, severity, count, message } : null;
}

export function analyzeArabicSubtitleQuality(
  raw: string,
  cues: readonly SubCue[],
  options: ArabicSubtitleQualityOptions = {},
): ArabicSubtitleQuality {
  const maxLines = options.maxLinesPerCue ?? 2;
  const maxCharactersPerSecond = options.maxCharactersPerSecond ?? 22;
  const overlapToleranceSec = options.overlapToleranceSec ?? 0.05;
  const malformedArrowCount = raw
    .split(/\r?\n/gu)
    .filter(
      (line) =>
        line.includes("-->") &&
        !/(?:\d{1,2}:)?\d{1,2}:\d{2}[,.]\d{1,3}\s*-->\s*(?:\d{1,2}:)?\d{1,2}:\d{2}[,.]\d{1,3}/u.test(
          line,
        ),
    ).length;
  const malformedBlockCount =
    malformedArrowCount + (options.parseDiagnostics?.malformedBlocks ?? 0);
  const emptyCueCount =
    cues.filter((cue) => cue.text.trim().length === 0).length +
    (options.parseDiagnostics?.emptyBlocks ?? 0);
  const invalidTimingCount = cues.filter(
    (cue) =>
      !Number.isFinite(cue.start) ||
      !Number.isFinite(cue.end) ||
      cue.start < 0 ||
      cue.end <= cue.start,
  ).length;

  const sortedCues = [...cues].sort((a, b) => a.start - b.start || a.end - b.end);
  let overlapCount = 0;
  for (let index = 1; index < sortedCues.length; index += 1) {
    if (sortedCues[index].start < sortedCues[index - 1].end - overlapToleranceSec) {
      overlapCount += 1;
    }
  }

  const excessiveLineCount = cues.filter(
    (cue) => cue.text.split(/\r?\n/gu).length > maxLines,
  ).length;
  const fastReadingCueCount = cues.filter((cue) => {
    const duration = cue.end - cue.start;
    return duration > 0 && visibleCharacterCount(cue.text) / duration > maxCharactersPerSecond;
  }).length;
  const replacementCharacterCount = countMatches(raw, /\uFFFD/gu);
  const unexpectedControlCount = countUnexpectedControls(raw);
  const bidiControlCount = countMatches(raw, BIDI_CONTROLS);
  const unbalancedBidiControlCount = invalidBidiIndices(raw).size;
  const encodingHealthy = options.encodingHealthy ?? replacementCharacterCount === 0;
  const arabicCueCount = cues.filter((cue) => /\p{Script=Arabic}/u.test(cue.text)).length;
  const arabicCueRatio = arabicCueCount / Math.max(1, cues.length);

  const issues = [
    makeIssue(
      "encoding-unhealthy",
      "error",
      encodingHealthy ? 0 : 1,
      "The selected subtitle decoding failed its health check.",
    ),
    makeIssue(
      "malformed-blocks",
      "error",
      malformedBlockCount,
      "Malformed subtitle timing blocks were found.",
    ),
    makeIssue("empty-cues", "warning", emptyCueCount, "Empty subtitle cues were found."),
    makeIssue("invalid-timing", "error", invalidTimingCount, "Subtitle cues have invalid timing."),
    makeIssue("overlapping-cues", "warning", overlapCount, "Subtitle cues overlap unexpectedly."),
    makeIssue(
      "too-many-lines",
      "warning",
      excessiveLineCount,
      "Subtitle cues exceed the line-count limit.",
    ),
    makeIssue(
      "reading-speed",
      "warning",
      fastReadingCueCount,
      "Subtitle cues exceed the reading-speed limit.",
    ),
    makeIssue(
      "replacement-characters",
      "error",
      replacementCharacterCount,
      "Replacement characters indicate damaged decoding.",
    ),
    makeIssue(
      "unexpected-controls",
      "error",
      unexpectedControlCount,
      "Unexpected control characters were found.",
    ),
    makeIssue(
      "unbalanced-bidi-controls",
      "warning",
      unbalancedBidiControlCount,
      "Unbalanced bidirectional controls were found.",
    ),
  ].filter((issue): issue is ArabicSubtitleQualityIssue => issue !== null);

  const cueDenominator = Math.max(1, cues.length);
  let score = 1;
  if (!encodingHealthy) score -= 0.3;
  score -= Math.min(0.35, malformedBlockCount * 0.12);
  score -= Math.min(0.25, invalidTimingCount * 0.12);
  score -= Math.min(0.2, replacementCharacterCount * 0.08);
  score -= Math.min(0.2, unexpectedControlCount * 0.06);
  score -= Math.min(0.12, unbalancedBidiControlCount * 0.03);
  score -= Math.min(0.12, emptyCueCount / cueDenominator);
  score -= Math.min(0.15, (overlapCount / cueDenominator) * 0.35);
  score -= Math.min(0.1, (excessiveLineCount / cueDenominator) * 0.2);
  score -= Math.min(0.12, (fastReadingCueCount / cueDenominator) * 0.25);
  score = clamp01(score);

  const healthy =
    score >= 0.75 &&
    encodingHealthy &&
    malformedBlockCount === 0 &&
    invalidTimingCount === 0 &&
    replacementCharacterCount === 0 &&
    unexpectedControlCount === 0;

  return {
    score,
    healthy,
    encodingHealthy,
    cueCount: cues.length,
    arabicCueRatio,
    malformedCueCount: malformedBlockCount + invalidTimingCount,
    malformedBlockCount,
    emptyCueCount,
    invalidTimingCount,
    overlappingCueCount: overlapCount,
    overlapCount,
    excessiveLineCount,
    excessiveReadingSpeedCount: fastReadingCueCount,
    fastReadingCueCount,
    replacementCharacterCount,
    unexpectedControlCount,
    bidiControlCount,
    rtlControlIssues: unbalancedBidiControlCount,
    unbalancedBidiControlCount,
    issues,
  };
}

export function cleanupArabicSubtitleTextSafely(raw: string): ArabicCleanupResult {
  const invalidBidi = invalidBidiIndices(raw);
  let removedInvalidBidiControls = 0;
  let withoutInvalidBidi = "";
  for (let index = 0; index < raw.length; index += 1) {
    if (invalidBidi.has(index)) {
      removedInvalidBidiControls += 1;
      continue;
    }
    withoutInvalidBidi += raw[index];
  }

  let removedZeroWidthCharacters = 0;
  const withoutZeroWidth = withoutInvalidBidi.replace(/[\u200B\uFEFF]/gu, () => {
    removedZeroWidthCharacters += 1;
    return "";
  });
  let normalizedWhitespaceRuns = 0;
  const normalizedLines = withoutZeroWidth
    .replace(/\r\n?/gu, "\n")
    .replace(/[\u00A0\u202F]/gu, " ")
    .split("\n")
    .map((line) =>
      line
        .replace(/[\t ]{2,}/gu, () => {
          normalizedWhitespaceRuns += 1;
          return " ";
        })
        .trim(),
    )
    .join("\n");
  const text = normalizedLines.replace(/\n{3,}/gu, () => {
    normalizedWhitespaceRuns += 1;
    return "\n\n";
  });

  return {
    text,
    changed: text !== raw,
    removedInvalidBidiControls,
    removedZeroWidthCharacters,
    normalizedWhitespaceRuns,
  };
}

export function cleanupArabicCuesSafely(cues: readonly SubCue[]): SubCue[] {
  return cues.map((cue) => ({
    ...cue,
    text: cleanupArabicSubtitleTextSafely(cue.text).text,
  }));
}
