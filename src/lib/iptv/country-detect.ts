import type { IptvChannel } from "./types";

export type Country = { code: string; name: string; short: string };

const NAME: Record<string, string> = {
  US: "United States",
  GB: "United Kingdom",
  CA: "Canada",
  AU: "Australia",
  IE: "Ireland",
  NZ: "New Zealand",
  FR: "France",
  DE: "Germany",
  ES: "Spain",
  IT: "Italy",
  PT: "Portugal",
  NL: "Netherlands",
  BE: "Belgium",
  CH: "Switzerland",
  AT: "Austria",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  PL: "Poland",
  CZ: "Czechia",
  SK: "Slovakia",
  HU: "Hungary",
  RO: "Romania",
  BG: "Bulgaria",
  GR: "Greece",
  TR: "Turkey",
  RU: "Russia",
  UA: "Ukraine",
  RS: "Serbia",
  HR: "Croatia",
  BR: "Brazil",
  MX: "Mexico",
  AR: "Argentina",
  CO: "Colombia",
  CL: "Chile",
  PE: "Peru",
  VE: "Venezuela",
  IN: "India",
  PK: "Pakistan",
  BD: "Bangladesh",
  PH: "Philippines",
  ID: "Indonesia",
  MY: "Malaysia",
  TH: "Thailand",
  VN: "Vietnam",
  CN: "China",
  JP: "Japan",
  KR: "South Korea",
  SA: "Saudi Arabia",
  AE: "UAE",
  EG: "Egypt",
  MA: "Morocco",
  IL: "Israel",
  ZA: "South Africa",
  NG: "Nigeria",
  DZ: "Algeria",
  LATINO: "Latino",
  EXYU: "Ex-Yugoslavia",
  ARABIC: "Arabic",
  NORDIC: "Nordic",
  AFRICA: "Africa",
};

const SHORT: Record<string, string> = {
  GB: "UK",
  LATINO: "LAT",
  EXYU: "YU",
  ARABIC: "ARB",
  NORDIC: "NOR",
  AFRICA: "AFR",
};

