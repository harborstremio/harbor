import { useSyncExternalStore } from "react";
import { setItemWithRecovery } from "@/lib/storage-recovery";
import type { BadgeKind } from "@/components/format-badge";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";

const KEY = "harbor.streamBadges.v1";

export type BadgeOverride = { image?: string; hidden?: boolean };

export type BadgeTagStyle = "filled" | "outlined" | "bordered" | "filled and bordered";

export type CustomBadgeRule = {
  id: string;
  name: string;
  pattern: string;
  enabled: boolean;
  image?: string;
  tagColor?: string;
  textColor?: string;
  borderColor?: string;
  tagStyle?: BadgeTagStyle;
};

export type StreamBadgeState = {
  overrides: Partial<Record<BadgeKind, BadgeOverride>>;
  rules: CustomBadgeRule[];
};

function read(): StreamBadgeState {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as StreamBadgeState) : null;
    return {
      overrides: parsed?.overrides ?? {},
      rules: Array.isArray(parsed?.rules) ? parsed.rules : [],
    };
  } catch {
    return { overrides: {}, rules: [] };
  }
}

let state: StreamBadgeState = read();
const subs = new Set<() => void>();

function emit() {
  for (const s of subs) s();
}

function persist() {
  setItemWithRecovery(KEY, JSON.stringify(state));
}

