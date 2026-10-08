/**
 * College athletics sites on SIDEARM Sports (most NCAA and NAIA schools, e.g. gallaudetbison.com).
 * Everything read here is public on the school's own site: the calendar feed (every game with its
 * result and "Streaming Video" link), the sports list, rosters, player bios and the news feed.
 * Pure parsers and URL builders, no I/O.
 */

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const validSlug = (s: string): boolean => SLUG.test(s) && s.length <= 60;

export const calendarUrl = (site: string) =>
  `https://${site}/calendar.ashx/calendar.ics?sport_id=0`;
export const newsUrl = (site: string) => `https://${site}/rss?path=general`;
export const rosterUrl = (site: string, slug: string) => `https://${site}/sports/${slug}/roster`;
export const homeUrl = (site: string) => `https://${site}/`;
/** Most SIDEARM sites publish their mark here; callers fall back to a monogram when it fails. */
export const logoUrl = (site: string) => `https://${site}/images/logos/site/site.png`;

const ENTITIES: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
};

export function decodeHtml(s: string): string {
  return s
    .replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const code =
          e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code < 0x110000
          ? String.fromCodePoint(code)
          : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, " ")
    .trim();
}

const https = (u: string | null | undefined): string | null =>
  u && /^https:\/\/\S{1,600}$/.test(u) ? u : null;

/** "mens-basketball" → "Men's Basketball". */
export function sportName(slug: string): string {
  return slug
    .replace(/^mens-/, "men's-")
    .replace(/^womens-/, "women's-")
    .split("-")
    .map((w) => (w === "and" ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/** Comparable sport text: "Men's Swimming & Diving" ≈ "mens-swimming-and-diving". */
export function sportKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// ---- Calendar ------------------------------------------------------------------------

export type SchoolEvent = {
  id: string;
  /** "Football", "Men's Basketball" (from "<School> <Sport> vs|at <Opponent>"). */
  sport: string | null;
  sportId: string | null;
  /** ISO time in UTC (all-day games at 12:00 UTC). */
  start: string;
  allDay: boolean;
  title: string;
  opponent: string | null;
  home: boolean | null;
  location: string | null;
  result: "W" | "L" | "T" | null;
  score: string | null;
  /** The school's own stream page (or direct stream) for this game. */
  stream: string | null;
  url: string | null;
};

const unfold = (ics: string) => ics.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
const icsText = (v: string) => v.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");

/** Offset (ms) of a time zone from UTC at an instant; 0 when the zone is unknown. */
function zoneOffset(tz: string, utcMs: number): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(new Date(utcMs));
    const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    return (
      Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second")) - utcMs
    );
  } catch {
    return 0;
  }
}

/** DTSTART value (+ optional TZID) → UTC ISO string and whether it is all-day. */
export function icsStart(
  value: string,
  tzid: string | null,
): { start: string; allDay: boolean } | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/.exec(value);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  if (!m[4]) return { start: new Date(Date.UTC(y, mo, d, 12)).toISOString(), allDay: true };
  const wall = Date.UTC(y, mo, d, Number(m[4]), Number(m[5]), Number(m[6]));
  if (m[7] || !tzid) return { start: new Date(wall).toISOString(), allDay: false };
  // Wall-clock time in the school's zone: correct by the zone's offset (twice, for DST edges).
  let utc = wall - zoneOffset(tzid, wall);
  utc = wall - zoneOffset(tzid, utc);
  return { start: new Date(utc).toISOString(), allDay: false };
}

