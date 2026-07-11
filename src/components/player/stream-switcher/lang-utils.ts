import type { ScoredStream } from "@/lib/streams/types";

export function abbreviateLanguages(langs: string[]): string {
  if (langs.length === 0) return "";
  const seen = new Set<string>();
  const codes: string[] = [];
  for (const l of langs) {
    const code = langCode(l);
    if (seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
  }
  return codes.join(", ");
}

export function normalizeLangCode(s: string): string {
  const lower = s.trim().toLowerCase();
  if (lower === "jp") return "ja";
  const nameToCode: Record<string, string> = {
    english: "en",
    portuguese: "pt",
    spanish: "es",
    french: "fr",
    german: "de",
    italian: "it",
    japanese: "ja",
    korean: "ko",
    chinese: "zh",
    russian: "ru",
    hindi: "hi",
    arabic: "ar",
    dutch: "nl",
    polish: "pl",
    turkish: "tr",
    swedish: "sv",
    norwegian: "no",
    danish: "da",
    finnish: "fi",
    czech: "cs",
    hungarian: "hu",
    romanian: "ro",
    hebrew: "he",
    thai: "th",
    vietnamese: "vi",
    ukrainian: "uk",
  };
  if (nameToCode[lower]) return nameToCode[lower];
  return lower.slice(0, 2);
}

export function langCode(name: string): string {
  const map: Record<string, string> = {
    English: "EN",
    Portuguese: "PT",
    Spanish: "ES",
    French: "FR",
    German: "DE",
    Italian: "IT",
    Japanese: "JA",
    Korean: "KO",
    Chinese: "ZH",
    Russian: "RU",
    Hindi: "HI",
    Arabic: "AR",
    Dutch: "NL",
    Polish: "PL",
    Turkish: "TR",
    Swedish: "SV",
    Norwegian: "NO",
    Danish: "DA",
    Finnish: "FI",
    Czech: "CS",
    Hungarian: "HU",
    Romanian: "RO",
    Hebrew: "HE",
    Thai: "TH",
    Vietnamese: "VI",
    Ukrainian: "UK",
  };
  return map[name] ?? name.slice(0, 2).toUpperCase();
}

export function streamMatchesLangs(s: ScoredStream, prefs: string[]): boolean {
  if (s.audioLanguages.length === 0) return true;
  if (s.audioLanguages.includes("Multi")) return true;
  return s.audioLanguages.some((l) =>
    prefs.some((p) => l.toLowerCase() === p.toLowerCase() || l.toLowerCase().startsWith(p.toLowerCase())),
  );
}