function subscribe(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

export function badgeState(): StreamBadgeState {
  return state;
}

export function useBadgeState(): StreamBadgeState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

export function useBadgeOverride(kind: BadgeKind): BadgeOverride | undefined {
  return useSyncExternalStore(
    subscribe,
    () => state.overrides[kind],
    () => undefined,
  );
}

export function setBadgeOverride(kind: BadgeKind, override: BadgeOverride | null): void {
  const overrides = { ...state.overrides };
  if (override && (override.image || override.hidden)) overrides[kind] = override;
  else delete overrides[kind];
  state = { ...state, overrides };
  persist();
  emit();
}

export function setBadgeRules(rules: CustomBadgeRule[]): void {
  state = { ...state, rules };
  persist();
  emit();
}

export function resetAllBadges(): void {
  state = { overrides: {}, rules: [] };
  persist();
  emit();
}

const regexCache = new Map<string, RegExp | null>();

export function compileBadgePattern(pattern: string): RegExp | null {
  const cached = regexCache.get(pattern);
  if (cached !== undefined) return cached;
  let flags = "i";
  const cleaned = pattern
    .replace(/\(\?-?([a-zA-Z]+)\)/g, (_, f: string) => {
      if (f.includes("s") && !flags.includes("s")) flags += "s";
      if (f.includes("m") && !flags.includes("m")) flags += "m";
      return "";
    })
    .replace(/\(\?-?[a-zA-Z]+:/g, "(?:");
  const attempts = [
    [cleaned, flags],
    [cleaned, `${flags}u`],
    [cleaned.replace(/([*+?}])\+/g, "$1"), flags],
  ] as const;
  let out: RegExp | null = null;
  for (const [src, fl] of attempts) {
    try {
      out = new RegExp(src, fl);
      break;
    } catch {
      out = null;
    }
  }
  regexCache.set(pattern, out);
  return out;
}

export function ruleTextForStream(s: {
  name?: string | null;
  title?: string | null;
  description?: string | null;
  behaviorHints?: { filename?: string; fileName?: string } | null;
}): string {
  return [s.name, s.title, s.description, s.behaviorHints?.filename ?? s.behaviorHints?.fileName]
    .filter(Boolean)
    .join(" ");
}

export function matchRules(text: string): CustomBadgeRule[] {
  if (!text || state.rules.length === 0) return [];
  const out: CustomBadgeRule[] = [];
  for (const r of state.rules) {
    if (!r.enabled) continue;
    const re = compileBadgePattern(r.pattern);
    if (re?.test(text)) {
      out.push(r);
      if (out.length >= 6) break;
    }
  }
  return out;
}

export function useMatchedRules(text: string): CustomBadgeRule[] {
  const st = useBadgeState();
  void st;
  return matchRules(text);
}

export function cssColor(c: string | undefined): string | undefined {
  if (!c) return undefined;
  const hex = c.trim();
  const m = /^#([0-9a-fA-F]{8})$/.exec(hex);
  if (m) {
    const aa = m[1].slice(0, 2);
    const rrggbb = m[1].slice(2);
    return `#${rrggbb}${aa}`;
  }
  return hex;
}

const KIND_ALIASES: Record<string, BadgeKind> = {
  "8k": "8k",
  "4k": "4k-uhd",
  "2160p": "4k-uhd",
  uhd: "uhd",
  "2k": "2k-qhd",
  "1440p": "2k-qhd",
  "1080p": "1080p",
  fhd: "1080p",
  "1080i": "1080i",
  "720p": "720p",
  "576p": "576p",
  "480p": "480p",
  "360p": "360p",
  hd: "hd",
  sd: "sd",
  dvd: "dvd",
  "3d": "3d",
  imax: "imax",
  "imax enhanced": "imax",
  bluray: "bluray",
  "blu ray": "bluray",
  "blu-ray": "bluray",
  remux: "remux",
  "web dl": "webdl",
  "web-dl": "webdl",
  webdl: "webdl",
  web: "webdl",
  webrip: "webrip",
  hdtv: "hdtv",
  hevc: "hevc",
  x265: "hevc",
  h265: "hevc",
  av1: "av1",
  hdr: "hdr",
  hdr10: "hdr10",
  "hdr10+": "hdr10-plus",
  hdr10plus: "hdr10-plus",
  dv: "dv",
  "dolby vision": "dv",
  hlg: "hlg",
  sdr: "sdr",
  atmos: "atmos",
  "dolby atmos": "atmos",
  truehd: "truehd",
  "true hd": "truehd",
  "dts hd ma": "dts-hd-ma",
  "dts-hd ma": "dts-hd-ma",
  "dts hd": "dts-hd",
  "dts-hd": "dts-hd",
  "dts x": "dts-x",
  "dts:x": "dts-x",
  dtsx: "dts-x",
  dts: "dts",
  "dd+": "ddp",
  ddp: "ddp",
  eac3: "eac3",
  "e-ac3": "eac3",
  dd: "dd",
  "dolby digital": "dd",
  ac3: "ac3",
  aac: "aac",
  flac: "flac",
  mp3: "mp3",
  opus: "opus",
  pcm: "pcm",
  lpcm: "lpcm",
  stereo: "stereo",
  mono: "mono",
  "51": "5.1",
  "5.1": "5.1",
  "71": "7.1",
  "7.1": "7.1",
  cam: "cam",
  hdcam: "hdcam",
  telesync: "telesync",
  ts: "telesync",
  telecine: "telecine",
  screener: "scr",
  scr: "scr",
  workprint: "wp",
  extended: "extended",
  remastered: "remastered",
  repack: "repack",
  dvb: "dvb",
  hdts: "hdts",
  "hd ts": "hdts",
  "hd-ts": "hdts",
  "atmos 9.1.2": "atmos-912",
  "dolby atmos 9.1.2": "atmos-912",
  "9.1.2": "atmos-912",
  atmos912: "atmos-912",
  "no label": "no-label",
  "no quality label": "no-label",
  unknown: "unknown",
  "quality unverified": "unknown",
  unverified: "unknown",
};

export function aliasFor(name: string): BadgeKind | null {
  const norm = name
    .trim()
    .toLowerCase()
    .replace(/[^\w+.:\s-]/g, "")
    .trim();
  return KIND_ALIASES[norm] ?? null;
}

type NuvioFilter = {
  id?: string;
  name?: string;
  pattern?: string;
  isEnabled?: boolean;
  imageURL?: string;
  tagColor?: string;
  textColor?: string;
  borderColor?: string;
  tagStyle?: string;
};

export type BadgeImportResult = { remapped: number; rules: number; skipped: number };

export function importBadgesJson(json: unknown): BadgeImportResult {
  const result: BadgeImportResult = { remapped: 0, rules: 0, skipped: 0 };
  const data = json as {
    filters?: NuvioFilter[];
    overrides?: Partial<Record<BadgeKind, BadgeOverride>>;
    rules?: CustomBadgeRule[];
  };

  if (data && (data.overrides || (Array.isArray(data.rules) && !data.filters))) {
    const overrides = { ...state.overrides, ...(data.overrides ?? {}) };
    const incoming = Array.isArray(data.rules) ? data.rules : [];
    const keep = state.rules.filter((r) => !incoming.some((n) => n.id === r.id));
    state = { overrides, rules: [...keep, ...incoming] };
    persist();
    emit();
    result.remapped = Object.keys(data.overrides ?? {}).length;
    result.rules = incoming.length;
    return result;
  }

  if (!data || !Array.isArray(data.filters)) {
    result.skipped = 1;
    return result;
  }

  const overrides = { ...state.overrides };
  const newRules: CustomBadgeRule[] = [];
  const superseded = new Set<string>();
  for (const f of data.filters) {
    if (!f || f.isEnabled === false) {
      result.skipped++;
      continue;
    }
    const kind = f.name ? aliasFor(f.name) : null;
    if (kind && f.imageURL) {
      overrides[kind] = { image: f.imageURL };
      superseded.add(`nuvio-${f.id ?? f.name}`);
      result.remapped++;
      continue;
    }
    if (f.pattern && f.name) {
      const style = ["filled", "outlined", "bordered", "filled and bordered"].includes(
        f.tagStyle ?? "",
      )
        ? (f.tagStyle as BadgeTagStyle)
        : "filled";
      newRules.push({
        id: `nuvio-${f.id ?? f.name}`,
        name: f.name,
        pattern: f.pattern,
        enabled: true,
        image: f.imageURL,
        tagColor: f.tagColor,
        textColor: f.textColor,
        borderColor: f.borderColor,
        tagStyle: style,
      });
      result.rules++;
      continue;
    }
    result.skipped++;
  }
  const keep = state.rules.filter(
    (r) => !newRules.some((n) => n.id === r.id) && !superseded.has(r.id),
  );
  state = { overrides, rules: [...keep, ...newRules] };
  persist();
  emit();
  return result;
}

export function parsePackText(raw: string): unknown {
  const src = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  try {
    return JSON.parse(src);
  } catch {
    /* fall through to repair */
  }
  let out = "";
  let inStr = false;
  let escaped = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const code = src.charCodeAt(i);
    if (inStr) {
      if (escaped) {
        escaped = false;
        out += ch;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        out += ch;
        continue;
      }
      if (ch === '"') {
        inStr = false;
        out += ch;
        continue;
      }
      if (code < 0x20) {
        if (code === 10) out += "\\n";
        else if (code === 9) out += "\\t";
        else if (code === 13) out += "\\r";
        continue;
      }
      out += ch;
      continue;
    }
    if (ch === '"') inStr = true;
    out += ch;
  }
  try {
    return JSON.parse(out);
  } catch {
    /* one more pass: missing commas between a value and the next quoted key */
  }
  const commaFixed = out.replace(
    /("(?:[^"\\]|\\.)*"|true|false|null|-?\d(?:[\d.eE+-])*)(\s*\n\s*)"/g,
    '$1,$2"',
  );
  return JSON.parse(commaFixed);
}

