import { parseRelease } from "./release-match.ts";

function sourceLabel(release: string): string | undefined {
  const tags = parseRelease(release);
  const hasBluray = /\b(blu-?ray|bd-?rip|br-?rip|bd(?:25|50)|bdmv)\b/i.test(release);

  if (tags.source === "remux") return hasBluray ? "BluRay REMUX" : "REMUX";
  if (tags.source === "bluray") return "BluRay";
  if (tags.source === "webdl") return "WEB-DL";
  if (tags.source === "webrip") return "WEBRip";
  if (tags.source === "hdtv") return "HDTV";
  if (tags.source === "dvd") return "DVD";
  if (tags.source === "cam") return "CAM";
  return undefined;
}

function technicalTags(release: string): string[] {
  const patterns: Array<[string, RegExp]> = [
    ["AV1", /\bav1\b/i],
    ["HEVC", /\b(hevc|x265|h[ .-]?265)\b/i],
    ["x264", /\bx264\b/i],
    ["H.264", /\bh[ .-]?264\b/i],
    ["TrueHD", /\btruehd\b/i],
    ["Atmos", /\batmos\b/i],
    ["DTS-HD MA", /\bdts-hd[ .-]?ma\b/i],
    ["DTS", /\bdts\b(?!-hd)/i],
    ["DDP", /\bddp?\d(?:[ .-]?\d)?\b/i],
    ["AAC", /\baac\b/i],
    ["FLAC", /\bflac\b/i],
  ];
  return patterns.filter(([, pattern]) => pattern.test(release)).map(([label]) => label);
}

/**
 * Turns a noisy release filename into the stable details people use to choose
 * a subtitle. The original string remains available as a native hover title.
 */
export function subtitleReleaseLabel(release: string | undefined): string | undefined {
  const raw = release?.trim();
  if (!raw) return undefined;

  const tags = parseRelease(raw);
  const parts = [
    sourceLabel(raw),
    tags.resolution,
    ...tags.hdr.map((tag) => (tag === "dv" ? "Dolby Vision" : tag.toUpperCase())),
    ...technicalTags(raw),
    ...tags.edition.map((edition) => (edition === "directors" ? "Director's Cut" : edition)),
  ].filter((part, index, all): part is string => Boolean(part) && all.indexOf(part) === index);

  return parts.length > 0 ? parts.join(" · ") : undefined;
}
