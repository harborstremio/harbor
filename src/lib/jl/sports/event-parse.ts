/**
 * Event channels: providers publish one channel per game and put the game in its name, e.g.
 *   "NCAAF 03: #1 Texas vs. #14 Tennessee @ 26 Sep 12:00 PM ET"
 *   "NCAAF 10: FOX College Football - Big Ten: Illinois at Ohio St. (FOX Sports) @ 26 Sep 12:00 PM ET"
 *   "USA ESPN+ 018: NCAA Football: #1 Texas vs. #14 Tennessee (2026-09-26 12:00:00)"
 *   "BIG10+ 07: Football UCLA at Maryland Sat @ Sep 26 04:30PM ET"
 * Ported from JL Media Vision's web app; plain module with no I/O.
 */

export type EventSport = "cfb" | "nfl";

export type EventTeam = { name: string; rank: number | null };

export type ParsedEvent = {
  sport: EventSport;
  /** Away/first-listed team, then home/second (for "A at B", B is home). */
  teams: [EventTeam, EventTeam];
  /** True when the name says "at" (second team is home). */
  atHome: boolean;
  start: Date;
  /** Broadcast network named in the channel ("FOX Sports", "FS1", "Big Ten Network"). */
  network: string | null;
  /** Spanish-language (or other alternate) feed. */
  alternate: boolean;
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const month = (m: string) => MONTHS.indexOf(m.slice(0, 3).toLowerCase());

/** Minutes America/New_York is behind UTC at an instant (240 in summer, 300 in winter). */
function nyOffsetMinutes(at: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
  );
  return Math.round((at.getTime() - asUtc) / 60000);
}

/** An Eastern wall-clock time as an instant. */
export function easternTime(year: number, monthIndex: number, day: number, hour: number, minute: number): Date {
  const guess = new Date(Date.UTC(year, monthIndex, day, hour, minute) + 240 * 60000);
  return new Date(Date.UTC(year, monthIndex, day, hour, minute) + nyOffsetMinutes(guess) * 60000);
}

const to24 = (h: number, ap: string) => (ap.toUpperCase() === "PM" ? (h % 12) + 12 : h % 12);

/** The year for a day/month without one: the one closest to now (handles Dec → Jan). */
function yearFor(monthIndex: number, now: Date): number {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  if (m === 11 && monthIndex === 0) return y + 1;
  if (m === 0 && monthIndex === 11) return y - 1;
  return y;
}

/** Pulls the kick-off out of the name; returns the start and the name without it. */
export function takeTime(name: string, now: Date): { start: Date; rest: string } | null {
  let m = /\s*@\s*(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{1,2}):(\d{2})\s*(AM|PM)\s*ET\s*$/i.exec(name);
  if (m) {
    const mi = month(m[2]);
    if (mi < 0) return null;
    return {
      start: easternTime(yearFor(mi, now), mi, Number(m[1]), to24(Number(m[3]), m[5]), Number(m[4])),
      rest: name.slice(0, m.index),
    };
  }
  m =
    /\s*(?:\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*)?@\s*([A-Za-z]{3})[a-z]*\s+(\d{1,2})\s+(\d{1,2}):(\d{2})\s*(AM|PM)\s*ET\s*$/i.exec(
      name,
    );
  if (m) {
    const mi = month(m[1]);
    if (mi < 0) return null;
    return {
      start: easternTime(yearFor(mi, now), mi, Number(m[2]), to24(Number(m[3]), m[5]), Number(m[4])),
      rest: name.slice(0, m.index),
    };
  }
  m = /\s*\((\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::\d{2})?\)\s*$/.exec(name);
  if (m) {
    return {
      start: easternTime(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])),
      rest: name.slice(0, m.index),
    };
  }
  return null;
}

function team(raw: string): EventTeam | null {
  const m = /^(?:#\s*|No\.\s*)(\d{1,2})\s+(.+)$/i.exec(raw.trim());
  const name = (m ? m[2] : raw).trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 60) return null;
  return { name, rank: m ? Number(m[1]) : null };
}