export function exportBadgesJson(): string {
  return JSON.stringify(
    { app: "harbor", version: 1, overrides: state.overrides, rules: state.rules },
    null,
    2,
  );
}

export function applyArtPack(art: Partial<Record<BadgeKind, string>>): number {
  const overrides = { ...state.overrides };
  let n = 0;
  for (const [kind, image] of Object.entries(art)) {
    if (!image) continue;
    overrides[kind as BadgeKind] = { image };
    n++;
  }
  state = { ...state, overrides };
  persist();
  emit();
  return n;
}

const BF = "https://raw.githubusercontent.com/9mousaa/BetterFormatter/main/images";
const BF_SHARED: Partial<Record<BadgeKind, string>> = {
  "4k-uhd": `${BF}/4k.png`,
  "1080p": `${BF}/1080p.png`,
  "720p": `${BF}/720p.png`,
  "5.1": `${BF}/5dot1.png`,
  "7.1": `${BF}/7dot1.png`,
  hdr: `${BF}/HDR.png`,
  hdr10: `${BF}/HDR10.png`,
  "hdr10-plus": `${BF}/HDR10Plus.png`,
  imax: `${BF}/IMAX.png`,
  atmos: `${BF}/atmos.png`,
  dts: `${BF}/dts.png`,
  "dts-hd": `${BF}/dtshd.png`,
  "dts-hd-ma": `${BF}/dtshdma.png`,
  "dts-x": `${BF}/dtsx.png`,
  dd: `${BF}/digital.png`,
  ddp: `${BF}/digitalplus.png`,
  truehd: `${BF}/truehd.png`,
  dv: `${BF}/vision.png`,
};

