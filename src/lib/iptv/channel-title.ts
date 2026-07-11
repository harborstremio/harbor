const COUNTRY_PREFIXES = [
  "US",
  "USA",
  "UK",
  "GB",
  "CA",
  "AU",
  "NZ",
  "IE",
  "FR",
  "DE",
  "IT",
  "ES",
  "PT",
  "BR",
  "MX",
  "NL",
  "SE",
  "NO",
  "DK",
  "FI",
  "PL",
  "RU",
  "TR",
  "JP",
  "KR",
  "CN",
  "IN",
  "AR",
  "EN",
  "AM",
  "EU",
  "LATAM",
  "LATINO",
];

const QUALITY_TOKENS = ["HD", "FHD", "UHD", "4K", "SD", "HEVC", "265", "264", "1080", "720"];

const NOISE_WORDS = new Set([
  "TV",
  "NETWORK",
  "CHANNEL",
  "STREAM",
  "LIVE",
  "PPV",
  "VIP",
  "BACKUP",
  "PRIMARY",
  "MAIN",
  "ALT",
  "GOLD",
  "PLUS",
  "PREMIUM",
  "FREE",
]);

const SKIP_HYDRATION_TOKENS = [
  "NEWS",
  "SPORT",
  "SPORTS",
  "WEATHER",
  "RADIO",
  "MUSIC",
  "EVENT",
  "EVENTS",
  "MATCH",
  "GAME",
  "LIVE",
];

export type ExtractedTitle = {
  raw: string;
  query: string | null;
  preferType: "movie" | "series" | null;
};

export function extractTitleFromChannelName(name: string): ExtractedTitle {
  const raw = name.trim();
  let working = raw;
  const lastPipe = working.lastIndexOf("|");
  if (lastPipe > 0 && lastPipe < working.length - 1) {
    working = working.slice(lastPipe + 1).trim();
  }
  const lastDash = working.lastIndexOf(" - ");
  if (lastDash > 0 && lastDash < working.length - 3) {
    const after = working.slice(lastDash + 3).trim();
    if (after.length >= 3) working = after;
  }
  const seasonEpRe = /\bS\d{1,3}E\d{1,3}\b/i;
  const isEpisodic = seasonEpRe.test(working);
  working = working.replace(seasonEpRe, "").trim();
  working = working.replace(/\bS\d{1,3}\b/i, "").trim();
  working = working.replace(/\b(\d{2,4}p)\b/gi, "").trim();
  working = working.replace(/\b24\/7\b/gi, "").trim();
  for (const q of QUALITY_TOKENS) {
    const re = new RegExp(`\\b${q}\\b`, "gi");
    working = working.replace(re, "").trim();
  }
  for (const prefix of COUNTRY_PREFIXES) {
    const re = new RegExp(`^${prefix}\\s*[:\\-|]\\s*`, "i");
    working = working.replace(re, "").trim();
  }
  working = working.replace(/[#*_~`<>]+/g, " ").trim();
  working = working.replace(/\s+/g, " ").trim();
  const lowerWords = working.toLowerCase().split(/\s+/);
  const meaningfulWords = lowerWords.filter((w) => !NOISE_WORDS.has(w.toUpperCase()));
  const cleaned = meaningfulWords.join(" ").trim();
  if (!cleaned || cleaned.length < 3) {
    return { raw, query: null, preferType: null };
  }
  const upper = raw.toUpperCase();
  for (const skip of SKIP_HYDRATION_TOKENS) {
    if (upper.includes(skip)) {
      return { raw, query: null, preferType: null };
    }
  }
  return {
    raw,
    query: cleaned,
    preferType: isEpisodic ? "series" : null,
  };
}
