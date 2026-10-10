import type { AtlasGame } from "./igdb-data";
import type { GameMediaTarget } from "./cross-media";

export type StoryEntry = {
  key: string; name: string; year: number; month?: number; day?: number; endYear?: number;
  gameId?: number; originalId?: number; media?: GameMediaTarget; note?: "overlap" | "spans" | "autumn";
};
export const RESIDENT_EVIL_STORY_SOURCE = "https://game.capcom.com/residentevil/en/re-history.html";
// Capcom's published story timeline, through Village. Not a complete franchise catalog.
// Exact IGDB and Wikidata/TMDB identities verified 2026-09-30; see STORY-TIMELINES.md.
export const RESIDENT_EVIL_STORY: readonly StoryEntry[] = [
  { key: "zero", name: "Resident Evil 0", year: 1998, month: 7, day: 23, gameId: 15108 },
  { key: "one", name: "Resident Evil", year: 1998, month: 7, day: 24, gameId: 8254, originalId: 424 },
  { key: "three", name: "Resident Evil 3", year: 1998, month: 9, day: 28, gameId: 115115, originalId: 966, note: "overlap" },
  { key: "two", name: "Resident Evil 2", year: 1998, month: 9, day: 29, gameId: 19686, originalId: 880, note: "overlap" },
  { key: "outbreak", name: "Resident Evil Outbreak", year: 1998, month: 9, gameId: 972 },
  { key: "outbreak2", name: "Resident Evil Outbreak File #2", year: 1998, month: 9, gameId: 973 },
  { key: "veronica", name: "Resident Evil Code: Veronica", year: 1998, month: 12, gameId: 968 },
  { key: "darkside", name: "Resident Evil: The Darkside Chronicles", year: 1998, endYear: 2002, gameId: 497, note: "spans" },
  { key: "umbrella", name: "Resident Evil: The Umbrella Chronicles", year: 1998, endYear: 2003, gameId: 975, note: "spans" },
  { key: "four", name: "Resident Evil 4", year: 2004, gameId: 132181, originalId: 974, note: "autumn" },
  { key: "revelations", name: "Resident Evil: Revelations", year: 2005, gameId: 150045 },
  { key: "degeneration", name: "Resident Evil: Degeneration", year: 2005, media: { kind: "movie", id: "tmdb:movie:13648", name: "Resident Evil: Degeneration", poster: "https://images.metahub.space/poster/medium/tt1174954/img" } },
  { key: "darkness", name: "Resident Evil: Infinite Darkness", year: 2006, media: { kind: "series", id: "tmdb:tv:110642", name: "Resident Evil: Infinite Darkness", poster: "https://images.metahub.space/poster/medium/tt13173144/img" } },
  { key: "five", name: "Resident Evil 5", year: 2009, month: 3, gameId: 847 },
  { key: "revelations2", name: "Resident Evil: Revelations 2", year: 2011, gameId: 7725 },
  { key: "damnation", name: "Resident Evil: Damnation", year: 2011, media: { kind: "movie", id: "tmdb:movie:133121", name: "Resident Evil: Damnation", poster: "https://images.metahub.space/poster/medium/tt1753496/img" } },
  { key: "six", name: "Resident Evil 6", year: 2013, month: 6, gameId: 1082 },
  { key: "vendetta", name: "Resident Evil: Vendetta", year: 2014, media: { kind: "movie", id: "tmdb:movie:400136", name: "Resident Evil: Vendetta", poster: "https://images.metahub.space/poster/medium/tt5776208/img" } },
  { key: "seven", name: "Resident Evil 7: Biohazard", year: 2017, month: 7, gameId: 19562 },
  { key: "village", name: "Resident Evil Village", year: 2021, month: 2, gameId: 55163 },
];
export const residentEvilStoryAvailable = (game: Pick<AtlasGame, "franchises">) => game.franchises.some(item => item.id === 29);
export function storyDate(entry: StoryEntry, language: string) {
  if (entry.endYear) return `${entry.year}–${entry.endYear}`;
  return new Intl.DateTimeFormat(language, { year: "numeric", ...(entry.month ? { month: "short" as const } : {}), ...(entry.day ? { day: "numeric" as const } : {}), timeZone: "UTC" }).format(new Date(Date.UTC(entry.year, (entry.month ?? 1) - 1, entry.day ?? 1)));
}