const ALIAS: Record<string, string> = {
  US: "US",
  USA: "US",
  UNITEDSTATES: "US",
  AMERICA: "US",
  AMERICAN: "US",
  UK: "GB",
  GB: "GB",
  UNITEDKINGDOM: "GB",
  ENGLAND: "GB",
  BRITAIN: "GB",
  BRITISH: "GB",
  CA: "CA",
  CAN: "CA",
  CANADA: "CA",
  CANADIAN: "CA",
  AU: "AU",
  AUS: "AU",
  AUSTRALIA: "AU",
  IE: "IE",
  IRELAND: "IE",
  IRISH: "IE",
  NZ: "NZ",
  NEWZEALAND: "NZ",
  FR: "FR",
  FRA: "FR",
  FRANCE: "FR",
  FRENCH: "FR",
  DE: "DE",
  GER: "DE",
  DEU: "DE",
  GERMANY: "DE",
  GERMAN: "DE",
  DEUTSCHLAND: "DE",
  ES: "ES",
  ESP: "ES",
  SPAIN: "ES",
  SPANISH: "ES",
  ESPANA: "ES",
  IT: "IT",
  ITA: "IT",
  ITALY: "IT",
  ITALIAN: "IT",
  ITALIA: "IT",
  PT: "PT",
  POR: "PT",
  PORTUGAL: "PT",
  PORTUGUESE: "PT",
  NL: "NL",
  NED: "NL",
  NETHERLANDS: "NL",
  DUTCH: "NL",
  HOLLAND: "NL",
  BE: "BE",
  BELGIUM: "BE",
  BELGIE: "BE",
  BELGIQUE: "BE",
  CH: "CH",
  SWISS: "CH",
  SWITZERLAND: "CH",
  AT: "AT",
  AUSTRIA: "AT",
  OSTERREICH: "AT",
  SE: "SE",
  SWE: "SE",
  SWEDEN: "SE",
  SWEDISH: "SE",
  NO: "NO",
  NOR: "NO",
  NORWAY: "NO",
  NORWEGIAN: "NO",
  DK: "DK",
  DEN: "DK",
  DENMARK: "DK",
  DANISH: "DK",
  FI: "FI",
  FIN: "FI",
  FINLAND: "FI",
  PL: "PL",
  POL: "PL",
  POLAND: "PL",
  POLISH: "PL",
  POLSKA: "PL",
  CZ: "CZ",
  CZECH: "CZ",
  CESKO: "CZ",
  SK: "SK",
  SLOVAKIA: "SK",
  HU: "HU",
  HUN: "HU",
  HUNGARY: "HU",
  RO: "RO",
  ROM: "RO",
  ROMANIA: "RO",
  ROMANIAN: "RO",
  BG: "BG",
  BULGARIA: "BG",
  GR: "GR",
  GRE: "GR",
  GREECE: "GR",
  GREEK: "GR",
  HELLAS: "GR",
  TR: "TR",
  TUR: "TR",
  TURKEY: "TR",
  TURKISH: "TR",
  TURKIYE: "TR",
  RU: "RU",
  RUS: "RU",
  RUSSIA: "RU",
  RUSSIAN: "RU",
  UA: "UA",
  UKR: "UA",
  UKRAINE: "UA",
  RS: "RS",
  SERBIA: "RS",
  SRBIJA: "RS",
  HR: "HR",
  CROATIA: "HR",
  HRVATSKA: "HR",
  BR: "BR",
  BRA: "BR",
  BRAZIL: "BR",
  BRASIL: "BR",
  BRAZILIAN: "BR",
  MX: "MX",
  MEX: "MX",
  MEXICO: "MX",
  MEXICAN: "MX",
  ARG: "AR",
  ARGENTINA: "AR",
  CO: "CO",
  COL: "CO",
  COLOMBIA: "CO",
  CL: "CL",
  CHILE: "CL",
  PE: "PE",
  PERU: "PE",
  VE: "VE",
  VENEZUELA: "VE",
  IN: "IN",
  IND: "IN",
  INDIA: "IN",
  INDIAN: "IN",
  HINDI: "IN",
  PK: "PK",
  PAK: "PK",
  PAKISTAN: "PK",
  BD: "BD",
  BANGLADESH: "BD",
  BANGLA: "BD",
  PH: "PH",
  PHIL: "PH",
  PHILIPPINES: "PH",
  FILIPINO: "PH",
  ID: "ID",
  INDONESIA: "ID",
  MY: "MY",
  MALAYSIA: "MY",
  TH: "TH",
  THAILAND: "TH",
  VN: "VN",
  VIETNAM: "VN",
  CN: "CN",
  CHINA: "CN",
  CHINESE: "CN",
  JP: "JP",
  JAPAN: "JP",
  JAPANESE: "JP",
  KR: "KR",
  KOREA: "KR",
  KOREAN: "KR",
  SOUTHKOREA: "KR",
  SA: "SA",
  KSA: "SA",
  SAUDI: "SA",
  SAUDIARABIA: "SA",
  AE: "AE",
  UAE: "AE",
  EMIRATES: "AE",
  DUBAI: "AE",
  EG: "EG",
  EGYPT: "EG",
  DZ: "DZ",
  ALGERIA: "DZ",
  ALGERIE: "DZ",
  ALGERIAN: "DZ",
  MA: "MA",
  MOROCCO: "MA",
  MAROC: "MA",
  IL: "IL",
  ISRAEL: "IL",
  ZA: "ZA",
  SOUTHAFRICA: "ZA",
  NG: "NG",
  NIGERIA: "NG",
  LATINO: "LATINO",
  LATIN: "LATINO",
  LATAM: "LATINO",
  EXYU: "EXYU",
  YU: "EXYU",
  YUGO: "EXYU",
  YUGOSLAVIA: "EXYU",
  BALKAN: "EXYU",
  BALKANS: "EXYU",
  AR: "ARABIC",
  ARABIC: "ARABIC",
  ARAB: "ARABIC",
  ARABIA: "ARABIC",
  NORDIC: "NORDIC",
  SCANDINAVIA: "NORDIC",
  SCANDINAVIAN: "NORDIC",
  AFRICA: "AFRICA",
  AFRICAN: "AFRICA",
};

