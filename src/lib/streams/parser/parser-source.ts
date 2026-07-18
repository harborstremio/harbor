import type { Source } from "../types";

const SOURCE_RX: Array<[RegExp, Source]> = [
  [/\bHC[\s._-]?(?:HDRip|HD[\s._-]?Rip|CAM(?:Rip)?)\b/i, "CAM"],
  [/\b(?:HD|Clean|New|HQ|TS)[\s._-]?CAM(?:Rip)?\b|\bCAM(?:Rip)?\b/i, "CAM"],
  [/\bHD[\s._-]?TS\b|\bHDTS\b/i, "HDTS"],
  [
    /\bTELESYNC\b|\bTS[\s._-]?Rip\b|\bPDVDRip\b|\bTS\b(?=[\s._-]\d{3,4}[pi]\b)|(?<=\b(?:19|20)\d{2}[\s._-])TS\b/i,
    "TS",
  ],
  [
    /\bTELECINE\b|\bHD[\s._-]?TC\b|\bTC\b(?=[\s._-]\d{3,4}[pi]\b)|(?<=\b(?:19|20)\d{2}[\s._-])TC\b/i,
    "TC",
  ],
  [/\bSCREENER\b|\bDVDSCR\b|\bDVDScreener\b|\bBDSCR\b|\bWEB[\s._-]?SCR\b|\bSCR\b/i, "SCR"],
  [/\bRemux\b/i, "REMUX"],
  [/\bBluRay\b|\bBDRip\b|\bBRRip\b/i, "BluRay"],
  [/\bWEB[.\-]?DL\b/i, "WEB-DL"],
  [/\bWEBRip\b|\bWEB-Rip\b/i, "WEBRip"],
  [/\bHDRip\b/i, "HDRip"],
  [/\bDVDRip\b/i, "DVDRip"],
  [/\bHDTV\b/i, "HDTV"],
  [/\bWEB\b/i, "WEB-DL"],
];

export function detectSource(text: string): Source {
  for (const [rx, label] of SOURCE_RX) {
    if (rx.test(text)) return label;
  }
  return "Other";
}