export type CommunityPack = {
  id: string;
  name: string;
  author: string;
  description: string;
  count: string;
  previews: string[];
} & ({ kind: "nuvio"; url: string } | { kind: "art"; art: Partial<Record<BadgeKind, string>> });

const ELITE = "https://raw.githubusercontent.com/leonevz/Elite-Badges/main/Badges";
const NSVG =
  "https://raw.githubusercontent.com/dwivedisankalp97/nuvio-svg-badges/main/dist/v17/svg";
const NARD = "https://raw.githubusercontent.com/vowl313/NardBadges/refs/heads/main";
const MINIMAL = `${HARBOR_API_BASE}/badges/minimal`;
const ABSTRACT = `${HARBOR_API_BASE}/badges/abstract`;
const HARBORLIGHT = `${HARBOR_API_BASE}/badges/harbor-light`;
const HARBORCOLOR = `${HARBOR_API_BASE}/badges/harbor-color`;

export const COMMUNITY_PACKS: CommunityPack[] = [
  {
    id: "minimal",
    kind: "nuvio",
    name: "Minimal",
    author: "Harbor",
    description: "Clean minimal icons for common tags",
    count: "101 badges",
    previews: [
      `${MINIMAL}/res-4k.webp`,
      `${MINIMAL}/aud-atmos.webp`,
      `${MINIMAL}/vis-hdr10plus.webp`,
    ],
    url: `${MINIMAL}.json`,
  },
  {
    id: "abstract",
    kind: "nuvio",
    name: "Abstract",
    author: "Harbor",
    description: "Sleek abstract icons for common tags",
    count: "67 badges",
    previews: [
      `${ABSTRACT}/4k-ultra-hd.webp`,
      `${ABSTRACT}/dolby-atmos.webp`,
      `${ABSTRACT}/hdr10-plus.webp`,
    ],
    url: `${ABSTRACT}.json`,
  },
  {
    id: "harbor-light",
    kind: "nuvio",
    name: "Harbor Light",
    author: "Harbor",
    description:
      "Premium light set spanning resolutions, audio, HDR, release tiers, torrent groups, quality ranks and languages.",
    count: "206 badges",
    previews: [
      `${HARBORLIGHT}/res-4k.webp`,
      `${HARBORLIGHT}/aud-atmos.webp`,
      `${HARBORLIGHT}/vis-dv.webp`,
    ],
    url: `${HARBORLIGHT}.json`,
  },
  {
    id: "harbor-color",
    kind: "nuvio",
    name: "Harbor Color",
    author: "Harbor",
    description:
      "Full-color edition of the premium set: vivid resolution, audio, HDR, release tier and streaming marks.",
    count: "206 badges",
    previews: [
      `${HARBORCOLOR}/res-4k.webp`,
      `${HARBORCOLOR}/aud-atmos.webp`,
      `${HARBORCOLOR}/stream-netflix.webp`,
    ],
    url: `${HARBORCOLOR}.json`,
  },
  {
    id: "nardbadges",
    kind: "nuvio",
    name: "NardBadges",
    author: "vowl313",
    description:
      "Comprehensive set covering resolutions, HDR and Dolby Vision combos, audio, streaming providers, ranked release tiers, SeaDex and languages.",
    count: "106 badges",
    previews: [`${NARD}/res-4k.png`, `${NARD}/aud-atmos.png`, `${NARD}/vis-hdr10plus.png`],
    url: `${NARD}/NardBadges.json`,
  },
  {
    id: "nuvio-badges",
    kind: "nuvio",
    name: "Nuvio Badges",
    author: "dustincos",
    description:
      "The flagship Nuvio ruleset. Glow badges for 4K, Dolby Vision, HDR10+, IMAX, full audio coverage, and provider tags.",
    count: "~60 rules",
    previews: [
      "https://raw.githubusercontent.com/9mousaa/BetterFormatter/main/images/colored-remux.png",
      "https://raw.githubusercontent.com/9mousaa/BetterFormatter/main/images/4k.png",
      "https://raw.githubusercontent.com/9mousaa/BetterFormatter/main/images/atmos.png",
    ],
    url: "https://raw.githubusercontent.com/dustincos/nuvio-badges/main/badges.json",
  },
  {
    id: "elite-badges",
    kind: "nuvio",
    name: "Elite Badges",
    author: "LeoneVZ",
    description:
      "Clean high-contrast PNG badges for sources, resolutions, codecs, audio and channels.",
    count: "~40 rules",
    previews: [`${ELITE}/remux.png`, `${ELITE}/4k.png`, `${ELITE}/atmos.png`],
    url: "https://raw.githubusercontent.com/leonevz/Elite-Badges/main/badges.json",
  },
  {
    id: "nuvio-svg-badges",
    kind: "nuvio",
    name: "Nuvio SVG Badges",
    author: "dwivedisankalp97",
    description:
      "Crisp vector badges that stay sharp at any size. Quality, resolution, visual, audio and channel groups.",
    count: "~45 rules",
    previews: [`${NSVG}/remux.svg`, `${NSVG}/4k.svg`, `${NSVG}/atmos.svg`],
    url: "https://raw.githubusercontent.com/dwivedisankalp97/nuvio-svg-badges/main/dist/badges.json",
  },
  {
    id: "anupam-badges",
    kind: "nuvio",
    name: "Anupam's Badges",
    author: "anupamparida",
    description:
      "Deep ruleset with tier tags, SeaDex releases, languages, bit depth and streaming groups.",
    count: "~108 rules",
    previews: [
      "https://i.postimg.cc/rwh87wwK/SEADEX.png",
      "https://raw.githubusercontent.com/9mousaa/BetterFormatter/main/images/HDR10Plus.png",
      "https://raw.githubusercontent.com/9mousaa/BetterFormatter/main/images/dtsx.png",
    ],
    url: "https://gist.githubusercontent.com/anupamparida/f1877b01573637c1616d81de0e80a2cc/raw/Nuvio_badges.json",
  },
  {
    id: "betterformatter-colored",
    kind: "art",
    name: "BetterFormatter Colored",
    author: "9mousaa",
    description:
      "Swaps Harbor's built-in badge art for BetterFormatter's colored set. No rules, pure art remap.",
    count: "21 remaps",
    previews: [`${BF}/colored-remux.png`, `${BF}/4k.png`, `${BF}/vision.png`],
    art: {
      ...BF_SHARED,
      remux: `${BF}/colored-remux.png`,
      webdl: `${BF}/colored-webdl.png`,
      bluray: `${BF}/colored-bluray.png`,
    },
  },
  {
    id: "betterformatter-mono",
    kind: "art",
    name: "BetterFormatter Mono",
    author: "9mousaa",
    description: "Same set with monochrome source tags for a quieter look.",
    count: "21 remaps",
    previews: [`${BF}/mono-remux.png`, `${BF}/mono-webdl.png`, `${BF}/mono-bluray.png`],
    art: {
      ...BF_SHARED,
      remux: `${BF}/mono-remux.png`,
      webdl: `${BF}/mono-webdl.png`,
      bluray: `${BF}/mono-bluray.png`,
    },
  },
  {
    id: "sweatycab-white",
    kind: "nuvio",
    name: "Minimalist White",
    author: "sweatycab",
    description: "Quiet white SVG badges. Clean typography, no color noise.",
    count: "39 rules",
    previews: [
      "https://cdn.jsdelivr.net/gh/sweatycab/nuvio-minimalist-badges@main/badges/white-4k.svg",
      "https://cdn.jsdelivr.net/gh/sweatycab/nuvio-minimalist-badges@main/badges/white-1080p.svg",
      "https://cdn.jsdelivr.net/gh/sweatycab/nuvio-minimalist-badges@main/badges/white-720p.svg",
    ],
    url: "https://raw.githubusercontent.com/sweatycab/nuvio-minimalist-badges/main/badges-white.json",
  },
  {
    id: "sweatycab-mixed",
    kind: "nuvio",
    name: "Minimalist Mixed",
    author: "sweatycab",
    description: "The minimalist set with a touch of grey for secondary tags.",
    count: "39 rules",
    previews: [
      "https://cdn.jsdelivr.net/gh/sweatycab/nuvio-minimalist-badges@main/badges/white-4k.svg",
      "https://cdn.jsdelivr.net/gh/sweatycab/nuvio-minimalist-badges@main/badges/white-1080p.svg",
      "https://cdn.jsdelivr.net/gh/sweatycab/nuvio-minimalist-badges@main/badges/grey-720p.svg",
    ],
    url: "https://raw.githubusercontent.com/sweatycab/nuvio-minimalist-badges/main/badges-mixed.json",
  },
  {
    id: "djgenesis-gold",
    kind: "nuvio",
    name: "Gold Badges",
    author: "djgenesis",
    description: "Full gold-accent set covering resolutions, sources, audio and extras.",
    count: "64 rules",
    previews: [
      "https://raw.githubusercontent.com/djgenesis/stream/refs/heads/main/badges/uhd.png",
      "https://raw.githubusercontent.com/djgenesis/stream/refs/heads/main/badges/fhd.png",
      "https://raw.githubusercontent.com/djgenesis/stream/refs/heads/main/badges/720p.png",
    ],
    url: "https://raw.githubusercontent.com/djgenesis/badges/refs/heads/main/gold_badges_complete.json",
  },
  {
    id: "sterzeck",
    kind: "nuvio",
    name: "Colorful & Concise",
    author: "danielsdian",
    description: "Sterzeck's deep set: SeaDex, Criterion, hybrids and precise release matching.",
    count: "100 rules",
    previews: [
      "https://raw.githubusercontent.com/kingsizew/badges/main/badge-images/special-tags/seadex.png",
      "https://raw.githubusercontent.com/kingsizew/badges/main/badge-images/special-tags/hybrid.png",
      "https://raw.githubusercontent.com/kingsizew/badges/main/badge-images/special-tags/criterion.png",
    ],
    url: "https://raw.githubusercontent.com/danielsdian/ColorfulAndConcise/refs/heads/main/Sterzeck_badge.json",
  },
  {
    id: "ume-colored",
    kind: "nuvio",
    name: "UME Colored",
    author: "nobnobz",
    description: "Tiered release-group badges: remux and web tiers ranked T1 to T6, in color.",
    count: "43 rules",
    previews: [
      "https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/colored%20regex%20tags/new%20tiers/remux%20t1.png",
      "https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/colored%20regex%20tags/new%20tiers/remux%20t2.png",
      "https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/colored%20regex%20tags/new%20tiers/remux%20t3.png",
    ],
    url: "https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/refs/heads/main/Other/fusion-tags-ume-colored.json",
  },
  {
    id: "ume",
    kind: "nuvio",
    name: "UME",
    author: "nobnobz",
    description: "The tiered set in its original monochrome look.",
    count: "43 rules",
    previews: [
      "https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/new%20tiers/remux%20t1.png",
      "https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/new%20tiers/remux%20t2.png",
      "https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/new%20tiers/remux%20t3.png",
    ],
    url: "https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/refs/heads/main/Other/fusion-tags-ume.json",
  },
  {
    id: "ume-minimal",
    kind: "nuvio",
    name: "UME Minimalistic",
    author: "nobnobz",
    description: "Tier badges pared down to the essentials.",
    count: "43 rules",
    previews: [
      "https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/new%20tiers/remux%20t1.png",
      "https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/new%20tiers/web%20t1.png",
      "https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/new%20tiers/web%20t2.png",
    ],
    url: "https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/refs/heads/main/Other/fusion-tags-ume-minimalistic.json",
  },
  {
    id: "k45sle-gold",
    kind: "nuvio",
    name: "Gold No-Names",
    author: "k45sle",
    description: "Icon-only gold badges. No text, just marks.",
    count: "28 rules",
    previews: [
      "https://raw.githubusercontent.com/k45sle/NUVIO_BADGES/refs/heads/main/resources/REMUXn3.png",
      "https://raw.githubusercontent.com/ngreyx1/badges/refs/heads/main/images-white/mono-bluray.png",
      "https://raw.githubusercontent.com/ngreyx1/badges/refs/heads/main/images-white/mono-webdl.png",
    ],
    url: "https://raw.githubusercontent.com/k45sle/NUVIO_BADGES/refs/heads/main/GOLD-NONAMES.json",
  },
  {
    id: "bringer",
    kind: "nuvio",
    name: "Bringer's Badges",
    author: "BringerOfRainX1",
    description: "Compact set built on the classic regex-tags art.",
    count: "25 rules",
    previews: [
      "https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/4k.png",
      "https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/1080p.png",
      "https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/720p.png",
    ],
    url: "https://gist.githubusercontent.com/BringerOfRainX1/91203014c5d32c1ca7d5b51870a19786/raw/Badges%2520json",
  },
  {
    id: "ngreyx1",
    kind: "nuvio",
    name: "ngreyx1's Badges",
    author: "ngreyx1",
    description: "Colored logo-free variants of the classic badge art.",
    count: "39 rules",
    previews: [
      "https://raw.githubusercontent.com/ngreyx1/badges/refs/heads/main/images%20w%3Ao%20logo/colored-remux.png",
      "https://raw.githubusercontent.com/ngreyx1/badges/refs/heads/main/images%20w%3Ao%20logo/colored-bluray.png",
      "https://raw.githubusercontent.com/ngreyx1/badges/refs/heads/main/images%20w%3Ao%20logo/colored-webdl.png",
    ],
    url: "https://raw.githubusercontent.com/ngreyx1/badges/main/badges%20updated.json",
  },
  {
    id: "nosvasedis-regular",
    kind: "nuvio",
    name: "Nosvasedis",
    author: "nosvasedis",
    description: "Big ruleset with tier ranks, SeaDex and release-group intel.",
    count: "84 rules",
    previews: [
      "https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/new%20tiers/web%20unranked.png",
      "https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/new%20tiers/web%20t6.png",
      "https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/4k.png",
    ],
    url: "https://gist.githubusercontent.com/nosvasedis/7abd79424bb8981b511838524c52f097/raw/76c519d05f6518f0ed186ba802847c625ba730fa/nosvasedis-badges-nuvio",
  },
  {
    id: "nosvasedis-solid",
    kind: "nuvio",
    name: "Nosvasedis Solid",
    author: "nosvasedis",
    description: "The 124-rule flagship variant with solid fills.",
    count: "124 rules",
    previews: [
      "https://raw.githubusercontent.com/kingsizew/badges/main/badge-images/special-tags/seadex.png",
      "https://raw.githubusercontent.com/kingsizew/badges/main/badge-images/special-tags/hybrid.png",
      "https://raw.githubusercontent.com/kingsizew/badges/main/badge-images/special-tags/criterion.png",
    ],
    url: "https://gist.githubusercontent.com/nosvasedis/7abd79424bb8981b511838524c52f097/raw/solid-nosvasedis-badges-nuvio",
  },
  {
    id: "nosvasedis-mono",
    kind: "nuvio",
    name: "Nosvasedis Mono",
    author: "nosvasedis",
    description: "Same 124 rules, monochrome art.",
    count: "124 rules",
    previews: [
      "https://raw.githubusercontent.com/kingsizew/badges/main/badge-images/special-tags/seadex.png",
      "https://raw.githubusercontent.com/kingsizew/badges/main/badge-images/special-tags/hybrid.png",
      "https://raw.githubusercontent.com/kingsizew/badges/main/badge-images/special-tags/criterion.png",
    ],
    url: "https://gist.githubusercontent.com/nosvasedis/1858e332fef11d136f76c697ea6c7439/raw/mono-nosvasedis-badges-nuvio",
  },
  {
    id: "nosvasedis-transparent",
    kind: "nuvio",
    name: "Nosvasedis Transparent",
    author: "nosvasedis",
    description: "Same 124 rules with see-through chips.",
    count: "124 rules",
    previews: [
      "https://raw.githubusercontent.com/kingsizew/badges/main/badge-images/special-tags/seadex.png",
      "https://raw.githubusercontent.com/kingsizew/badges/main/badge-images/special-tags/hybrid.png",
      "https://raw.githubusercontent.com/kingsizew/badges/main/badge-images/special-tags/criterion.png",
    ],
    url: "https://gist.githubusercontent.com/nosvasedis/63b769d205bddbbef79faf8beef53c28/raw/transparent-nosvasedis-badges-nuvio",
  },
  {
    id: "bf-preset-colored",
    kind: "nuvio",
    name: "BetterFormatter Tiers Colored",
    author: "9mousaa",
    description: "Best/good/bad tier callouts on top of the colored art set.",
    count: "46 rules",
    previews: [
      `${BF}/colored-best-remux.png`,
      `${BF}/colored-best-bluray.png`,
      `${BF}/colored-best-webdl.png`,
    ],
    url: "https://raw.githubusercontent.com/9mousaa/BetterFormatter/main/presets/colored-bgb-combo-nodv.json",
  },
  {
    id: "bf-preset-mono",
    kind: "nuvio",
    name: "BetterFormatter Tiers Mono",
    author: "9mousaa",
    description: "The tier preset in monochrome.",
    count: "46 rules",
    previews: [
      `${BF}/mono-best-remux.png`,
      `${BF}/mono-best-bluray.png`,
      `${BF}/mono-best-webdl.png`,
    ],
    url: "https://raw.githubusercontent.com/9mousaa/BetterFormatter/main/presets/mono-bgb-combo-nodv.json",
  },
  {
    id: "badger-community",
    kind: "nuvio",
    name: "Badger Community Pack",
    author: "Badger templates",
    description: "The shared community template from the Badger builder.",
    count: "39 rules",
    previews: [],
    url: "https://jsonkeeper.com/b/6JWL4",
  },
];

export const BADGE_STUDIOS: Array<{ name: string; url: string; blurb: string }> = [
  {
    name: "Badger",
    url: "https://nintle.github.io/Badger/",
    blurb: "Badge pack builder by Nint. Export JSON, host it as a gist, import the raw link here.",
  },
  {
    name: "BetterFormatter Configurator",
    url: "https://9mousaa.github.io/BetterFormatter/",
    blurb: "Tag configurator with a big free art library.",
  },
];
