import { ACCOUNT_SECTIONS, PROFILE_SECTIONS, type SectionKey } from "./types";

const KB = 1024;
const DEFAULT_LIMIT = 96 * KB;

const SECTION_LIMIT: Partial<Record<SectionKey, number>> = {
  settings: 32 * KB,
  theme: 8 * KB,
  playerlayout: 16 * KB,
};

export const MAX_WRITES_PER_PUSH = 16;
export const MAX_PUSH_BYTES = 192 * KB;

export function sectionLimit(section: SectionKey): number {
  return SECTION_LIMIT[section] ?? DEFAULT_LIMIT;
}

export function byteLength(serialized: string): number {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(serialized).length;
  let bytes = 0;
  for (const char of serialized) bytes += char.codePointAt(0)! > 0xffff ? 4 : 3;
  return bytes;
}

export function isKnownSection(section: string): boolean {
  return (
    (PROFILE_SECTIONS as readonly string[]).includes(section) ||
    (ACCOUNT_SECTIONS as readonly string[]).includes(section)
  );
}
