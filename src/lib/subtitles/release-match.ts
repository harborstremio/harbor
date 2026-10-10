export type SourceClass = "remux" | "bluray" | "webdl" | "webrip" | "hdtv" | "dvd" | "cam";

export type ReleaseTags = {
  group: string | null;
  source: SourceClass | null;
  resolution: string | null;
  hdr: string[];
  edition: string[];
  season: number | null;
  episode: number | null;
  episodeEnd: number | null;
  proper: boolean;
  repack: boolean;
};

export type SubtitleMatchConfidence = "exact" | "high" | "medium" | "low" | "incompatible";

export function subtitleConfidenceRank(confidence: SubtitleMatchConfidence): number {
  switch (confidence) {
    case "exact":
      return 5;
    case "high":
      return 4;
    case "medium":
      return 3;
    case "low":
      return 2;
    case "incompatible":
      return 0;
  }
}

function clampPercent(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * Turns release evidence into a stable, absolute compatibility estimate.
 * The confidence bands deliberately do not overlap, so a weak best result
 * cannot look stronger than a well-supported source/cut match.
 */
export function releaseCompatibilityPercent(
  confidence: SubtitleMatchConfidence,
  score: number,
): number {
  const evidence = Math.max(0, score);
  switch (confidence) {
    case "exact":
      return 100;
    case "high":
      return clampPercent(75 + (Math.min(evidence, 240) / 240) * 24, 75, 99);
    case "medium":
      return clampPercent(50 + (Math.min(evidence, 120) / 120) * 24, 50, 74);
    case "low":
      return clampPercent(20 + (Math.min(evidence, 100) / 100) * 29, 20, 49);
    case "incompatible":
      return clampPercent((Math.min(evidence, 100) / 100) * 19, 0, 19);
  }
}

const KNOWN_GROUPS = [
  "EVO",
  "RARBG",
  "YTS",
  "YIFY",
  "FGT",
  "PSA",
  "TBS",
  "GALAXYRG",
  "GALAXYTV",
  "MEGUSTA",
  "ION10",
  "EZTV",
  "NTB",
  "FLUX",
  "TEPES",
  "KOGI",
  "SMURF",
  "RZEROX",
  "D3G",
  "TGX",
  "SPARKS",
  "AMIABLE",
  "GECKOS",
  "DRONES",
  "CMRG",
  "PAHE",
  "QXR",
  "TIGOLE",
  "JOY",
  "FRAMESTOR",
  "HDMANIACS",
  "WIKI",
  "DON",
  "EBP",
  "BLURANIUM",
  "3L",
  "BMF",
  "TRUFFLE",
  "SICFOI",
  "PMTP",
  "KINGS",
  "CAKES",
  "SUCCESSFULCRAB",
  "ELITE",
  "TOMMY",
  "MZABI",
  "PLAYWEB",
  "XEBEC",
  "SEV",
  "NOSIVID",
  "TVSMASH",
  "MINX",
  "EDITH",
  "TEAMHD",
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
    if (
      !/^(MKV|MP4|AVI|SRT|ASS|SSA|VTT|1080P|720P|2160P|X264|X265|H264|H265|HEVC|AAC|DTS|DDP5|WEB)$/.test(
        cand,
      )
    ) {
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
  const episode = parseEpisodeRange(s);
  return {
    group: detectGroup(s),
    source: detectSource(s),
    resolution: res ? res[1].toLowerCase() : fourK ? "2160p" : null,
    hdr: HDR_TAGS.filter(([, rx]) => rx.test(s)).map(([k]) => k),
    edition: EDITIONS.filter(([, rx]) => rx.test(s)).map(([k]) => k),
    season: episode?.season ?? null,
    episode: episode?.episode ?? null,
    episodeEnd: episode?.episodeEnd ?? null,
    proper: /\bproper\b/i.test(s),
    repack: /\brepack\b/i.test(s),
  };
}

function parseEpisodeRange(
  text: string,
): { season: number; episode: number; episodeEnd: number } | null {
  const standard = text.match(
    /(?:^|[^a-z0-9])s(\d{1,2})[ ._-]*e(\d{1,3})(?:(?:[ ._-]*-?[ ._-]*e?)(\d{1,3}))?(?:[^a-z0-9]|$)/i,
  );
  const alternate = text.match(
    /(?:^|[^a-z0-9])(\d{1,2})x(\d{1,3})(?:[ ._-]*-?[ ._-]*(\d{1,3}))?(?:[^a-z0-9]|$)/i,
  );
  const match = standard ?? alternate;
  if (!match) return null;
  const season = Number.parseInt(match[1], 10);
  const episode = Number.parseInt(match[2], 10);
  const parsedEnd = match[3] ? Number.parseInt(match[3], 10) : episode;
  if (![season, episode, parsedEnd].every(Number.isSafeInteger)) return null;
  return { season, episode, episodeEnd: Math.max(episode, parsedEnd) };
}

export function sourceAffinity(want: SourceClass | null, got: SourceClass | null): number {
  if (!want || !got) return 0;
  if (want === got) return 1;
  return COMPAT[want]?.[got] ?? 0;
}

export type AffinityResult = {
  score: number;
  reasons: string[];
  /**
   * Source family is a stronger timing signal than a release-group label.
   * Keep fallbacks at rank 1 so a WEB-DL subtitle is still usable when no
   * BluRay/REMUX candidate exists.
   */
  sourceRank: 1 | 2 | 3;
  confidence: Exclude<SubtitleMatchConfidence, "exact">;
};

function sourceRank(want: SourceClass | null, got: SourceClass | null): 1 | 2 | 3 {
  if (!want || !got) return 1;
  const affinity = sourceAffinity(want, got);
  if (affinity >= 1) return 3;
  if (affinity >= 0.75) return 2;
  return 1;
}

export function releaseAffinity(stream: ReleaseTags, subText: string): AffinityResult {
  const sub = parseRelease(subText);
  const reasons: string[] = [];
  let score = 0;
  const matchSourceRank = sourceRank(stream.source, sub.source);
  let incompatible = false;
  let episodeMatch = false;
  let editionMatch = false;

  if (
    stream.season != null &&
    stream.episode != null &&
    sub.season != null &&
    sub.episode != null
  ) {
    const subEnd = sub.episodeEnd ?? sub.episode;
    const sameEpisode =
      stream.season === sub.season && stream.episode >= sub.episode && stream.episode <= subEnd;
    if (sameEpisode) {
      score += 80;
      episodeMatch = true;
      reasons.push(`S${stream.season}E${stream.episode} matches`);
    } else {
      score -= 300;
      incompatible = true;
      reasons.push(`subtitle is for S${sub.season}E${sub.episode}`);
    }
  }

  if (stream.group && sub.group && stream.group === sub.group) {
    score += 120;
    reasons.push(`same release group ${sub.group}`);
  }

  if (stream.source && sub.source) {
    const aff = sourceAffinity(stream.source, sub.source);
    if (aff >= 1) {
      score += 45;
      reasons.push(`${sub.source} matches the stream`);
    } else if (aff >= 0.75) {
      score += Math.round(45 * aff);
      reasons.push(`${sub.source} is close to ${stream.source}`);
    } else {
      score -= 30;
      incompatible = true;
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
      reasons.push(`subtitle is ${sub.resolution}, video is ${stream.resolution}`);
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
      editionMatch = true;
      reasons.push(`${shared[0]} edition`);
    } else {
      score -= 25;
      incompatible = true;
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

  const groupMatch = !!stream.group && !!sub.group && stream.group === sub.group;
  const corroboratedSource = matchSourceRank === 3 && (episodeMatch || editionMatch);
  const confidence: Exclude<SubtitleMatchConfidence, "exact"> = incompatible
    ? "incompatible"
    : groupMatch || corroboratedSource
      ? "high"
      : matchSourceRank >= 2
        ? "medium"
        : "low";

  return { score, reasons, sourceRank: matchSourceRank, confidence };
}

export function describeTags(t: ReleaseTags): string {
  const episode = t.season != null && t.episode != null ? `S${t.season}E${t.episode}` : null;
  const parts = [episode, t.source, t.resolution, ...t.hdr, ...t.edition, t.group].filter(Boolean);
  return parts.join(" ") || "unknown release";
}
