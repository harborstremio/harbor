import type { Chapter } from "../player/bridge";
import type { SkipKind, SkipSegment } from "./types";

const INTRO_PATTERNS = [
  /\b(opening|op)\b/i,
  /\bop\s?\d+\b/i,
  /\bintro\b/i,
  /\bopening\s*credits\b/i,
  /\btheme\s*song\b/i,
];

const OUTRO_PATTERNS = [
  /\b(ending|ed)\b/i,
  /\bed\s?\d+\b/i,
  /\b(outro|outtro)\b/i,
  /\bend\s*credits?\b/i,
  /\bclosing\s*credits?\b/i,
  /\bcredits?\b/i,
];

const RECAP_PATTERNS = [/\b(recap|previously)\b/i];

// Anime releases routinely ship the OP and ED as chapters but leave them titled
// "Chapter 2", blank, or in Japanese, so position and length are the only signal.
const EPISODE_MAX_SEC = 35 * 60;
const THEME_MIN_SEC = 30;
const THEME_MAX_SEC = 110;
const IDEAL_INTRO_SEC = 90;
const EDGE_FRACTION = 0.2;

type Span = { startSec: number; endSec: number };

function classify(title: string): SkipKind | null {
  if (!title) return null;
  for (const r of RECAP_PATTERNS) if (r.test(title)) return "recap";
  for (const r of INTRO_PATTERNS) if (r.test(title)) return "intro";
  for (const r of OUTRO_PATTERNS) if (r.test(title)) return "outro";
  return null;
}

function spanOf(sorted: Chapter[], i: number, durationSec: number): Span {
  const next = sorted[i + 1];
  return {
    startSec: sorted[i].startSec,
    endSec: next ? next.startSec : durationSec || sorted[i].startSec + IDEAL_INTRO_SEC,
  };
}

function themeCandidates(sorted: Chapter[], durationSec: number, taken: SkipSegment[]): Span[] {
  return sorted
    .map((_, i) => spanOf(sorted, i, durationSec))
    .filter((span) => {
      const length = span.endSec - span.startSec;
      if (length < THEME_MIN_SEC || length > THEME_MAX_SEC) return false;
      return !taken.some((s) => span.startSec < s.endSec && s.startSec < span.endSec);
    });
}

/** Falls back to shape when a release leaves its opening or ending untitled. */
function unnamedThemes(sorted: Chapter[], durationSec: number, named: SkipSegment[]): SkipSegment[] {
  if (durationSec <= 0 || durationSec > EPISODE_MAX_SEC) return [];
  const out: SkipSegment[] = [];
  const candidates = themeCandidates(sorted, durationSec, named);
  if (!named.some((s) => s.kind === "intro")) {
    const [intro] = candidates
      .filter((span) => span.startSec <= durationSec * EDGE_FRACTION)
      .sort(
        (a, b) =>
          Math.abs(a.endSec - a.startSec - IDEAL_INTRO_SEC) -
          Math.abs(b.endSec - b.startSec - IDEAL_INTRO_SEC),
      );
    if (intro) out.push({ kind: "intro", ...intro, source: "chapters" });
  }
  if (!named.some((s) => s.kind === "outro")) {
    // One ending or none: several late chapters of theme length is a music disc, not an episode.
    const endings = candidates.filter(
      (span) =>
        span.endSec >= durationSec * (1 - EDGE_FRACTION) &&
        !out.some((s) => s.startSec === span.startSec),
    );
    if (endings.length === 1) out.push({ kind: "outro", ...endings[0], source: "chapters" });
  }
  return out;
}

export function chaptersToSegments(chapters: Chapter[], durationSec: number): SkipSegment[] {
  if (chapters.length === 0) return [];
  const sorted = [...chapters].sort((a, b) => a.startSec - b.startSec);
  const out: SkipSegment[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const kind = classify(sorted[i].title);
    if (!kind) continue;
    const span = spanOf(sorted, i, durationSec);
    if (span.endSec <= span.startSec) continue;
    out.push({ kind, startSec: span.startSec, endSec: span.endSec, source: "chapters" });
  }
  return [...out, ...unnamedThemes(sorted, durationSec, out)].sort(
    (a, b) => a.startSec - b.startSec,
  );
}
