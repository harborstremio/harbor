const ISO_3_TO_1: Record<string, string> = {
  eng: "en", fre: "fr", fra: "fr", ger: "de", deu: "de", spa: "es", ita: "it",
  jpn: "ja", kor: "ko", rus: "ru", por: "pt", chi: "zh", zho: "zh", ara: "ar",
  hin: "hi", tha: "th", vie: "vi", tur: "tr", pol: "pl", dut: "nl", nld: "nl",
  swe: "sv", nor: "no", dan: "da", fin: "fi", heb: "he", ind: "id", ces: "cs",
  cze: "cs", ell: "el", gre: "el", hun: "hu", rum: "ro", ron: "ro", ukr: "uk",
};

const NAMES: Record<string, string> = {
  en: "English", es: "Spanish", "es-419": "Spanish (Latin America)", fr: "French",
  de: "German", it: "Italian",
  ja: "Japanese", ko: "Korean", zh: "Chinese", ru: "Russian", pt: "Portuguese",
  ar: "Arabic", hi: "Hindi", th: "Thai", vi: "Vietnamese", tr: "Turkish",
  pl: "Polish", nl: "Dutch", sv: "Swedish", no: "Norwegian", da: "Danish",
  fi: "Finnish", he: "Hebrew", id: "Indonesian", cs: "Czech", el: "Greek",
  hu: "Hungarian", ro: "Romanian", uk: "Ukrainian",
};

const LATAM_ALIASES = new Set([
  "es-419", "es-la", "lat", "latam", "latino", "latin american spanish",
  "spanish (latin america)", "spanish latin america", "español latino",
  "espanol latino", "español latinoamericano",
]);

const LATAM_REGIONS = new Set([
  "mx", "ar", "co", "cl", "pe", "ve", "ec", "gt", "cu", "bo", "do", "hn",
  "py", "sv", "ni", "cr", "pa", "uy", "pr", "419",
]);

const NAME_TO_CODE: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const [code, name] of Object.entries(NAMES)) m[name.toLowerCase()] = code;
  m["jp"] = "ja";
  m["mandarin"] = "zh";
  m["cantonese"] = "zh";
  return m;
})();

export function normalizeLang(input?: string | null): string {
  if (!input) return "";
  const raw = input.trim().toLowerCase();
  if (LATAM_ALIASES.has(raw)) return "es-419";
  if (raw.length === 2) return raw;
  if (raw.length === 3 && ISO_3_TO_1[raw]) return ISO_3_TO_1[raw];
  if (NAME_TO_CODE[raw]) return NAME_TO_CODE[raw];
  if (raw.includes("-") || raw.includes("_")) {
    const [head, region] = raw.split(/[-_]/);
    const headCode = head.length === 2 ? head : ISO_3_TO_1[head] ?? NAME_TO_CODE[head];
    if (headCode === "es" && region && LATAM_REGIONS.has(region)) return "es-419";
    if (headCode) return headCode;
  }
  return raw;
}

export function languageName(code: string): string {
  const n = normalizeLang(code);
  return NAMES[n] || code.toUpperCase();
}

export function langScore(lang: string, preferred: string[]): number {
  if (!preferred.length) return 0;
  const n = normalizeLang(lang);
  const baseOf = (c: string) => c.split("-")[0];
  let exactIdx = -1;
  let baseIdx = -1;
  for (let i = 0; i < preferred.length; i++) {
    const pn = normalizeLang(preferred[i]);
    if (exactIdx === -1 && pn === n) exactIdx = i;
    if (baseIdx === -1 && baseOf(pn) === baseOf(n)) baseIdx = i;
  }
  if (exactIdx !== -1) return (preferred.length - exactIdx) * 2;
  if (baseIdx !== -1) return (preferred.length - baseIdx) * 2 - 1;
  return -1;
}

export function pickBestTrack<T extends { lang?: string; default?: boolean; forced?: boolean }>(
  tracks: T[],
  preferred: string[],
): T | null {
  if (tracks.length === 0) return null;
  let best: T | null = null;
  let bestScore = -Infinity;
  for (const t of tracks) {
    if (t.forced) continue;
    const ls = langScore(t.lang ?? "", preferred);
    if (ls < 0) continue;
    const score = ls * 10 + (t.default ? 1 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}