/**
 * The viewer's own sports order and game-day focus, which shape the Sports Hub: the Top 10, the
 * hero slider and the "Also today" sections lead with the sports you rank highest, and on a focus
 * day (college football on Saturday, NFL on Sunday, Monday and Thursday nights) that sport comes
 * first. Sports you switch off stay out of the Top 10 unless one of your teams is playing.
 * Plain module, no I/O.
 */

/** Every league the hub ranks, in the default order, with the label shown in settings. */
export const SPORT_CHOICES: ReadonlyArray<{ league: string; label: string }> = [
  { league: "NCAAF", label: "College football" },
  { league: "NFL", label: "NFL" },
  { league: "NBA", label: "NBA" },
  { league: "NCAAB", label: "College basketball" },
  { league: "MLB", label: "MLB" },
  { league: "NHL", label: "NHL" },
  { league: "EPL", label: "Premier League" },
  { league: "UCL", label: "Champions League" },
  { league: "MLS", label: "MLS" },
];

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export type DayFocus = Partial<Record<Weekday, string[]>>;

/** Football's week: college on Saturday, the NFL on Sunday, Monday night and Thursday night. */
export const DEFAULT_DAY_FOCUS: DayFocus = {
  Thu: ["NFL"],
  Sat: ["NCAAF"],
  Sun: ["NFL"],
  Mon: ["NFL"],
};

const KNOWN = new Set(SPORT_CHOICES.map((c) => c.league));

/** A saved order with unknown leagues and repeats removed; the default when nothing usable is saved. */
export function normalizePriority(value: unknown): string[] {
  if (!Array.isArray(value)) return SPORT_CHOICES.map((c) => c.league);
  const out: string[] = [];
  for (const v of value) if (typeof v === "string" && KNOWN.has(v) && !out.includes(v)) out.push(v);
  return out;
}

export function normalizeDayFocus(value: unknown): DayFocus {
  if (!value || typeof value !== "object") return DEFAULT_DAY_FOCUS;
  const out: DayFocus = {};
  for (const day of WEEKDAYS) {
    const list = normalizePriority((value as Record<string, unknown>)[day] ?? []);
    if (list.length) out[day] = list;
  }
  return out;
}

/** The weekday in the viewer's own time zone. */
export function weekdayOf(now: Date): Weekday {
  return WEEKDAYS[(now.getDay() + 6) % 7];
}

export type SportPrefs = { priority: string[]; dayFocus: DayFocus };

/**
 * How much a league counts today: the focus sports first, then your order from the top. Null
 * when the league is switched off (only your own teams' games get through).
 */
export function leagueWeight(league: string, prefs: SportPrefs, now: Date): number | null {
  const at = prefs.priority.indexOf(league);
  if (at < 0) return null;
  const focus = prefs.dayFocus[weekdayOf(now)] ?? [];
  // 8 points a place, so the order matters without outweighing a ranked matchup or a live game.
  const order = (prefs.priority.length - at) * 8;
  return focus.includes(league) ? 120 + order : order;
}

/** Leagues in the order the hub shows them today: focus sports, then your order. */
export function leaguesForToday(prefs: SportPrefs, now: Date): string[] {
  const focus = (prefs.dayFocus[weekdayOf(now)] ?? []).filter((l) => prefs.priority.includes(l));
  return [...focus, ...prefs.priority.filter((l) => !focus.includes(l))];
}

/** Moves a league one place up (-1) or down (+1) in the order. */
export function moveLeague(priority: string[], league: string, by: -1 | 1): string[] {
  const i = priority.indexOf(league);
  const j = i + by;
  if (i < 0 || j < 0 || j >= priority.length) return priority;
  const next = [...priority];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