/** The school's whole athletics calendar (calendar.ics), oldest first; null if it isn't one. */
export function parseCalendar(ics: string): { school: string; events: SchoolEvent[] } | null {
  if (!ics.includes("BEGIN:VCALENDAR")) return null;
  const flat = unfold(ics);
  const school =
    /X-WR-CALNAME:(.+)/
      .exec(flat)?.[1]
      ?.replace(/\s+Athletics\s*$/i, "")
      .trim() ?? "";
  const seen = new Set<string>();
  const events: SchoolEvent[] = [];
  for (const block of flat.split("BEGIN:VEVENT").slice(1)) {
    const line = (name: string) => new RegExp(`^${name}((?:;[^:\\n]*)?):(.*)$`, "m").exec(block);
    const field = (name: string) => line(name)?.[2] ?? null;
    const summary = icsText(field("SUMMARY") ?? "").trim();
    const dt = line("DTSTART");
    const tzid = dt ? (/;TZID=([^;:]+)/i.exec(dt[1])?.[1] ?? null) : null;
    const when = dt ? icsStart(dt[2].trim(), tzid) : null;
    if (!summary || !when) continue;
    const description = icsText(field("DESCRIPTION") ?? "");
    const url = decodeHtml(field("URL") ?? "");
    const title = summary.replace(/^\[[A-Z]\]\s*/, "");
    const result = (/^\[(W|L|T)\]/.exec(summary)?.[1] as SchoolEvent["result"] | undefined) ?? null;
    const matchup = /\s(vs\.?|at)\s+(.+)$/i.exec(title);
    const sport =
      school && title.startsWith(`${school} `) && matchup
        ? title.slice(school.length + 1, matchup.index).trim() || null
        : null;
    const gameId = /game_id=(\d+)/.exec(url)?.[1];
    const id = gameId ? `g:${gameId}` : `${when.start}|${title}`;
    if (seen.has(id)) continue;
    seen.add(id);
    events.push({
      id,
      sport,
      sportId: /sport_id=(\d+)/.exec(url)?.[1] ?? null,
      start: when.start,
      allDay: when.allDay,
      title,
      opponent: matchup?.[2]?.trim() || null,
      home: matchup ? !/^at$/i.test(matchup[1]) : null,
      location: icsText(field("LOCATION") ?? "").trim() || null,
      result,
      score: result ? (/\n[WLT],? ([0-9]+-[0-9]+)/.exec(`\n${description}`)?.[1] ?? null) : null,
      stream: https(/Streaming Video:\s*(\S+)/i.exec(description)?.[1]),
      url: https(url),
    });
  }
  return { school, events: events.sort((a, b) => a.start.localeCompare(b.start)) };
}

/** A sport's games: by the calendar's sport name, matching a site slug or a calendar name. */
export function eventsForSport(events: readonly SchoolEvent[], sport: string): SchoolEvent[] {
  const want = sportKey(validSlug(sport) ? sportName(sport) : sport);
  const exact = events.filter((e) => e.sport && sportKey(e.sport) === want);
  if (exact.length) return exact;
  // "mens-swimming-and-diving" vs a calendar that says "Men's Swimming".
  return events.filter((e) => {
    const k = e.sport ? sportKey(e.sport) : "";
    return !!k && (want.startsWith(`${k} `) || k.startsWith(`${want} `));
  });
}

/** Sports on the calendar, by name. */
export function calendarSports(events: readonly SchoolEvent[]): string[] {
  return [...new Set(events.map((e) => e.sport).filter((s): s is string => !!s))].sort((a, b) =>
    a.localeCompare(b),
  );
}

/** Games not yet decided that started under `liveHours` ago, and decided games newest first. */
export function splitSeason(
  events: readonly SchoolEvent[],
  now: number,
  liveHours = 3.5,
): { upcoming: SchoolEvent[]; results: SchoolEvent[] } {
  const upcoming = events.filter(
    (e) => !e.result && Date.parse(e.start) > now - liveHours * 3600000,
  );
  const results = events.filter((e) => e.result).reverse();
  return { upcoming, results };
}

export function isLiveNow(e: SchoolEvent, now: number, liveHours = 3.5): boolean {
  if (e.result || e.allDay) return false;
  const start = Date.parse(e.start);
  return start <= now && now < start + liveHours * 3600000;
}

export function seasonRecord(events: readonly SchoolEvent[]): { W: number; L: number; T: number } {
  const r = { W: 0, L: 0, T: 0 };
  for (const e of events) if (e.result) r[e.result]++;
  return r;
}

/** "vs Opponent" / "at Opponent", or the title when the calendar doesn't say. */
export const matchupText = (e: SchoolEvent): string =>
  e.home === null || !e.opponent ? e.title : `${e.home ? "vs" : "at"} ${e.opponent}`;

