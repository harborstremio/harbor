import { AWARD_ICON_REGISTRY, keyForFilename } from "@/lib/award-icons";
import { ALL_BADGE_KINDS, badgeLabel, defaultBadgeSrc, type BadgeKind } from "@/components/format-badge";

export type BundleKind = "badge" | "award";
export type IconKey = { key: string; label: string };
export type IconGroup = { title: string; items: IconKey[] };

export const MAX_ICONS = 100;

function titleize(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const AWARD_GROUPS: IconGroup[] = AWARD_ICON_REGISTRY.map((g) => ({
  title: g.title,
  items: g.items.map((it) => ({ key: it.key, label: it.label })),
}));

const BADGE_GROUP_DEFS: Array<{ title: string; kinds: BadgeKind[] }> = [
  { title: "Resolution", kinds: ["8k", "4k-uhd", "uhd", "2k-qhd", "1080p", "1080i", "720p", "576p", "480p", "360p", "hd", "sd"] },
  { title: "Source", kinds: ["remux", "bluray", "webdl", "webrip", "hdtv", "dvb", "dvd", "3d", "imax", "cam", "hdcam", "telesync", "hdts", "telecine", "scr", "wp"] },
  { title: "HDR", kinds: ["dv", "hdr10-plus", "hdr10", "hdr", "hlg", "sdr"] },
  { title: "Codec", kinds: ["hevc", "av1"] },
  { title: "Audio", kinds: ["atmos", "atmos-912", "truehd", "dts-hd-ma", "dts-hd", "dts-x", "dts", "ddp", "dd", "eac3", "ac3", "aac", "flac", "mp3", "opus", "pcm", "lpcm", "stereo", "mono", "5.1", "7.1"] },
  { title: "Flags", kinds: ["extended", "remastered", "repack", "no-label", "unknown"] },
];

const BADGE_GROUPS: IconGroup[] = BADGE_GROUP_DEFS.map((g) => ({
  title: g.title,
  items: g.kinds.map((k) => ({ key: k, label: badgeLabel(k) })),
}));

const AWARD_KEYS: IconKey[] = AWARD_GROUPS.flatMap((g) => g.items);
const BADGE_KEYS: IconKey[] = BADGE_GROUPS.flatMap((g) => g.items);
const BADGE_ART = new Set<string>(ALL_BADGE_KINDS);

const BADGE_NORM = new Map<string, string>();
for (const k of ALL_BADGE_KINDS) BADGE_NORM.set(k.replace(/[^a-z0-9]/g, ""), k);

const BADGE_ALIASES: Record<string, string> = {
  "4k": "4k-uhd",
  "2160p": "4k-uhd",
  fhd: "1080p",
  fullhd: "1080p",
  dolbyvision: "dv",
  dovi: "dv",
  hdr10plus: "hdr10-plus",
  dolbyatmos: "atmos",
  dtshdma: "dts-hd-ma",
  dtsx: "dts-x",
  dolbydigital: "dd",
  dolbydigitalplus: "ddp",
};

function normKind(base: string): string {
  return base.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function iconKeysFor(kind: BundleKind): IconKey[] {
  return kind === "award" ? AWARD_KEYS : BADGE_KEYS;
}

export function iconGroupsFor(kind: BundleKind): IconGroup[] {
  return kind === "award" ? AWARD_GROUPS : BADGE_GROUPS;
}

export function defaultArtFor(kind: BundleKind, key: string): string | undefined {
  return kind === "badge" && BADGE_ART.has(key) ? defaultBadgeSrc(key as BadgeKind) : undefined;
}

export function labelForKey(kind: BundleKind, key: string): string {
  const found = iconKeysFor(kind).find((k) => k.key === key);
  return found ? found.label : titleize(key);
}

export function autoMatchKey(kind: BundleKind, filename: string): string | undefined {
  const base = filename.replace(/\.[^.]+$/, "");
  if (kind === "award") return keyForFilename(base);
  const n = normKind(base);
  return BADGE_NORM.get(n) ?? BADGE_ALIASES[n];
}

export function normalizeCustomKey(s: string): string | null {
  const k = s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return /^[a-z0-9_-]{1,40}$/.test(k) ? k : null;
}
