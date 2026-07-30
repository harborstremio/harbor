export type SourceClass = "remux" | "bluray" | "webdl" | "webrip" | "hdtv" | "dvd" | "cam";

export type ReleaseTags = {
  group: string | null;
  source: SourceClass | null;
  resolution: string | null;
  hdr: string[];
  edition: string[];
  proper: boolean;
  repack: boolean;
};

const KNOWN_GROUPS = [
  "EVO", "RARBG", "YTS", "YIFY", "FGT", "PSA", "TBS", "GALAXYRG", "GALAXYTV", "MEGUSTA",
  "ION10", "EZTV", "NTB", "FLUX", "TEPES", "KOGI", "SMURF", "RZEROX", "D3G", "TGX",
  "SPARKS", "AMIABLE", "GECKOS", "DRONES", "CMRG", "PAHE", "QXR", "TIGOLE", "JOY",
  "FRAMESTOR", "HDMANIACS", "WIKI", "DON", "EBP", "BLURANIUM", "3L", "BMF", "TRUFFLE",
  "SICFOI", "PMTP", "KINGS", "CAKES", "SUCCESSFULCRAB", "ELITE", "TOMMY", "MZABI",
  "PLAYWEB", "XEBEC", "SEV", "NOSIVID", "TVSMASH", "MINX", "EDITH", "TEAMHD",
];

const SOURCE_PATTERNS: Array<[SourceClass, RegExp]> = [
  ["remux", /\bremux\b/i],
  ["bluray", /\b(blu-?ray|bd-?rip|br-?rip|bd(?:25|50)|bdmv)\b/i],
  ["webrip", /\bweb-?rip\b/i],
  ["webdl", /\b(web-?dl|webdl|web|amzn|dsnp|hmax|atvp|nflx|pcok|itunes)\b/i],
  ["hdtv", /\b(hdtv|pdtv|dsr)\b/i],
  ["dvd", /\b(dvd-?rip|dvd-?r|dvd5|dvd9)\b/i],
  ["cam", /\b(hd-?cam|hd-?ts|telesync|telecine|screener|\bcamrip\b)\b/i],
];

