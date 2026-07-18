const YEAR_RE = /\b(19\d{2}|20\d{2})\b/;
const SE_RE = /\bS(\d{1,2})\s*[._\-\s]?\s*E(\d{1,3})\b/i;
const X_RE = /\b(\d{1,2})x(\d{1,3})\b/;
const NOISE_RE =
  /\b(2160p|1080p|720p|480p|4k|uhd|fhd|hd|sd|hevc|x265|x264|h\.?264|h\.?265|web-?dl|web-?rip|bluray|blu-?ray|bdrip|hdrip|dvdrip|hdtv|multi|dual|multi-?sub|subbed|dubbed|imax|remux|10bit|aac|ac3|eac3|dts|ddp?5\.?1|hdr10?|dolby|atmos|vision)\b/gi;
const BRACKET_RE = /[[(][^\])]*[\])]/g;
const PREFIX_RE = /^\s*(?:[A-Z]{2,4}|[\u{1F1E6}-\u{1F1FF}]{2})\s*[|\-:]\s*/u;

export function parseSeriesEpisode(name: string): { season: number; episode: number } | null {
  const m = name.match(SE_RE) ?? name.match(X_RE);
  if (!m) return null;
  const season = Number(m[1]);
  const episode = Number(m[2]);
  if (!Number.isFinite(season) || !Number.isFinite(episode)) return null;
  return { season, episode };
}

export function extractYear(name: string): number | null {
  const m = name.match(YEAR_RE);
  if (!m) return null;
  const year = Number(m[1]);
  return year >= 1900 && year <= 2099 ? year : null;
}

export function cleanTitle(name: string): string {
  let s = name;
  s = s.replace(PREFIX_RE, "");
  s = s.replace(BRACKET_RE, " ");
  s = s.replace(SE_RE, " ").replace(X_RE, " ");
  s = s.replace(YEAR_RE, " ");
  s = s.replace(NOISE_RE, " ");
  s = s.replace(/[._]+/g, " ");
  s = s.replace(/\s{2,}/g, " ").trim();
  s = s.replace(/[-|:]+\s*$/, "").trim();
  return s || name.trim();
}

const EP_WORD_RE = /\s*[-|:]?\s*\b(?:episode|ep|part|pt)\b\s*\.?\s*\d{1,3}\s*$/i;
const LAST_DELIM_RE = /^(.*\S)\s+[-|:]\s+\S.*$/;

export function showTitleFromEpisode(name: string): string {
  const seIdx = name.search(SE_RE);
  const xIdx = name.search(X_RE);
  let cut = -1;
  if (seIdx >= 0) cut = seIdx;
  else if (xIdx >= 0) cut = xIdx;
  if (cut >= 0) return cleanTitle(name.slice(0, cut));
  const stripped = name.replace(EP_WORD_RE, "").trim();
  if (stripped && stripped !== name.trim()) return cleanTitle(stripped);
  const m = name.match(LAST_DELIM_RE);
  if (m && m[1].trim()) return cleanTitle(m[1]);
  return cleanTitle(name);
}
