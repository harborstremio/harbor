import type { Stream } from "../types";

const TORRENTIO_NOISE_RX =
  /^[\s👤👥💾📦⚡🌐📺🎬🔊📅⚙️🔗📂🧑‍💻🇬🇧🇺🇸🌍🕵️‍♂️🔑]+|[\s👤👥💾📦⚡🌐📺🎬🔊📅⚙️🔗📂🧑‍💻🇬🇧🇺🇸🌍🕵️‍♂️🔑]+$/gu;

export function extractFilenameLine(stream: Stream): string {
  const lines: string[] = [];
  const filename = stream.behaviorHints?.filename ?? stream.behaviorHints?.fileName;
  for (const raw of [stream.title, filename, stream.description, stream.name]) {
    if (!raw) continue;
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.replace(TORRENTIO_NOISE_RX, "").trim();
      if (trimmed) lines.push(trimmed);
    }
  }
  let best = "";
  let bestScore = -Infinity;
  for (const line of lines) {
    const s = filenameScore(line);
    if (s > bestScore) {
      bestScore = s;
      best = line;
    }
  }
  return best;
}

function filenameScore(line: string): number {
  if (line.length < 8) return -100;
  if (/^(?:torrentio|comet|mediafusion|aiostreams|knightcrawler|jackettio|torbox)\b/i.test(line)) return -100;
  if (/^(?:4k|1080p|720p|480p|sd|hd|hdr|dv|uhd)$/i.test(line)) return -100;
  if (/^[👤👥💾📦⚡🌐📺🎬🔊📅⚙️🔗📂🧑‍💻🇬🇧🇺🇸🌍🕵️‍♂️🔑]/u.test(line)) return -100;
  if (/^(?:size|seeders?|peers?|languages?)\s*[:=]/i.test(line)) return -50;
  if (/^\[(?:RD|TB|AD|PM|DL)\+\]\s+\S+\s+library/i.test(line)) return -50;

  const hasYear = /\b(?:19|20)\d{2}\b/.test(line);
  const hasResolution = /\b\d{3,4}p\b/i.test(line) || /\b(?:4k|uhd|2160p)\b/i.test(line);
  const hasEpisode = /\bS\d{1,2}E\d{1,3}\b/i.test(line);
  const hasSource =
    /\b(?:Blu[\.\-]?Ray|WEB[\.\-]?DL|WEBRip|HDRip|BDRip|HDTV|REMUX|Remux|HDCAM|TELESYNC|TELECINE|CAM|HDTS|DVDRip)\b/i.test(
      line,
    );
  const hasCodec = /\b(?:x264|x265|HEVC|AVC|h264|h265|AV1|MPEG2|MPEG-2)\b/i.test(line);
  const hasContainer = /\.(?:mkv|mp4|m4v|avi|ts)\b/i.test(line);
  const hasDots = (line.match(/\./g) ?? []).length >= 3;
  const technicalMarkers = [hasYear, hasResolution, hasEpisode, hasSource, hasCodec, hasContainer, hasDots].filter(
    Boolean,
  ).length;

  if (technicalMarkers === 0) return -20;

  let s = 0;
  if (line.length >= 20) s += 2;
  if (hasDots) s += 3;
  if (hasYear) s += 2;
  if (hasResolution) s += 2;
  if (hasEpisode) s += 3;
  if (hasSource) s += 3;
  if (hasCodec) s += 1;
  if (hasContainer) s += 2;
  return s;
}