const SEP = /[|/:►▶▷»>[\]{}()]+/;

function lookup(raw: string): string | null {
  const k = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!k) return null;
  return ALIAS[k] ?? null;
}

function flagToCode(s: string): string | null {
  const letters: string[] = [];
  for (const ch of [...s].slice(0, 4)) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0x1f1e6 && cp <= 0x1f1ff) letters.push(String.fromCharCode(65 + (cp - 0x1f1e6)));
  }
  if (letters.length >= 2) return ALIAS[letters.slice(0, 2).join("")] ?? null;
  return null;
}

function mk(code: string): Country {
  return { code, name: NAME[code] ?? code, short: SHORT[code] ?? code };
}

export function flagUrl(code: string): string | null {
  return /^[A-Z]{2}$/.test(code) ? `https://flagcdn.com/w40/${code.toLowerCase()}.png` : null;
}

export function detectCountryFromGroup(group: string | null | undefined): Country | null {
  if (!group) return null;
  const fc = flagToCode(group);
  if (fc) return mk(fc);
  const segs = group
    .split(SEP)
    .map((s) => s.trim())
    .filter(Boolean);
  const cands: string[] = [];
  if (segs[0]) {
    cands.push(segs[0]);
    cands.push(segs[0].split(/\s+/)[0]);
  }
  const firstWord = group.trim().split(/\s+/)[0];
  if (firstWord) cands.push(firstWord);
  for (const c of cands) {
    const code = lookup(c);
    if (code) return mk(code);
  }
  return null;
}

export function detectCountry(ch: IptvChannel): Country | null {
  const fromGroup = detectCountryFromGroup(ch.group);
  if (fromGroup) return fromGroup;
  const tvg = ch.attrs["tvg-country"];
  if (tvg) {
    const code = lookup(tvg.split(/[;,\s]/)[0] ?? "");
    if (code) return mk(code);
  }
  return null;
}

export function stripCountryPrefix(group: string): string {
  const idx = group.search(SEP);
  if (idx >= 0) {
    const head = group.slice(0, idx);
    if (lookup(head) || flagToCode(head)) {
      const rest = group
        .slice(idx + 1)
        .replace(/^[\s|/:►▶▷»>\-–—]+/, "")
        .trim();
      return rest || group.trim();
    }
  }
  const m = group.trim().match(/^(\S+)\s+(.+)$/);
  if (m && lookup(m[1])) return m[2].trim();
  return group.trim();
}

export function indexChannelsByCountry(channels: IptvChannel[]): {
  channelsByCountry: Map<string, IptvChannel[]>;
  countries: Array<Country & { count: number }>;
} {
  const groupCache = new Map<string, Country | null>();
  const channelsByCountry = new Map<string, IptvChannel[]>();
  const meta = new Map<string, Country>();
  for (const ch of channels) {
    const gk = ch.group ?? "";
    let c = groupCache.get(gk);
    if (c === undefined) {
      c = detectCountryFromGroup(ch.group);
      groupCache.set(gk, c);
    }
    if (!c) c = detectCountry(ch);
    if (!c) continue;
    meta.set(c.code, c);
    const arr = channelsByCountry.get(c.code);
    if (arr) arr.push(ch);
    else channelsByCountry.set(c.code, [ch]);
  }
  const countries = [...channelsByCountry.entries()]
    .map(([code, arr]) => ({ ...(meta.get(code) as Country), count: arr.length }))
    .sort((a, b) => b.count - a.count);
  return { channelsByCountry, countries };
}
