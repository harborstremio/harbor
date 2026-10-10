export const sourceTitleKey = (title: string) => title.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase().replace(/[™®©]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Remove distribution metadata, never named editions, sequels, remasters or subtitles. */
export function sourceDownloadTitle(title: string): string {
  // Tracker packaging is a suffix, not part of the catalog title. Keep unknown
  // brackets and numbered chapters: those can identify a different game.
  const unpacked = title
    .split(/\s+\[(?:[PLR]\]\s+(?=\[|\((?:19|20)\d{2})|(?:RUS|ENG|MULTI\d*|x86|amd64|x64|ARM64)(?=[\s,+/|\]])[^\]]*\])/i)[0]
    .replace(/\s+\((?:19|20)\d{2}\)(?=\s+(?:PC\b|\(v[.\s]?\d|\[)).*$/i, "");
  return unpacked.split(/\s+(?:(?:[–—|]|-\s)\s*)?(?:[[(]\s*)?(?:v[.\s]*\d+(?:[.\s(]|$)|ver(?:sion)?[.\s]+\d|build[\s-]*\d|free\s+download\b|(?:fitgirl\s+|dodi\s+)?repack\b|\+\s*\d+\s+dlcs?\b)/i)[0].replace(/[\s,/:|–—-]+$/, '').trim();
}
