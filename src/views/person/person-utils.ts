import type { PersonCredit } from "@/lib/providers/tmdb";

export const WRITER_JOBS = new Set(["Writer", "Screenplay", "Story", "Teleplay", "Author", "Novel", "Original Story"]);
export const PRODUCER_JOBS = new Set(["Producer", "Executive Producer"]);
export const DIRECTOR_JOBS = new Set(["Director"]);

export function isCameoOrGuest(c: PersonCredit): boolean {
  const ch = (c.character ?? "").toLowerCase().trim();
  const isSelf =
    ch === "self" ||
    ch === "himself" ||
    ch === "herself" ||
    ch === "themselves" ||
    ch.startsWith("self ") ||
    ch.startsWith("self -") ||
    ch.startsWith("himself ") ||
    ch.startsWith("himself -") ||
    ch.startsWith("herself ") ||
    ch.startsWith("herself -");
  if (ch.includes("(uncredited)") || ch.includes("archive footage") || ch.includes("archival footage")) return true;
  if (!isSelf) return false;
  if (c.mediaType === "tv" && (c.episodeCount ?? 0) >= 8) return false;
  return true;
}

export function notableScore(c: PersonCredit): number {
  const votes = c.voteCount;
  if (c.mediaType === "tv") {
    const eps = c.episodeCount ?? 0;
    if (eps < 3) return votes * 0.25;
    const epBoost = Math.min(4.5, 1 + Math.log2(eps / 2));
    const billing = c.order != null && c.order < 5 ? 1.4 : 1;
    return votes * epBoost * billing;
  }
  const billing = c.order != null && c.order < 5 ? 1.25 : 1;
  return votes * billing;
}

export function dedupe(credits: PersonCredit[]): PersonCredit[] {
  const map = new Map<string, PersonCredit>();
  for (const c of credits) {
    const k = `${c.mediaType}:${c.id}:${c.job ?? ""}`;
    const existing = map.get(k);
    if (!existing || existing.popularity < c.popularity) map.set(k, c);
  }
  return [...map.values()];
}

export function dedupeByMedia(credits: PersonCredit[]): PersonCredit[] {
  const map = new Map<string, PersonCredit>();
  for (const c of credits) {
    const k = `${c.mediaType}:${c.id}`;
    const existing = map.get(k);
    if (!existing || existing.popularity < c.popularity) map.set(k, c);
  }
  return [...map.values()];
}

export function calcAge(birth: string, death: string | null): number | null {
  const b = parseFlexibleDate(birth);
  if (!b) return null;
  const end = death ? (parseFlexibleDate(death) ?? new Date()) : new Date();
  let age = end.getFullYear() - b.getFullYear();
  const m = end.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && end.getDate() < b.getDate())) age--;
  return age;
}

export function fmtDate(s: string): string {
  const d = parseFlexibleDate(s);
  if (!d) return s;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function parseFlexibleDate(s: string): Date | null {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (dateOnly) {
    const y = Number(dateOnly[1]);
    const m = Number(dateOnly[2]);
    const day = Number(dateOnly[3]);
    const d = new Date(y, m - 1, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
