import type { Chapter } from "../player/bridge";
import type { SkipKind, SkipSegment } from "./types";

const INTRO_PATTERNS = [/\b(opening|op)\b/i, /\bintro\b/i, /\bopening\s*credits\b/i, /\btheme\s*song\b/i];

const OUTRO_PATTERNS = [
  /\b(ending|ed)\b/i,
  /\b(outro|outtro)\b/i,
  /\bend\s*credits?\b/i,
  /\bclosing\s*credits?\b/i,
  /\bcredits?\b/i,
];

const RECAP_PATTERNS = [/\b(recap|previously)\b/i];

function classify(title: string): SkipKind | null {
  if (!title) return null;
  for (const r of RECAP_PATTERNS) if (r.test(title)) return "recap";
  for (const r of INTRO_PATTERNS) if (r.test(title)) return "intro";
  for (const r of OUTRO_PATTERNS) if (r.test(title)) return "outro";
  return null;
}

export function chaptersToSegments(chapters: Chapter[], durationSec: number): SkipSegment[] {
  if (chapters.length === 0) return [];
  const sorted = [...chapters].sort((a, b) => a.startSec - b.startSec);
  const out: SkipSegment[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i];
    const kind = classify(c.title);
    if (!kind) continue;
    const next = sorted[i + 1];
    const endSec = next ? next.startSec : durationSec || c.startSec + 90;
    if (endSec <= c.startSec) continue;
    out.push({ kind, startSec: c.startSec, endSec, source: "chapters" });
  }
  return out;
}
