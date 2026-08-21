import { type CalendarFilter, type CalendarItem, type CalendarPosterSize } from "@/lib/calendar";
import { type LibraryItem } from "@/lib/stremio";
import type { Meta } from "@/lib/cinemeta";
import type { Cell } from "./types";

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function orderedWeekdayNames(weekStartsMonday: boolean): string[] {
  if (!weekStartsMonday) return WEEKDAY_NAMES;
  return [...WEEKDAY_NAMES.slice(1), WEEKDAY_NAMES[0]];
}

export const FILTERS: Array<{ id: CalendarFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "movie", label: "Movies" },
  { id: "tv", label: "TV" },
  { id: "anime", label: "Anime" },
];

export const CALENDAR_POSTER_SIZES: Array<{ value: CalendarPosterSize; label: string }> = [
  { value: "default", label: "Default" },
  { value: "large", label: "Large" },
];

export function isUpcoming(item: CalendarItem): boolean {
  return item.releaseAtMs != null && item.releaseAtMs > Date.now();
}

export function calendarToMeta(item: CalendarItem): Meta {
  return {
    id: calendarBaseId(item.id),
    type: item.type === "tv" ? "series" : "movie",
    name: calendarBaseName(item.name),
    poster: item.poster ?? undefined,
    background: item.background ?? undefined,
    description: item.overview,
    releaseInfo: item.releaseDate.slice(0, 4),
    releaseDate: item.releaseDate,
  };
}

export function calendarEpisodeHint(item: CalendarItem): { season: number; episode: number } | null {
  const m = item.id.match(/:(\d+):(\d+)$/);
  if (!m) return null;
  return { season: Number(m[1]), episode: Number(m[2]) };
}

function calendarBaseId(id: string): string {
  return id.replace(/:(\d+):(\d+)$/, "").replace(/:premiere$/, "");
}

function calendarBaseName(name: string): string {
  return name.replace(/ S\d{2,}E\d{2,}.*$/, "").replace(/ \(premiere\)$/, "");
}

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’‘“”'"`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function buildLibraryNameSet(items: LibraryItem[]): Set<string> {
  const out = new Set<string>();
  for (const item of items) {
    if (item.removed && !item.temp) continue;
    if (!item.name) continue;
    const t = item.type === "series" ? "tv" : "movie";
    out.add(`${normalizeName(item.name)}::${t}`);
  }
  return out;
}

export function buildMonthCells(year: number, month: number, weekStartsMonday = false): Cell[] {
  const first = new Date(year, month, 1);
  const weekStart = weekStartsMonday ? 1 : 0;
  const leadOffset = (first.getDay() - weekStart + 7) % 7;
  const start = new Date(year, month, 1 - leadOffset);
  const cells: Cell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    cells.push({ date: d, iso, inMonth: d.getMonth() === month });
  }
  return cells;
}

export function formatDateLong(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
