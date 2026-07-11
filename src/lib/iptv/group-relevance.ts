const REGION_TO_TOKENS: Record<string, string[]> = {
  US: ["US", "USA", "UNITED STATES", "AMERICA", "AMERICAN"],
  CA: ["CA", "CAN", "CANADA", "CANADIAN"],
  GB: ["UK", "GB", "BRITAIN", "BRITISH", "ENGLAND", "ENGLISH"],
  AU: ["AU", "AUS", "AUSTRALIA", "AUSTRALIAN"],
  NZ: ["NZ", "NEW ZEALAND"],
  IE: ["IE", "IRELAND", "IRISH"],
  IN: ["IN", "INDIA", "INDIAN"],
  FR: ["FR", "FRANCE", "FRENCH"],
  DE: ["DE", "GERMANY", "DEUTSCH", "GERMAN"],
  IT: ["IT", "ITALY", "ITALIAN"],
  ES: ["ES", "SPAIN", "SPANISH"],
  PT: ["PT", "PORTUGAL", "PORTUGUESE"],
  BR: ["BR", "BRAZIL", "BRASIL"],
  MX: ["MX", "MEXICO", "MEXICAN"],
  NL: ["NL", "NETHERLANDS", "DUTCH"],
  SE: ["SE", "SWEDEN", "SWEDISH"],
  NO: ["NO", "NORWAY", "NORWEGIAN"],
  DK: ["DK", "DENMARK", "DANISH"],
  FI: ["FI", "FINLAND", "FINNISH"],
  PL: ["PL", "POLAND", "POLISH"],
  RU: ["RU", "RUSSIA", "RUSSIAN"],
  TR: ["TR", "TURKEY", "TURKISH"],
  JP: ["JP", "JAPAN", "JAPANESE"],
  KR: ["KR", "KOREA", "KOREAN"],
  CN: ["CN", "CHINA", "CHINESE"],
};

const LANG_TO_TOKENS: Record<string, string[]> = {
  english: ["EN", "ENG", "ENGLISH", "US", "UK", "CA", "AU"],
  spanish: ["ES", "ESP", "SPANISH", "ESPANOL", "LATINO"],
  french: ["FR", "FRA", "FRENCH", "FRANCAIS"],
  german: ["DE", "GER", "GERMAN", "DEUTSCH"],
  italian: ["IT", "ITA", "ITALIAN", "ITALIANO"],
  portuguese: ["PT", "POR", "PORTUGUESE", "BR", "BRAZIL"],
  dutch: ["NL", "DUTCH", "NEDERLANDS"],
  russian: ["RU", "RUS", "RUSSIAN"],
  arabic: ["AR", "ARA", "ARABIC", "ARAB"],
  turkish: ["TR", "TUR", "TURKISH"],
  hindi: ["HI", "HIN", "HINDI", "INDIAN"],
  japanese: ["JA", "JPN", "JAPANESE"],
  korean: ["KO", "KOR", "KOREAN"],
  chinese: ["ZH", "CHI", "CHINESE", "MANDARIN"],
  polish: ["PL", "POL", "POLISH"],
  swedish: ["SV", "SWE", "SWEDISH"],
  norwegian: ["NO", "NOR", "NORWEGIAN"],
  danish: ["DA", "DAN", "DANISH"],
  finnish: ["FI", "FIN", "FINNISH"],
};

const NEUTRAL_PRIORITY_BUMP = new Set(["ENTERTAINMENT", "NEWS", "SPORTS", "MOVIES", "KIDS", "DOCUMENTARY"]);

export function scoreGroupForUser(group: string, region: string, preferredLanguages: string[]): number {
  const tokens = tokenize(group);
  if (tokens.length === 0) return 0;
  const head = tokens[0];
  const regionTokens = REGION_TO_TOKENS[region.toUpperCase()] ?? [];
  if (regionTokens.includes(head)) return 100;
  if (regionTokens.some((t) => tokens.includes(t))) return 80;
  for (let i = 0; i < preferredLanguages.length; i++) {
    const lang = preferredLanguages[i].toLowerCase();
    const langTokens = LANG_TO_TOKENS[lang];
    if (!langTokens) continue;
    if (langTokens.includes(head)) return 60 - i * 5;
    if (langTokens.some((t) => tokens.includes(t))) return 45 - i * 5;
  }
  if (NEUTRAL_PRIORITY_BUMP.has(head)) return 5;
  return 0;
}

export function sortGroupsByRelevance(groups: string[], region: string, preferredLanguages: string[]): string[] {
  return [...groups].sort((a, b) => {
    const sa = scoreGroupForUser(a, region, preferredLanguages);
    const sb = scoreGroupForUser(b, region, preferredLanguages);
    if (sa !== sb) return sb - sa;
    return a.localeCompare(b);
  });
}

export function sortChannelsByGroupRelevance<T extends { group: string | null }>(
  channels: T[],
  region: string,
  preferredLanguages: string[],
): T[] {
  const scoreCache = new Map<string, number>();
  const scoreOf = (group: string | null): number => {
    if (!group) return -1;
    const cached = scoreCache.get(group);
    if (cached !== undefined) return cached;
    const v = scoreGroupForUser(group, region, preferredLanguages);
    scoreCache.set(group, v);
    return v;
  };
  return [...channels].sort((a, b) => {
    const sa = scoreOf(a.group);
    const sb = scoreOf(b.group);
    if (sa !== sb) return sb - sa;
    const ga = a.group ?? "";
    const gb = b.group ?? "";
    if (ga !== gb) return ga.localeCompare(gb);
    return 0;
  });
}

function tokenize(group: string): string[] {
  return group
    .toUpperCase()
    .split(/[\s|/_\-:]+/)
    .map((t) => t.replace(/[^A-Z]/g, ""))
    .filter(Boolean);
}