/** A stream the player can open itself (HLS/DASH/progressive), rather than a web page. */
export function isDirectStream(url: string): boolean {
  try {
    return /\.(m3u8|mpd|mp4|m4v|webm|ts)$/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

// ---- Sports, rosters, bios -------------------------------------------------------------

/** Sports the school lists (links to "/sports/<slug>/roster" or "/sports/<slug>/schedule"). */
export function parseSchoolSports(html: string): { slug: string; name: string }[] {
  const slugs = new Set<string>();
  for (const m of html.matchAll(
    /href="(?:https?:\/\/[^"/]+)?\/sports\/([a-z0-9-]+)\/(?:roster|schedule)"/g,
  )) {
    if (validSlug(m[1])) slugs.add(m[1]);
  }
  return [...slugs]
    .map((slug) => ({ slug, name: sportName(slug) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The site's slug for a calendar sport name ("Men's Swimming" → "mens-swimming-and-diving"). */
export function slugForSport(
  name: string,
  sports: readonly { slug: string; name: string }[],
): string | null {
  const want = sportKey(name);
  return (
    sports.find((s) => sportKey(s.name) === want)?.slug ??
    sports.find((s) => sportKey(s.name).startsWith(`${want} `))?.slug ??
    null
  );
}

export type RosterPlayer = {
  id: string;
  name: string;
  number: string | null;
  position: string | null;
  year: string | null;
  hometown: string | null;
  highSchool: string | null;
  height: string | null;
  weight: string | null;
  photo: string | null;
  profile: string | null;
};

/** A SIDEARM roster page → its players (empty when the markup isn't a SIDEARM roster). */
export function parseRoster(html: string, site: string): RosterPlayer[] {
  const players: RosterPlayer[] = [];
  const seen = new Set<string>();
  for (const chunk of html.split('<li class="sidearm-roster-player').slice(1)) {
    const block = chunk.split("</li>")[0];
    const id = /data-player-id="(\d+)"/.exec(block)?.[1];
    const path = /data-player-url="(\/sports\/[^"]+)"/.exec(block)?.[1];
    const name = decodeHtml(
      /aria-label="([^"]+?)\s*-\s*View (?:Full Bio|Profile)/.exec(block)?.[1] ??
        /alt="([^"]+?)\s*-\s*View Profile"/.exec(block)?.[1] ??
        "",
    );
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    const span = (cls: string) => {
      const v = new RegExp(`class="${cls}[^"]*"[^>]*>([^<]*)<`).exec(block)?.[1];
      return v ? decodeHtml(v) || null : null;
    };
    const img =
      /data-src="([^"]+)"/.exec(block)?.[1] ?? /<img[^>]+src="(\/images\/[^"]+)"/.exec(block)?.[1];
    const photo = img
      ? img.startsWith("https://")
        ? img
        : img.startsWith("/")
          ? `https://${site}${img.replace(/\?.*$/, "")}?width=600&quality=90`
          : null
      : null;
    players.push({
      id,
      name,
      number: span("sidearm-roster-player-jersey-number"),
      position:
        decodeHtml(
          /sidearm-roster-player-position">\s*<span class="text-bold">([^<]*)</.exec(block)?.[1] ??
            "",
        ) ||
        span("sidearm-roster-player-position-long-short") ||
        null,
      year: span("sidearm-roster-player-academic-year"),
      hometown: span("sidearm-roster-player-hometown"),
      highSchool: span("sidearm-roster-player-highschool"),
      height: span("sidearm-roster-player-height"),
      weight: span("sidearm-roster-player-weight"),
      photo,
      profile: path ? `https://${site}${path}` : null,
    });
  }
  return players;
}

export type StatTable = { title: string; headers: string[]; rows: string[][] };
export type PlayerBio = { bio: string | null; stats: StatTable[] };

const cellText = (html: string) => decodeHtml(html.replace(/<[^>]+>/g, " "));

