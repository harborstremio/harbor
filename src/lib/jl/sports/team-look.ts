import type { SportsSide } from "../../sports/espn.ts";
import type { TeamArt } from "./fanart.ts";

/**
 * How a team looks on the Sports Hub when there's no photo: its colours, its logo (ESPN's dark
 * variant first, which reads on dark art), and a monogram for teams with no logo at all. Plain
 * module, no I/O; every answer is stable for the same team so cards don't flicker.
 */

export type TeamLook = {
  /** Hex without '#'. */
  primary: string;
  secondary: string;
  /** Logo URLs, best first; the view moves to the next when one fails to load. */
  logos: string[];
  monogram: string;
};

const HEX = /^[0-9a-f]{6}$/i;
const NEUTRAL = new Set(["000000", "ffffff", "111111", "fefefe", "f8f8f8"]);

/** A colour from a name, for teams no source gives a colour (stable, mid-tone). */
export function nameColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  // HSL(hue, 55%, 38%) to hex.
  const s = 0.55;
  const l = 0.38;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + hue / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `${f(0)}${f(8)}${f(4)}`;
}

/** "Iowa State" → "IS", "BYU Cougars" → "BC", "Florida State Seminoles" → "FS". */
export function monogram(name: string): string {
  const words = name
    .replace(/^#\d+\s+/, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^\p{L}\p{N}&' ]/gu, " ")
    .split(/\s+/)
    .filter((w) => w && !/^(of|the|at|and|&|university|college)$/i.test(w));
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** ESPN's dark-background variant of a team logo ("/500/" → "/500-dark/"), when it is one. */
export function espnDarkLogo(logo: string): string | null {
  if (!/^https:\/\/a\.espncdn\.com\/(?:combiner\/i\?img=\/)?i\/teamlogos\//.test(logo)) return null;
  if (!/\/500\//.test(logo)) return null;
  return logo.replace("/500/", "/500-dark/");
}

const valid = (c: string | null | undefined): c is string => !!c && HEX.test(c);

/** Colours and logos for a side, with TheSportsDB's colours and badge filling ESPN's gaps. */
export function teamLook(
  side: Pick<SportsSide, "name" | "logo" | "color" | "altColor">,
  art?: TeamArt | null,
): TeamLook {
  const colors = [side.color, side.altColor, ...(art?.colors ?? [])]
    .filter(valid)
    .map((c) => c.toLowerCase());
  const vivid = colors.filter((c) => !NEUTRAL.has(c));
  const primary = vivid[0] ?? colors[0] ?? nameColor(side.name || "team");
  const secondary =
    vivid.find((c) => c !== primary) ?? colors.find((c) => c !== primary) ?? primary;
  const logos: string[] = [];
  if (side.logo) {
    const dark = espnDarkLogo(side.logo);
    if (dark) logos.push(dark);
    logos.push(side.logo);
  }
  if (art?.badge) logos.push(art.badge);
  return { primary, secondary, logos: [...new Set(logos)], monogram: monogram(side.name) };
}

/**
 * A team's name as a two-line wordmark: school or city on top, nickname below ("OREGON" /
 * "DUCKS"). Without a listed nickname the last word moves to the second line.
 */
export function wordmarkLines(
  side: Pick<SportsSide, "name" | "location" | "nickname">,
): [string, string] {
  const name = side.name.replace(/^#\d+\s+/, "").trim();
  const location = side.location?.trim() ?? "";
  const nickname = side.nickname?.trim() ?? "";
  if (location && nickname) return [location.toUpperCase(), nickname.toUpperCase()];
  if (location && name.toLowerCase().startsWith(`${location.toLowerCase()} `))
    return [location.toUpperCase(), name.slice(location.length + 1).toUpperCase()];
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length < 2) return [(name || location).toUpperCase(), ""];
  return [words.slice(0, -1).join(" ").toUpperCase(), words[words.length - 1].toUpperCase()];
}

function luminance(hex: string): number {
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The colour for a wordmark's second line: the team's brighter colour when it reads on dark
 * art (Oregon's yellow), else null for the theme's accent.
 */
export function wordmarkAccent(look: Pick<TeamLook, "primary" | "secondary">): string | null {
  const candidates = [look.secondary, look.primary].filter(
    (c) => valid(c) && !NEUTRAL.has(c.toLowerCase()),
  );
  return candidates.find((c) => luminance(c) >= 0.28) ?? null;
}
