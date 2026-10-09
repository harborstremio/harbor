import type { Meta } from "@/lib/cinemeta";

/** How many of each badge a strip shows before it counts the rest.
 *
 * A poster is narrow — often about 140px — so a strip of everything a provider wrote would cover the
 * artwork it is meant to sit on. The full line stays one hover away, and the whole reading is on the
 * detail page. */
const MAX_LANGUAGES = 2;
const MAX_QUALITY = 2;
const MAX_RESOLUTIONS = 2;

/** How much a badge is worth, so the best one leads.
 *
 * Ordered the way the app already orders the same things: `resolutionPoints` in the stream scorer
 * gives 4K 25 points and 480p 2, and `TIER_RANK` in the local library sorts versions best first.
 * A poster reads as what the file is at best, so `1080p` leads a `480p · 720p · 1080p` listing
 * rather than the 480p the provider happened to write first.
 *
 * The resolution carries the order; the release and codec only break ties between equals. */
const QUALITY_RANK: Record<string, number> = {
  "8K": 90,
  "4K": 80,
  "1440p": 70,
  "1080p": 60,
  "720p": 50,
  "576p": 40,
  "540p": 35,
  "480p": 30,
  HD: 25,
  SD: 20,
  // Release and codec, which say how the file was made rather than how big it is.
  Remux: 19,
  BluRay: 18,
  "WEB-DL": 17,
  WEBRip: 16,
  BDRip: 15,
  BRRip: 14,
  HDRip: 13,
  DVDRip: 12,
  HDTV: 11,
  HEVC: 10,
  AVC: 9,
  x265: 9,
  x264: 8,
  AV1: 8,
  "10bit": 6,
  Dolby: 5,
  Atmos: 4,
};

/** A quality badge's worth, with anything unranked below everything ranked rather than above it. */
export function qualityRank(q: string): number {
  return QUALITY_RANK[q] ?? 0;
}

/** The badges a listing earned, from what the provider wrote after the title.
 *
 * Nothing is guessed. A language is badged only when it was recognised by name, and an unrecognised
 * word is left to the tooltip rather than turned into a badge that might be wrong.
 *
 * A resolution is a single badge whichever way the provider wrote it, and it leads: the file's
 * resolution is what a reader is looking for, and the release and codec follow it. A size is not a
 * badge at all — `300MB` says cost, not quality, and it belongs in the tooltip with the rest of the
 * line rather than competing with the resolution for the one slot a poster has. */
export function listingBadges(
  meta: Meta,
  want: { languages: boolean; quality: boolean },
): {
  languages: string[];
  languagesMore: number;
  quality: string[];
  qualityMore: number;
  resolutions: string[];
  resolutionsMore: number;
} {
  const extras = meta.listingExtras;
  const languages = want.languages ? (extras?.languages ?? []) : [];
  // Resolution first, then the release and codec. Sorted before the cap so the ones kept are the
  // best the listing has rather than whichever the provider wrote first.
  const sorted = want.quality
    ? [...(extras?.quality ?? [])].sort((a, b) => qualityRank(b) - qualityRank(a))
    : [];
  const resolutions = want.quality ? (extras?.resolutions ?? []) : [];
  return {
    languages: languages.slice(0, MAX_LANGUAGES),
    languagesMore: Math.max(0, languages.length - MAX_LANGUAGES),
    quality: sorted.slice(0, MAX_QUALITY),
    qualityMore: Math.max(0, sorted.length - MAX_QUALITY),
    resolutions: resolutions.slice(0, MAX_RESOLUTIONS),
    resolutionsMore: Math.max(0, resolutions.length - MAX_RESOLUTIONS),
  };
}

/** Whether a badge strip would say anything at all, so a tile can skip drawing an empty one. */
export function hasListingBadges(
  meta: Meta,
  want: { languages: boolean; quality: boolean },
): boolean {
  const badges = listingBadges(meta, want);
  return (
    badges.languages.length > 0 ||
    badges.quality.length > 0 ||
    badges.resolutions.length > 0
  );
}

/** The whole line the provider sent, for a tooltip: what is badged is a reading of it, and the
 * reading is not what was written. Empty when the listing carried nothing beyond its title. */
export function listingLine(meta: Meta): string | undefined {
  return meta.listingExtras?.rest || undefined;
}
