import type { HdrFormat } from "../types";

const HDR_FORMATS: Array<[RegExp, HdrFormat]> = [
  [
    /\bDV[+\-\s.]?HDR10\+?\b|\bDoVi[+\-\s.]?HDR10\+?\b|\bDolby[.\s]?Vision[+\-\s.]?HDR10\+?\b/i,
    "DV+HDR10",
  ],
  [/\bDV\b|\bDoVi\b|\bDolby[.\s]?Vision\b/i, "DV"],
  [/\bHDR10\+\b/i, "HDR10+"],
  [/\bHLG\b/i, "HLG"],
  [/\bHDR10?\b|\bHDR\b/i, "HDR10"],
];

export function detectHdr(text: string): HdrFormat | null {
  for (const [rx, label] of HDR_FORMATS) {
    if (rx.test(text)) return label;
  }
  return null;
}