/** A player's bio page → the short bio and any statistics tables on it. */
export function parsePlayerBio(html: string, maxTables = 4, maxRows = 30): PlayerBio {
  const meta =
    /<meta[^>]+(?:property|name)="(?:og:)?description"[^>]+content="([^"]*)"/i.exec(html)?.[1] ??
    /<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="(?:og:)?description"/i.exec(html)?.[1] ??
    "";
  const bio = decodeHtml(meta);
  const stats: StatTable[] = [];
  const tables = html.split(/<table\b/i).slice(1);
  for (let i = 0; i < tables.length && stats.length < maxTables; i++) {
    const table = tables[i].split(/<\/table>/i)[0];
    const caption = cellText(/<caption[^>]*>([\s\S]*?)<\/caption>/i.exec(table)?.[1] ?? "");
    // The heading right before the table names it when there is no caption.
    const before = (i === 0 ? html.split(/<table\b/i)[0] : tables[i - 1]).slice(-600);
    const heading = cellText(
      [...before.matchAll(/<h[2-5][^>]*>([\s\S]*?)<\/h[2-5]>/gi)].pop()?.[1] ?? "",
    );
    const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((r) =>
      [...r[1].matchAll(/<t([hd])[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => ({
        th: c[1].toLowerCase() === "h",
        text: cellText(c[2]),
      })),
    );
    const headIdx = rows.findIndex((r) => r.length > 1 && r.every((c) => c.th));
    if (headIdx < 0) continue;
    const headers = rows[headIdx].map((c) => c.text);
    const body = rows
      .slice(headIdx + 1)
      .filter((r) => r.length === headers.length && r.some((c) => c.text))
      .slice(0, maxRows)
      .map((r) => r.map((c) => c.text));
    // Statistics tables have season rows of mostly numbers.
    const numeric = body.flat().filter((v) => /^-?[0-9.,:%/-]+$/.test(v)).length;
    if (!body.length || numeric < body.length) continue;
    stats.push({ title: caption || heading || "Statistics", headers, rows: body });
  }
  return { bio: bio.length >= 20 ? bio : null, stats };
}

// ---- News ----------------------------------------------------------------------------

export type SchoolStory = {
  url: string;
  title: string;
  image: string | null;
  sports: string[];
  published: string | null;
};

const xmlText = (v: string | undefined) =>
  decodeHtml((v ?? "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"));

const US_ZONES: Record<string, string> = {
  EST: "-0500",
  EDT: "-0400",
  CST: "-0600",
  CDT: "-0500",
  MST: "-0700",
  MDT: "-0600",
  PST: "-0800",
  PDT: "-0700",
};

/** The school's news feed (rss?path=general) → latest stories with the sports they're about. */
export function parseNews(xml: string, max = 30): SchoolStory[] {
  const rows: SchoolStory[] = [];
  const seen = new Set<string>();
  for (const item of xml.split(/<item>/i).slice(1)) {
    const tag = (name: string) =>
      xmlText(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(item)?.[1]);
    const url = https(tag("link"));
    const title = tag("title");
    if (!url || !title || seen.has(url)) continue;
    seen.add(url);
    const image = https(
      xmlText(
        /<enclosure[^>]*url="([^"]+)"/i.exec(item)?.[1] ??
          /<media:content[^>]*url="([^"]+)"/i.exec(item)?.[1],
      ),
    );
    const when = Date.parse(
      tag("pubDate").replace(/\s([A-Z]{3})$/, (z, k: string) =>
        US_ZONES[k] ? ` ${US_ZONES[k]}` : z,
      ),
    );
    const sports = tag("category")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && !/^general$/i.test(s))
      .slice(0, 12);
    rows.push({
      url,
      title: title.slice(0, 300),
      image,
      sports,
      published: Number.isFinite(when) ? new Date(when).toISOString() : null,
    });
    if (rows.length >= max) break;
  }
  return rows;
}

/** Stories about a sport (by the feed's categories); every story when no sport is chosen. */
export function newsForSport(stories: readonly SchoolStory[], sport: string | null): SchoolStory[] {
  if (!sport) return [...stories];
  const want = sportKey(sport);
  return stories.filter((s) => s.sports.some((c) => sportKey(c) === want));
}
