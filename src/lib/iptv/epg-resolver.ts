import { getEpgOverride } from "./epg-map";
import { hasArabic, normalizeArabic } from "./rtl";
import { epgOffsetHoursPref } from "./settings-bridge";
import type { EpgIndex, EpgProgram, IptvChannel } from "./types";

const NOISE_WORDS = new Set([
  "hd", "fhd", "uhd", "4k", "sd", "raw", "alt", "backup",
  "channel", "channels", "network", "tv",
  "the", "and", "of", "for",
  "us", "usa", "uk", "ca", "mx", "br", "am", "fm",
]);

function tokenize(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => (w.length >= 2 || /^\d+$/.test(w)) && !NOISE_WORDS.has(w));
}

function normalizeTvgId(tvgId: string): string {
  let s = tvgId.replace(/[._\-:]+/g, " ");
  s = s.replace(/([a-z])([A-Z])/g, "$1 $2");
  s = s.replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  return s;
}

function alnum(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const nameIndexCache = new WeakMap<EpgIndex, Map<string, string>>();

function nameIndexFor(epg: EpgIndex): Map<string, string> {
  const cached = nameIndexCache.get(epg);
  if (cached) return cached;
  const map = new Map<string, string>();
  if (epg.channelMeta) {
    for (const [tvgId, meta] of epg.channelMeta) {
      const name = meta.displayName;
      if (!name) continue;
      const key = nameKey(name);
      if (key && !map.has(key)) map.set(key, tvgId);
    }
  }
  for (const tvgId of epg.byChannel.keys()) {
    const key = nameKey(tvgId);
    if (key && !map.has(key)) map.set(key, tvgId);
  }
  nameIndexCache.set(epg, map);
  return map;
}

function nameKey(s: string): string {
  if (hasArabic(s)) return normalizeArabic(s).replace(/\s+/g, "");
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function shiftHours(channel: IptvChannel): number {
  const global = epgOffsetHoursPref();
  const raw = channel.attrs["tvg-shift"];
  if (!raw) return global;
  const n = Number.parseFloat(raw);
  return (Number.isFinite(n) ? n : 0) + global;
}

// merged EPG sources routinely list the same programme more than once, or with
// slightly different times. Overlapping entries stack on top of each other in the
// guide, so collapse them to one run before anything renders.
function sanitize(programs: EpgProgram[]): EpgProgram[] {
  const sorted = [...programs]
    .filter((p) => p.endMs > p.startMs)
    .sort((a, b) => a.startMs - b.startMs || b.endMs - a.endMs);
  const out: EpgProgram[] = [];
  for (const p of sorted) {
    const last = out[out.length - 1];
    if (!last) {
      out.push(p);
      continue;
    }
    if (p.startMs >= last.endMs) {
      out.push(p);
      continue;
    }
    if (p.endMs - p.startMs > last.endMs - last.startMs) out[out.length - 1] = p;
  }
  return out;
}

function applyShift(programs: EpgProgram[], hours: number): EpgProgram[] {
  if (hours === 0) return sanitize(programs);
  const ms = hours * 3_600_000;
  return sanitize(programs.map((p) => ({ ...p, startMs: p.startMs + ms, endMs: p.endMs + ms })));
}

export function epgProgramsForChannel(
  channel: IptvChannel,
  epg: EpgIndex | null,
  tvgIdCounts: ReadonlyMap<string, number>,
): EpgProgram[] | undefined {
  if (!epg) return undefined;
  const shift = shiftHours(channel);
  const override = getEpgOverride(channel.id);
  if (override) {
    const ov = epg.byChannel.get(override);
    return ov ? applyShift(ov, shift) : undefined;
  }
  if (!channel.tvgId) return nameFallback(channel, epg, shift);
  const programs = epg.byChannel.get(channel.tvgId);
  if (!programs || programs.length === 0) return nameFallback(channel, epg, shift);
  const count = tvgIdCounts.get(channel.tvgId) ?? 0;
  if (count <= 1) return applyShift(programs, shift);

  const idTokens = tokenize(normalizeTvgId(channel.tvgId));
  if (idTokens.length === 0) return undefined;
  const chTokens = new Set(tokenize(channel.name));
  const chAlnum = alnum(channel.name);

  for (const t of idTokens) {
    if (chTokens.has(t)) continue;
    if (t.length >= 4 && chAlnum.includes(t)) continue;
    return undefined;
  }
  return applyShift(programs, shift);
}

function nameFallback(
  channel: IptvChannel,
  epg: EpgIndex,
  shift: number,
): EpgProgram[] | undefined {
  const key = nameKey(channel.name);
  if (!key || key.length < 3) return undefined;
  const tvgId = nameIndexFor(epg).get(key);
  if (!tvgId) return undefined;
  const programs = epg.byChannel.get(tvgId);
  if (!programs || programs.length === 0) return undefined;
  return applyShift(programs, shift);
}

export function computeTvgIdCounts(channels: IptvChannel[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const ch of channels) {
    if (!ch.tvgId) continue;
    counts.set(ch.tvgId, (counts.get(ch.tvgId) ?? 0) + 1);
  }
  return counts;
}