const CONFERENCE_FOOTBALL =
  /^(big|b1g|sec|acc|pac|mac|mountain|sun ?belt|american|c-?usa|ivy|patriot|big sky|swac|meac|caa|southland).*football/i;
const OTHER_SPORT =
  /^(soccer|volleyball|hockey|ice hockey|swimming|field hockey|tennis|basketball|lacrosse|wrestling|golf|cross country|press conference)\b/i;

/**
 * Parses an event channel name. `category` is the provider's group (e.g. "USA NCAAF",
 * "ESPN Events 200 VIP channels", "USA BIG10+", "USA NFL - Sunday Ticket"): it decides the sport.
 */
export function parseEventChannel(name: string, category: string, now = new Date()): ParsedEvent | null {
  // Multi-game "multiview" feeds ("KSU vs. CIN • APP vs. NCSU") aren't one game.
  if (name.includes("•")) return null;
  const t = takeTime(name.trim(), now);
  if (!t) return null;
  // Channel number prefix: "NCAAF 03:", "USA ESPN+ 018:", "BIG10+ 07:", "NFL 04:".
  let body = t.rest.replace(/^[^:]{0,40}?\d{1,3}\s*:\s*/, "").trim();

  const cfbCategory = /NCAAF|BIG ?10\+|SEC\+|ACC ?EXTRA/i.test(category);
  const nflCategory = /\bNFL\b/i.test(category);
  // A league/show label before the teams: "NCAA Football: ", "FOX College Football - Big Ten: ".
  const label = /^(.*?(?:Football|NFL|NCAAF)[^:]*):\s*/i.exec(body) ?? /^(.*?Football)\s*-\s*/i.exec(body);
  let labelText = "";
  if (label) {
    labelText = label[1];
    body = body.slice(label[0].length);
  } else if (/^Football\s+/i.test(body)) {
    labelText = "Football";
    body = body.replace(/^Football\s+/i, "");
  }

  let sport: EventSport | null = null;
  if (nflCategory || /\bNFL\b/i.test(labelText)) sport = "nfl";
  else if (
    cfbCategory ||
    /college football|ncaa football|ncaaf/i.test(labelText) ||
    CONFERENCE_FOOTBALL.test(labelText) ||
    /^football$/i.test(labelText)
  ) {
    sport = "cfb";
  }
  if (!sport) return null;
  // In a football-only category, an unlabelled other-sport event ("Soccer (M) ...") is not a game here.
  if (OTHER_SPORT.test(body) || /press conference|postgame|pregame|highlights|replay/i.test(body)) return null;

  let network: string | null = null;
  let alternate = false;
  for (;;) {
    const p = /\s*\(([^()]{1,40})\)\s*$/.exec(body);
    if (!p) break;
    const inner = p[1].trim();
    if (/^(ESP|ESPA[NÑ]OL|SPANISH|ALT|ALTERNATE|FR|FRENCH)$/i.test(inner)) alternate = true;
    else network = network ?? inner;
    body = body.slice(0, p.index).trim();
  }
  body = body.replace(/\s+(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/i, "").trim();

  const split = /^(.+?)\s+(vs\.?|v\.?|at|@)\s+(.+)$/i.exec(body);
  if (!split) return null;
  const a = team(split[1]);
  const b = team(split[3]);
  if (!a || !b) return null;
  return { sport, teams: [a, b], atHome: /^(at|@)$/i.test(split[2]), start: t.start, network, alternate };
}

/** Loose team key for matching across sources ("Ohio St." = "Ohio State", "Hawai'i" = "Hawaii"). */
export function teamKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/&/g, " and ")
    .replace(/\b(university|univ|college|the)\b/g, " ")
    .replace(/\bst\b(?=\s*$)/, "state")
    .replace(/\bst\b/g, "saint")
    .replace(/[^a-z0-9()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