const EDITIONS: Array<[string, RegExp]> = [
  ["extended", /\bextended\b/i],
  ["directors", /\b(director'?s?[. _-]?cut|dc)\b/i],
  ["uncut", /\buncut\b/i],
  ["unrated", /\bunrated\b/i],
  ["theatrical", /\btheatrical\b/i],
  ["imax", /\bimax\b/i],
  ["criterion", /\bcriterion\b/i],
  ["remastered", /\bremaster(?:ed)?\b/i],
  ["finalcut", /\bfinal[. _-]?cut\b/i],
];

const HDR_TAGS: Array<[string, RegExp]> = [
  ["dv", /\b(dv|dovi|dolby[. _-]?vision)\b/i],
  ["hdr10plus", /\b(hdr10\+|hdr10plus)\b/i],
  ["hdr", /\bhdr(?!10\+)\b/i],
  ["hlg", /\bhlg\b/i],
  ["sdr", /\bsdr\b/i],
];

const COMPAT: Partial<Record<SourceClass, Partial<Record<SourceClass, number>>>> = {
  remux: { bluray: 0.85, webdl: 0.25 },
  bluray: { remux: 0.85, webdl: 0.25 },
  webdl: { webrip: 0.75, bluray: 0.25, remux: 0.25 },
  webrip: { webdl: 0.75 },
  hdtv: {},
  dvd: {},
  cam: {},
};

export function detectGroup(text: string | null | undefined): string | null {
  if (!text) return null;
  const upper = text.toUpperCase();
  for (const g of KNOWN_GROUPS) {
    if (new RegExp(`(^|[^A-Z0-9])${g}([^A-Z0-9]|$)`).test(upper)) return g;
  }
  const trailing = text.match(/[-.]([A-Za-z0-9]{3,20})(?:\.[a-z0-9]{2,4})?\s*$/);
  if (trailing) {
    const cand = trailing[1].toUpperCase();
    if (!/^(MKV|MP4|AVI|SRT|ASS|SSA|VTT|1080P|720P|2160P|X264|X265|H264|H265|HEVC|AAC|DTS|DDP5|WEB)$/.test(cand)) {
      return cand;
    }
  }
  return null;
}

export function detectSource(text: string | null | undefined): SourceClass | null {
  if (!text) return null;
  for (const [cls, rx] of SOURCE_PATTERNS) if (rx.test(text)) return cls;
  return null;
}

export function parseRelease(text: string | null | undefined): ReleaseTags {
  const s = text ?? "";
  const res = s.match(/\b(2160p|1080p|720p|576p|480p)\b/i);
  const fourK = /\b(4k|uhd)\b/i.test(s) && !res;
  return {
    group: detectGroup(s),
    source: detectSource(s),
    resolution: res ? res[1].toLowerCase() : fourK ? "2160p" : null,
    hdr: HDR_TAGS.filter(([, rx]) => rx.test(s)).map(([k]) => k),
    edition: EDITIONS.filter(([, rx]) => rx.test(s)).map(([k]) => k),
    proper: /\bproper\b/i.test(s),
    repack: /\brepack\b/i.test(s),
  };
}

export function sourceAffinity(want: SourceClass | null, got: SourceClass | null): number {
  if (!want || !got) return 0;
  if (want === got) return 1;
  return COMPAT[want]?.[got] ?? 0;
}

export type AffinityResult = { score: number; reasons: string[] };

export function releaseAffinity(stream: ReleaseTags, subText: string): AffinityResult {
  const sub = parseRelease(subText);
  const reasons: string[] = [];
  let score = 0;

  if (stream.group && sub.group && stream.group === sub.group) {
    score += 120;
    reasons.push(`same release group ${sub.group}`);
  }

  if (stream.source && sub.source) {
    const aff = sourceAffinity(stream.source, sub.source);
    if (aff >= 1) {
      score += 45;
      reasons.push(`${sub.source} matches the stream`);
    } else if (aff > 0) {
      score += Math.round(45 * aff);
      reasons.push(`${sub.source} is close to ${stream.source}`);
    } else {
      score -= 30;
      reasons.push(`${sub.source} timing differs from ${stream.source}`);
    }
  } else if (stream.source && !sub.source) {
    score += 2;
  }

  if (stream.resolution && sub.resolution) {
    if (stream.resolution === sub.resolution) {
      score += 8;
      reasons.push(`${sub.resolution}`);
    } else {
      score -= 4;
    }
  }

  if (stream.hdr.length && sub.hdr.length) {
    const shared = sub.hdr.filter((h) => stream.hdr.includes(h));
    if (shared.length) {
      score += 10;
      reasons.push(shared.join(" "));
    }
  }

  const streamEd = stream.edition.filter((e) => e !== "remastered");
  const subEd = sub.edition.filter((e) => e !== "remastered");
  if (streamEd.length && subEd.length) {
    const shared = subEd.filter((e) => streamEd.includes(e));
    if (shared.length) {
      score += 25;
      reasons.push(`${shared[0]} edition`);
    } else {
      score -= 25;
      reasons.push(`different edition (${subEd[0]})`);
    }
  } else if (streamEd.length && !subEd.length) {
    score -= 10;
  } else if (!streamEd.length && subEd.length) {
    score -= 15;
    reasons.push(`${subEd[0]} cut, stream is not`);
  }

  if (stream.proper === sub.proper && stream.proper) {
    score += 6;
  } else if (sub.proper !== stream.proper) {
    score -= 3;
  }
  if (stream.repack === sub.repack && stream.repack) score += 4;

  return { score, reasons };
}

export function describeTags(t: ReleaseTags): string {
  const parts = [t.source, t.resolution, ...t.hdr, ...t.edition, t.group].filter(Boolean);
  return parts.join(" ") || "unknown release";
}
