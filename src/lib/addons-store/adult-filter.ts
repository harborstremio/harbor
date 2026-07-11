const SUBSTRING_TERMS = [
  "porn",
  "pornhub",
  "pornography",
  "porno",
  "porntv",
  "xhamster",
  "xnxx",
  "xvideos",
  "redtube",
  "youporn",
  "spankbang",
  "brazzers",
  "naughtyamerica",
  "bangbros",
  "realitykings",
  "evilangel",
  "digitalplayground",
  "fakehub",
  "playboy",
  "penthouse",
  "hustler",
  "rule34",
  "rule35",
  "hentai",
  "ahegao",
  "doujin",
  "doujinshi",
  "ecchi",
  "futanari",
  "futa",
  "yiff",
  "lewd",
  "smut",
  "fapping",
  "milf",
  "gilf",
  "dilf",
  "shemale",
  "ladyboy",
  "tranny",
  "femdom",
  "dominatrix",
  "bondage",
  "bdsm",
  "fetish",
  "fetlife",
  "kink",
  "kinky",
  "raunchy",
  "vulgar",
  "obscene",
  "softcore",
  "hardcore",
  "uncensored",
  "explicit",
  "chaturbate",
  "myfreecams",
  "stripchat",
  "bongacams",
  "livejasmin",
  "camsoda",
  "flirt4free",
  "camgirl",
  "camgirls",
  "camboy",
  "camboys",
  "camshow",
  "camshows",
  "webcamshow",
  "webcamshows",
  "onlyfans",
  "fansly",
  "manyvids",
  "clips4sale",
  "iwantclips",
  "modelhub",
  "incall",
  "outcall",
  "blowjob",
  "handjob",
  "footjob",
  "cumshot",
  "creampie",
  "cumming",
  "ejaculation",
  "ejaculate",
  "stripper",
  "stripping",
  "striptease",
  "lapdance",
  "lustful",
  "horny",
  "javhd",
  "thicc",
  "boobs",
  "boobies",
  "titties",
  "nipples",
  "asshole",
  "buttplug",
  "dildo",
  "vibrator",
  "deepthroat",
  "gangbang",
  "threesome",
  "foursome",
  "orgy",
  "orgies",
  "rimjob",
  "scat",
  "watersports",
  "incest",
  "stepmom",
  "stepsis",
  "stepbro",
  "barelylegal",
  "teenporn",
  "milfporn",
  "amateurporn",
];

const WORD_TERMS = [
  "xxx",
  "nsfw",
  "sex",
  "sexy",
  "sexual",
  "erotic",
  "erotica",
  "nude",
  "nudes",
  "nudity",
  "naked",
  "topless",
  "ass",
  "anal",
  "anus",
  "tit",
  "tits",
  "boob",
  "cum",
  "cums",
  "jizz",
  "fuck",
  "fucker",
  "fucking",
  "fucked",
  "pussy",
  "pussies",
  "vagina",
  "vulva",
  "clit",
  "clitoris",
  "dick",
  "cock",
  "cocks",
  "penis",
  "balls",
  "fap",
  "wank",
  "jerk",
  "jerkoff",
  "stroke",
  "edging",
  "milf",
  "horny",
  "kinky",
  "lewd",
  "smut",
  "jav",
  "escort",
  "escorts",
  "slut",
  "sluts",
  "whore",
  "whores",
  "bitch",
  "bitches",
];

const LEET_MAP: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "@": "a",
  $: "s",
  "!": "i",
};

function normalize(s: string): string {
  if (!s) return "";
  let out = s.normalize("NFKD").toLowerCase();
  out = out.replace(/[̀-ͯ]/g, "");
  out = out
    .split("")
    .map((c) => LEET_MAP[c] ?? c)
    .join("");
  out = out.replace(/[^a-z]+/g, "");
  return out;
}

function lowerTokens(s: string): string {
  if (!s) return "";
  let out = s.normalize("NFKD").toLowerCase();
  out = out.replace(/[̀-ͯ]/g, "");
  out = out
    .split("")
    .map((c) => LEET_MAP[c] ?? c)
    .join("");
  out = out.replace(/[^a-z0-9]+/g, " ").trim();
  return ` ${out} `;
}

const WORD_TERMS_RX = new RegExp(`(?:^| )(?:${WORD_TERMS.join("|")})(?:$| )`, "i");

export function isAdultText(...fields: Array<string | undefined | null>): boolean {
  const normalized = fields.map((f) => normalize(f ?? "")).join(" ");
  for (const term of SUBSTRING_TERMS) {
    if (normalized.includes(term)) return true;
  }
  const tokens = fields.map((f) => lowerTokens(f ?? "")).join("");
  if (tokens.length > 0 && WORD_TERMS_RX.test(tokens)) return true;
  return false;
}

export function adultContentHidden(): boolean {
  try {
    const raw = localStorage.getItem("harbor.settings");
    if (!raw) return true;
    const parsed = JSON.parse(raw) as { hideContent?: { adult?: boolean } };
    return parsed.hideContent?.adult !== false;
  } catch {
    return true;
  }
}

const ADULT_ANIME_GENRES = new Set(["hentai", "erotica"]);

export function isAdultAnime(meta: { name?: string; genres?: string[] }): boolean {
  if (meta.genres?.some((g) => ADULT_ANIME_GENRES.has(g.toLowerCase()))) return true;
  return isAdultText(meta.name);
}

export function debugMatchAdult(...fields: Array<string | undefined | null>): string | null {
  const normalized = fields.map((f) => normalize(f ?? "")).join(" ");
  for (const term of SUBSTRING_TERMS) {
    if (normalized.includes(term)) return `substring:${term}`;
  }
  const tokens = fields.map((f) => lowerTokens(f ?? "")).join("");
  if (tokens.length > 0) {
    for (const term of WORD_TERMS) {
      const rx = new RegExp(`(?:^| )${term}(?:$| )`, "i");
      if (rx.test(tokens)) return `word:${term}`;
    }
  }
  return null;
}
