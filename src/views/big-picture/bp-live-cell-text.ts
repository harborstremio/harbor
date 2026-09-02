import { stripCountryPrefix } from "@/lib/iptv/country-detect";

const LEAD_DECOR = /^[#*=~_|.\-\s]{2,}/;
const TRAIL_DECOR = /[#*=~_|.\-\s]{2,}$/;
const COUNTRY_PREFIX = /^[A-Z]{2,6}\s*[|:-]\s*/;
const ROUND_CLOCK = /\b24\s*[/x]\s*7\b/gi;
const FRAMERATE = /\b\d{2,3}\s*fps\b/gi;
const QUALITY = /\b(?:RAW|FHD|UHD|HD|SD|4K|H265|HEVC)\b/gi;
const SLASH = /\s*\/\s*/g;
const SPACES = /\s+/g;
const LETTER = /[A-Za-z]/g;
const NON_KEY = /[^a-z0-9]/g;

// Deviation from the written pipeline, recorded on purpose. Removing "24/7"
// from "24/7: ALIAS" leaves ": ALIAS", and three of the four cards in the
// reference screenshot are shaped exactly like that. Step 1 already strips
// decorative edges and step 4 already re-trims, so a clean edge after the
// removals is the stated intent; ":" and "," were simply not in the class.
const ORPHAN_EDGE = /^[#*=~_|.:;,/\\\s-]+|[#*=~_|.:;,/\\\s-]+$/g;

function key(s: string): string {
  return s.toLowerCase().replace(NON_KEY, "");
}

function letterCount(s: string): number {
  return (s.match(LETTER) ?? []).length;
}

function isAllCaps(s: string): boolean {
  return /[A-Z]/.test(s) && s === s.toUpperCase();
}

// The four letter floor is the whole point: ESPN and TNT are network marks, and
// title casing them turns a mark nobody has to read into a word everybody does.
function titleCase(s: string): string {
  return s
    .split(" ")
    .map((w) => (letterCount(w) > 4 ? w.charAt(0) + w.slice(1).toLowerCase() : w))
    .join(" ");
}

function clean(raw: string): string {
  let s = raw.trim().replace(LEAD_DECOR, "").replace(TRAIL_DECOR, "");
  s = s.replace(COUNTRY_PREFIX, "");
  s = s.replace(ROUND_CLOCK, "").replace(FRAMERATE, "").replace(QUALITY, "");
  s = s.replace(SLASH, " / ").replace(SPACES, " ").trim();
  s = s.replace(ORPHAN_EDGE, "");
  if (isAllCaps(s) && letterCount(s) > 4) s = titleCase(s);
  return s;
}

export function bpCleanChannelName(name: string): string {
  return clean(name) || name.trim();
}

export function bpCleanGroup(group: string | null | undefined): string {
  if (!group) return "";
  return clean(stripCountryPrefix(group));
}

export function bpSameText(a: string, b: string): boolean {
  return key(a) === key(b);
}
