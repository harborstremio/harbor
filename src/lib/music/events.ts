import { searchMusicVideos } from "./video-discovery";
import type { MusicTrack } from "./types";

// Years are search filters, not a promise that footage exists for every edition.
export const MUSIC_EVENTS = [
  { id: "coachella", name: "Coachella", first: 1999 },
  { id: "rolling-loud", name: "Rolling Loud", first: 2015 },
  { id: "tomorrowland", name: "Tomorrowland", first: 2005 },
  { id: "rock-in-rio", name: "Rock in Rio", first: 1985 },
  { id: "ultra", name: "Ultra Music Festival", first: 1999 },
  { id: "edc", name: "EDC", first: 1997 },
  { id: "defqon", name: "Defqon.1", first: 2003 },
  { id: "creamfields", name: "Creamfields", first: 1998 },
  { id: "glastonbury", name: "Glastonbury", first: 1970 },
  { id: "lollapalooza", name: "Lollapalooza", first: 1991 },
  { id: "primavera", name: "Primavera Sound", first: 2001 },
  { id: "fuji-rock", name: "Fuji Rock", first: 1997 },
  { id: "summer-sonic", name: "Summer Sonic", first: 2000 },
  { id: "wireless", name: "Wireless Festival", first: 2005 },
  { id: "afro-nation", name: "Afro Nation", first: 2019 },
  { id: "afropunk", name: "Afropunk", first: 2005 },
  { id: "essence", name: "ESSENCE Festival", first: 1995 },
  { id: "montreux", name: "Montreux Jazz Festival", first: 1967 },
  { id: "newport", name: "Newport Jazz Festival", first: 1954 },
  { id: "wacken", name: "Wacken Open Air", first: 1990 },
  { id: "hellfest", name: "Hellfest", first: 2006 },
  { id: "download", name: "Download Festival", first: 2003 },
  { id: "stagecoach", name: "Stagecoach Festival", first: 2007 },
  { id: "vma", name: "MTV VMAs", first: 1984, terms: ["vma", "vmas", "video music awards"] },
  { id: "live-aid", name: "Live Aid", first: 1985, years: [1985] },
  { id: "woodstock", name: "Woodstock", first: 1969, years: [1999, 1994, 1969] },
] as const;
export type MusicEvent = typeof MUSIC_EVENTS[number];
export type EventSet = { track: MusicTrack; event: MusicEvent; year: number | null };
// Verified completed editions; unknown years remain ordered by their returned year.
// coachella.com/2026-festival-info-guide · florida.rollingloud.com/guide/hours-and-info/
// belgium.tomorrowland.com/en/ · rockinrio.com/rio/pt-br/faq/
const editionEnds: Record<string, string> = {
  "coachella:2026": "2026-04-19", "rolling-loud:2026": "2026-05-10",
  "tomorrowland:2026": "2026-07-26", "rock-in-rio:2026": "2026-09-13",
};
export function eventRecency(item: EventSet): number {
  const date = /\b(\d{1,2})\/(\d{1,2})\/((?:19|20)\d{2})\b/.exec(item.track.title);
  if (date && Number(date[3]) === item.year) {
    const timestamp = Date.UTC(Number(date[3]), Number(date[2]) - 1, Number(date[1]));
    if (new Date(timestamp).getUTCMonth() === Number(date[2]) - 1 && new Date(timestamp).getUTCDate() === Number(date[1])) return timestamp;
  }
  // Rock in Rio also has Lisbon editions; a generic title does not establish Rio's dates.
  if (item.event.id === "rock-in-rio" && !/brasil|brazil|rio de janeiro|cidade do rock/i.test(item.track.title)) return Date.parse(`${item.year ?? 1970}-01-01`);
  return Date.parse(editionEnds[`${item.event.id}:${item.year}`] ?? `${item.year ?? 1970}-01-01`);
}
const words = (text: string) => text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
export function eventYears(event: MusicEvent, now = new Date()): number[] {
  if ("years" in event) return [...event.years].filter(year => year <= now.getFullYear());
  return Array.from({ length: Math.max(0, now.getFullYear() - event.first + 1) }, (_, i) => now.getFullYear() - i);
}
export function matchEventSets(tracks: MusicTrack[], event: MusicEvent, year?: number): EventSet[] {
  const names = "terms" in event ? event.terms : [event.name];
  return tracks.flatMap(track => {
    const title = ` ${words(track.title)} `;
    if (!names.some(name => title.includes(` ${words(name)} `))) return [];
    // Do not label an older upload as a current edition just because search returned it.
    const years = track.title.match(/\b(?:19|20)\d{2}\b/g)?.map(Number) ?? [];
    if (year && !years.includes(year)) return [];
    if (/\b(lineup|line up|tickets|reaction|reacts|predictions|trailer|aftermovie)\b/i.test(track.title)) return [];
    return [{ track, event, year: year ?? years[0] ?? null }];
  });
}
export async function loadEventSets(event: MusicEvent, year?: number, refresh = false): Promise<EventSet[]> {
  const tracks = await searchMusicVideos(`${event.name} ${year ?? ""} live full set performance`, refresh, true, 24);
  return matchEventSets(tracks, event, year).slice(0,12);
}
export async function loadRecentEventSets(refresh = false, now = new Date()): Promise<EventSet[]> {
  const year = now.getFullYear();
  const events = MUSIC_EVENTS.slice(0,4);
  const results = await Promise.allSettled(events.map(async event => {
    const current = await loadEventSets(event, year, refresh);
    return current.length ? current : loadEventSets(event, year - 1, refresh);
  }));
  if (results.every(result => result.status === "rejected")) throw new Error("Event videos unavailable");
  const lanes = results.flatMap(result => result.status === "fulfilled" && result.value.length ? [result.value] : [])
    .sort((a,b) => eventRecency(b[0]) - eventRecency(a[0]));
  const seen = new Set<string>(), mixed: EventSet[] = [];
  for (let i = 0; i < 6; i++) for (const lane of lanes) {
    const item = lane[i];
    if (item && !seen.has(item.track.id)) { seen.add(item.track.id); mixed.push(item); }
  }
  return mixed.sort((a,b) => (b.year ?? 0) - (a.year ?? 0));
}
