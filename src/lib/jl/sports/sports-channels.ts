import type { IptvChannel } from "../../iptv/types.ts";
import { parseEventChannel, takeTime } from "./event-parse.ts";

/**
 * Live Sports Channels: which of the viewer's own IPTV channels carry sport, what sport, and
 * which event/PPV feeds have a game on now. Plain module, no I/O; the EPG comes in as a callback.
 *
 * Providers name channels messily ("US| ESPN FHD", "UK: Sky Sports Main Event [HD]",
 * "🏈 NFL NETWORK *", "NCAAF 03: Texas vs. Tennessee @ 26 Sep 12:00 PM ET"), so names are
 * cleaned first and the same channel on two providers (or in HD and FHD) becomes one entry.
 */

export type SportCategory =
  | "football"
  | "basketball"
  | "baseball"
  | "hockey"
  | "soccer"
  | "combat"
  | "college"
  | "racing"
  | "golf-tennis"
  | "other";

export const SPORT_CATEGORIES: SportCategory[] = [
  "football",
  "basketball",
  "baseball",
  "hockey",
  "soccer",
  "combat",
  "college",
  "racing",
  "golf-tennis",
  "other",
];

export const SPORT_LABELS: Record<SportCategory, string> = {
  football: "Football",
  basketball: "Basketball",
  baseball: "Baseball",
  hockey: "Hockey",
  soccer: "Soccer",
  combat: "Combat",
  college: "College",
  racing: "Racing",
  "golf-tennis": "Golf & Tennis",
  other: "Other",
};

// ---------------------------------------------------------------------------------------------
// Name cleaning

const COUNTRY_CODES =
  "USA|US|UK|GB|CAN|CA|AU|NZ|IE|FR|DE|IT|ES|PT|BR|MX|NL|BE|SE|NO|DK|FI|PL|TR|IN|ARAB|AR|CL|CO|PE|LATAM|LATINO|LAT|EU|EN|AFR";
const COUNTRY_ALIASES: Record<string, string> = {
  USA: "US",
  GB: "UK",
  CAN: "CA",
  LATINO: "LATAM",
  LAT: "LATAM",
};
// "US|", "UK:", "|US| ", "US - ", "[US]", "(UK)" at the start.
const COUNTRY_PREFIX = new RegExp(`^[|\\[(]?\\s*(${COUNTRY_CODES})\\s*(?:[|\\]):»►•-]+)\\s*`, "i");
// "USA ESPN", "UK Sky Sports": no separator, so only the common ones and never "USA Network"/"US Open".
const COUNTRY_WORD = /^(USA|US|UK|CA)\s+(?!(NETWORK|NET|OPEN|TODAY)\b)(?=\S{2})/i;
const EMOJI = /\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}\u2600-\u27BF]|\uFE0F|\u200D/gu;
// Superscript quality marks some lists use ("ᴴᴰ", "ᶠᴴᴰ", "⁴ᴷ").
const SUPERSCRIPT = /[\u1D2C-\u1D6A\u1D9C-\u1DBF\u02B0-\u02FF\u2070-\u209F]+/g;
const QUALITY =
  /\b(UHD|FHD|HD|SD|4K|8K|HEVC|H\.?26[45]|1080[PI]?|720P|2160P|50FPS|60FPS|RAW|HDR)\b/gi;
const BACKUP = /\b(BACK ?UP|BACKUP ?\d*|ALT(ERNATE)?|B\/U)\b|\(B\)/gi;

export type CleanName = {
  /** Display name without country tags, quality marks or emoji ("ESPN 2"). */
  clean: string;
  /** Country tag from the prefix ("US", "UK"), when there was one. */
  country: string | null;
  backup: boolean;
};

export function cleanChannelName(raw: string): CleanName {
  // Superscripts first: NFKC would turn "ᴴᴰ" into a glued-on "HD".
  let s = raw.replace(SUPERSCRIPT, " ").normalize("NFKC").replace(EMOJI, " ");
  let country: string | null = null;
  for (let i = 0; i < 3; i++) {
    const trimmed = s.trim();
    const m = COUNTRY_PREFIX.exec(trimmed) ?? COUNTRY_WORD.exec(trimmed);
    if (!m) break;
    const code = m[1].toUpperCase();
    country = country ?? COUNTRY_ALIASES[code] ?? code;
    s = trimmed.slice(m[0].length);
  }
  // Remaining [tags] and (quality) groups: "[FHD]", "(US)", "[Multi-Audio]".
  s = s.replace(/\[[^\]]*\]/g, " ");
  s = s.replace(new RegExp(`\\((?:${COUNTRY_CODES})\\)`, "gi"), " ");
  const backup = BACKUP.test(s) || /\*\s*$/.test(s);
  BACKUP.lastIndex = 0;
  s = s.replace(/\(\s*(UHD|FHD|HD|SD|4K|HEVC|BACK ?UP|ALT)\s*\)/gi, " ");
  s = s.replace(QUALITY, " ").replace(BACKUP, " ");
  s = s.replace(/[*_~`]+|#{2,}/g, " ").replace(/\s+/g, " ");
  s = s.replace(/^[\s|:•»►\-–—]+|[\s|:•»►\-–—]+$/g, "").trim();
  return { clean: s || raw.trim(), country, backup };
}

/** Same channel, different provider or quality: "US: ESPN HD" and "USA| ESPN FHD *" share a key. */
export function channelKey(name: string): string {
  const { clean, country } = cleanChannelName(name);
  return keyOf(clean, country);
}

function keyOf(clean: string, country: string | null): string {
  const base = clean
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\+/g, "plus")
    .replace(/[^a-z0-9]+/g, "");
  return `${country ?? ""}|${base}`;
}

/** Channel ids are "<sourceId>::<id>" (see favorites). */
export function sourceIdOf(channelId: string): string {
  return channelId.split("::")[0] ?? "";
}

// ---------------------------------------------------------------------------------------------
// Is it sport, and which

const SPORTS_GROUP =
  /\b(SPORTS?|SPORTV|DEPORTES?|ESPORTES?|ESPN\w*|NFL|NBA|WNBA|NHL|MLB|MILB|NCAA[FB]?|UFC|MMA|PPV|PAY ?PER ?VIEW|EVENTS?|DAZN|FANATIZ|FLO ?SPORTS|F1|FORMULA ?1|FOOTBALL|SOCCER|FUTBOL|GOLF|TENNIS|RACING|NASCAR|BOXING|WWE|AEW|CRICKET|RUGBY|BEIN|TSN|PREMIER LEAGUE|EPL|LA ?LIGA|UEFA|SETANTA|BT SPORT|SUNDAY TICKET|LEAGUE PASS|CENTER ICE|EXTRA INNINGS|RED ?ZONE|SEASON PASS|GAME ?PASS|MLS|BUNDESLIGA|SERIE A|LIGUE 1|HOCKEY|BASKETBALL|BASEBALL|MOTORSPORTS?|CYCLING|DARTS|SNOOKER|OLYMPICS?|B1G|BIG ?10|ACC ?(NETWORK|EXTRA)|SEC ?NETWORK)\b|\b(ESPN|SEC|BIG ?10|B1G|NFL)\+/i;
// Groups that are something else even when they say "events" or "PPV".
const NON_SPORT_GROUP =
  /\b(MOVIES?|FILMS?|CINEMA|VOD|SERIES|KIDS|MUSIC|CONCERTS?|RADIO|ADULTS?|XXX|18\+|RELIGIO\w*|NEWS)\b/i;
const SPORTS_NAME =
  /\b(SPORTS?|SPORTV|DEPORTES|ESPN\w*|FS[12]|FOX SOCCER|NFL|NBA|WNBA|NHL|MLB|MILB|NCAA\w*|UFC|WWE|AEW|PPV|RED ?ZONE|BIG TEN|BTN|SEC NETWORK|SECN|ACC NETWORK|ACCN|PAC-?12|CBSSN|NBCSN|GOLF|TENNIS|BEIN|EUROSPORT|TSN\d?|SPORTSNET|DAZN|FANATIZ|TUDN|NESN|YES NETWORK|MSG\d?|MARQUEE|SNY|MASN|ALTITUDE|STADIUM|WILLOW|SUPERSPORT|SETANTA|F1|NASCAR|INDYCAR|MOTOGP|FIGHT NETWORK|TVG|FLOSPORTS|LONGHORN NETWORK|PREMIER LEAGUE|LALIGA|BUNDESLIGA|SERIE A|LIGUE 1|UEFA|CHAMPIONS LEAGUE|BASKETBALL|BASEBALL|HOCKEY|SOCCER|FOOTBALL|FUTBOL|BOXING|MMA|WRESTLING|RUGBY|CRICKET|CYCLING|DARTS|SNOOKER|MOTORSPORTS?|RACING|NHRA|SUPERCROSS|PGA|LPGA|ATP|WTA|WIMBLEDON|LEAGUE PASS|SUNDAY TICKET|CENTER ICE|EXTRA INNINGS|PFL|BELLATOR|LIGA MX|MLS|EPL|EFL)\b|\b(ESPN|SEC|BIG ?10|B1G|NFL)\+/i;

type Rule = [SportCategory, RegExp];

const RULES: Rule[] = [
  [
    "college",
    /\b(NCAA[FB]?|COLLEGE|CFB|CBB|BIG ?TEN|BIG ?10|B1G|BTN|SEC ?NETWORK|SECN|ACC ?NETWORK|ACCN|ACC ?EXTRA|PAC-?12|BIG ?12|BIG EAST|ESPNU|LONGHORN NETWORK|FLOSPORTS)\b|\b(SEC|BIG ?10|B1G)\+/i,
  ],
  ["football", /\b(NFL|RED ?ZONE|SUNDAY TICKET|CFL|UFL|XFL|AMERICAN FOOTBALL)\b|\bNFL\+/i],
  ["basketball", /\b(NBA|WNBA|BASKETBALL|LEAGUE PASS|EUROLEAGUE|G ?LEAGUE)\b/i],
  ["baseball", /\b(MLB|MILB|BASEBALL|EXTRA INNINGS)\b/i],
  ["hockey", /\b(NHL|HOCKEY|CENTER ICE|KHL|AHL)\b/i],
  [
    "soccer",
    /\b(SOCCER|FUTBOL|FÚTBOL|FUTEBOL|PREMIER LEAGUE|EPL|LA ?LIGA|BUNDESLIGA|SERIE A|LIGUE 1|UEFA|CHAMPIONS LEAGUE|EUROPA LEAGUE|MLS|NWSL|FIFA|LIGA MX|EREDIVISIE|FANATIZ|TUDN|BEIN|FA CUP|EFL|CONCACAF|CONMEBOL|COPA|LIGA|MUTV|LFC TV)\b/i,
  ],
  [
    "combat",
    /\b(UFC|MMA|BOXING|WWE|AEW|PFL|BELLATOR|FIGHT|FIGHTS|FIGHTING|WRESTLING|TOP RANK|BKFC|ONE CHAMPIONSHIP|KICKBOXING|FITE|PBC)\b/i,
  ],
  [
    "racing",
    /\b(F1|FORMULA ?1|FORMULA|NASCAR|INDYCAR|MOTOGP|MOTO ?GP|RACING|MOTORSPORTS?|SUPERCROSS|MOTOCROSS|NHRA|WRC|MOTOR ?TREND|SPEED|TVG|GRAND PRIX)\b/i,
  ],
  [
    "golf-tennis",
    /\b(GOLF|PGA|LPGA|LIV|TENNIS|ATP|WTA|WIMBLEDON|ROLAND GARROS|US OPEN|RYDER CUP)\b/i,
  ],
];

// Where "football" means soccer.
const SOCCER_COUNTRIES = new Set([
  "UK",
  "IE",
  "FR",
  "DE",
  "IT",
  "ES",
  "PT",
  "BR",
  "MX",
  "NL",
  "BE",
  "SE",
  "NO",
  "DK",
  "FI",
  "PL",
  "TR",
  "AR",
  "CL",
  "CO",
  "PE",
  "LATAM",
  "EU",
  "AFR",
  "ARAB",
  "IN",
  "AU",
  "NZ",
  "EN",
]);

function countryOfText(text: string): string | null {
  const m = new RegExp(`(?:^|[^A-Z])(${COUNTRY_CODES})(?:$|[^A-Z])`).exec(text.toUpperCase());
  return m ? (COUNTRY_ALIASES[m[1]] ?? m[1]) : null;
}

/** The sport a piece of text (a channel name, group or programme title) is about, if it says. */
export function sportOfText(text: string, country: string | null = null): SportCategory | null {
  if (!text) return null;
  for (const [sport, re] of RULES) if (re.test(text)) return sport;
  if (/\bFOOTBALL\b/i.test(text)) {
    const c = country ?? countryOfText(text);
    return c && SOCCER_COUNTRIES.has(c) ? "soccer" : "football";
  }
  return null;
}

function sportsGroup(group: string | null): boolean {
  const g = group ?? "";
  return SPORTS_GROUP.test(g) && !NON_SPORT_GROUP.test(g.replace(/SPORTS? NEWS/i, ""));
}

// Section dividers some lists ship as channels: "##### SPORTS #####".
const DIVIDER = /#{3,}|={3,}|-{4,}|\*{3,}|\u2501|\u2550/;

export function isSportsChannel(name: string, group: string | null): boolean {
  if (DIVIDER.test(name)) return false;
  return SPORTS_NAME.test(cleanChannelName(name).clean) || sportsGroup(group);
}

// ---------------------------------------------------------------------------------------------
// Event / PPV feeds

const EVENT_GROUP =
  /\b(PPV|PAY ?PER ?VIEW|EVENTS?|FANATIZ|FLO ?SPORTS|ACC ?EXTRA|SUNDAY TICKET|LEAGUE PASS|CENTER ICE|EXTRA INNINGS|MLB\.?TV|NHL\.?TV|SEASON PASS|GAME ?PASS|NCAAF|NCAAB|PEACOCK|PARAMOUNT|PRIME|VICTORY|FUBO|MATCH ?DAY|GAME ?DAY|FIGHT ?PASS|ESPN PLUS)\b|\b(ESPN|SEC|BIG ?10|B1G|NFL)\+/i;
// "NCAAF 03:", "USA ESPN+ 018:", "PPV 4 -", "NBA 01 |".
const SLOT_PREFIX = /^([^:|]{0,30}?\d{1,3})\s*[:|]\s*/;
// "Texas vs. Tennessee", "TEXAS VS TENNESSEE", "Arsenal v Spurs", "Flamengo x Palmeiras", "UCLA at Maryland".
const MATCHUP = /\S\s+(?:(?:vs|VS|Vs|v|V)\.?|x|@)\s+\S|\S\s+at\s+[#\dA-Z]/;
const IDLE_TITLE = /^[^:]{0,24}\d{1,3}$/;
const EVENT_NAME = /\b(PPV|EVENTS?|LIVE EVENT)\b/i;

export type EventInfo = {
  /** "NCAAF 03" */
  slot: string | null;
  /** The game, without the slot or time: "#1 Texas vs. #14 Tennessee". Empty for an idle slot. */
  title: string;
  start: number | null;
};

export function parseEventName(clean: string, now: Date): EventInfo {
  const t = takeTime(clean, now);
  let rest = t ? t.rest : clean;
  let slot: string | null = null;
  const m = SLOT_PREFIX.exec(rest);
  if (m) {
    slot = m[1].trim();
    rest = rest.slice(m[0].length);
  }
  rest = rest.replace(/\s+/g, " ").trim();
  return { slot, title: rest, start: t ? t.start.getTime() : null };
}

// "No Event", "OFF AIR", "Event starts soon": an event slot telling you it has nothing on.
const PLACEHOLDER_NAME =
  /\b(no (live )?(events?|games?|streams?|programs?|programmes?)( (scheduled|streaming|today|now|available|on))?|off ?air|offline|stand ?by|to be (announced|confirmed)|tba|tbd|tbc|coming soon|not (live|started|active)|events? (starts? soon|not started)|nothing (on|scheduled))\b/gi;

/** An event-slot title with no game in it: empty, just the slot ("ESPN+ 018"), or a placeholder. */
export function isIdleEventTitle(title: string): boolean {
  const rest = title
    .replace(PLACEHOLDER_NAME, " ")
    .replace(/[\s\-–—|:•.,()[\]]+/g, " ")
    .trim();
  return !rest || (!MATCHUP.test(rest) && IDLE_TITLE.test(rest));
}

function looksLikeEvent(clean: string, group: string | null, now: Date): boolean {
  if (EVENT_NAME.test(clean) || MATCHUP.test(clean) || SLOT_PREFIX.test(clean)) return true;
  return !!takeTime(clean, now) || EVENT_GROUP.test(group ?? "");
}

// ---------------------------------------------------------------------------------------------
// Entries

export type SportsChannelEntry = {
  key: string;
  /** Card title: the game for an event feed, else the cleaned channel name. */
  title: string;
  /** Event slot ("NCAAF 03") or null. */
  slot: string | null;
  sport: SportCategory;
  event: boolean;
  /** An event slot with nothing in its name (no game, no time). */
  idle: boolean;
  country: string | null;
  /** Kick-off from the channel name. */
  start: number | null;
  /** The same channel on each provider / in each quality, best first. */
  channels: IptvChannel[];
  /** Original playlist position, for a stable order. */
  order: number;
};

/**
 * Every sports channel, one entry per distinct channel. Rebuild when the playlists change; it is
 * the expensive part. `now` only resolves the year of event kick-offs.
 */
export function collectSportsChannels(
  channels: IptvChannel[],
  opts: { now: Date; preferredSourceId?: string | null },
): SportsChannelEntry[] {
  const byKey = new Map<string, SportsChannelEntry>();
  const out: SportsChannelEntry[] = [];
  const seenUrls = new Set<string>();
  const rank = new Map<string, number>();
  const preferred = opts.preferredSourceId ?? null;
  channels.forEach((ch, order) => {
    if (!ch.url || seenUrls.has(ch.url) || DIVIDER.test(ch.name)) return;
    const inGroup = sportsGroup(ch.group);
    // Cheap test on the raw name first; most channels in a big list are not sport.
    if (!inGroup && !SPORTS_NAME.test(ch.name)) return;
    const { clean, country: nameCountry, backup } = cleanChannelName(ch.name);
    if (!inGroup && !SPORTS_NAME.test(clean)) return;
    seenUrls.add(ch.url);
    const group = ch.group ?? "";
    const country = nameCountry ?? countryOfText(group);
    const parsed = parseEventChannel(clean, group, opts.now);
    const event = !!parsed || looksLikeEvent(clean, ch.group, opts.now);
    const info = event ? parseEventName(clean, opts.now) : null;
    const start = parsed ? parsed.start.getTime() : (info?.start ?? null);
    const idle = !!info && start == null && isIdleEventTitle(info.title);
    // The same game on two providers (or two slots) is one card; idle slots never merge. A plain
    // channel keys on its country from the name or, failing that, the group ("ESPN" in "USA
    // Sports" is "US: ESPN" from another provider).
    const key =
      info && info.title && !idle
        ? `event|${keyOf(info.title, null)}|${start ?? ""}`
        : keyOf(clean, idle ? nameCountry : country);
    rank.set(ch.id, (preferred && sourceIdOf(ch.id) !== preferred ? 2 : 0) + (backup ? 1 : 0));
    const existing = byKey.get(key);
    if (existing) {
      existing.channels.push(ch);
      return;
    }
    const sport: SportCategory =
      parsed?.sport === "cfb"
        ? "college"
        : parsed?.sport === "nfl"
          ? "football"
          : (sportOfText(clean, country) ?? sportOfText(group, country) ?? "other");
    const entry: SportsChannelEntry = {
      key,
      title: info && info.title ? info.title : clean,
      slot: info?.slot ?? null,
      sport,
      event,
      idle,
      country,
      start,
      channels: [ch],
      order,
    };
    byKey.set(key, entry);
    out.push(entry);
  });
  for (const e of out) {
    if (e.channels.length < 2) continue;
    e.channels = e.channels
      .map((c, i) => ({ c, i, r: rank.get(c.id) ?? 0 }))
      .sort((a, b) => a.r - b.r || a.i - b.i)
      .map((x) => x.c);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Live now

const DURATION_H: Record<SportCategory, number> = {
  football: 4,
  college: 4,
  basketball: 3,
  baseball: 3.5,
  hockey: 3,
  soccer: 2.25,
  combat: 6,
  racing: 3.5,
  "golf-tennis": 6,
  other: 3.5,
};
const EARLY_MS = 15 * 60000;

const PLACEHOLDER_PROGRAM =
  /^(no (event|events|program(me)?s?|information|info|data|live|stream)|off ?air|offline|stand ?by|to be announced|tba|tbd|event (starts|not)|starts? (at|in)|coming (soon|up)|upcoming|next event|no current|closed|channel (is )?off)/i;
const NOT_LIVE_PROGRAM =
  /\b(PREVIEWS?|PRE-?GAME|POST-?GAME|HIGHLIGHTS?|REPLAY|REWIND|CLASSICS?|ENCORE|COUNTDOWN|RECAP|ANALYSIS|PRESS CONFERENCE|MAGAZINE|DOCUMENTARY|ALL ACCESS|SPORTSCENTER|TALK|SHOW)\b|\((R|REPEAT)\)/i;
const GAME_LISTING =
  /^(LIVE:?\s+)?(NFL|NCAA|COLLEGE|MLB|NBA|WNBA|NHL|MLS|NWSL|PREMIER LEAGUE|UEFA[\w ]*|LA ?LIGA|SERIE A|BUNDESLIGA|LIGUE 1|LIGA MX|SEC|BIG TEN|ACC|BIG 12)\b.*\b(FOOTBALL|BASKETBALL|BASEBALL|HOCKEY|SOCCER)\b/i;

/** A guide title that is a game being played, not a studio show or a replay. */
export function isLiveGameTitle(title: string): boolean {
  const t = title.trim();
  if (!t || PLACEHOLDER_PROGRAM.test(t) || NOT_LIVE_PROGRAM.test(t)) return false;
  if (/^(LIVE\b|EN VIVO\b|AO VIVO\b)|\((LIVE|EN VIVO)\)/i.test(t)) return true;
  if (GAME_LISTING.test(t)) return true;
  if (/\b(GRAND PRIX|CUP SERIES|FIGHT NIGHT|MAIN CARD|PRELIMS)\b/i.test(t)) return true;
  return MATCHUP.test(t);
}

/** A guide title that is a real programme (not "No event streaming"). */
export function isRealProgram(title: string | null | undefined): boolean {
  return !!title && !!title.trim() && !PLACEHOLDER_PROGRAM.test(title.trim());
}

export type LiveSportsEntry = SportsChannelEntry & {
  liveNow: boolean;
  favorite: boolean;
};

/**
 * Adds what changes minute to minute: is a game on now (from the kick-off in the name, else the
 * guide) and favourites. Sorted: favourites, live, then playlist order; idle slots last.
 */
export function applyLiveState(
  entries: SportsChannelEntry[],
  opts: {
    now: number;
    /** Current guide title for a channel, if the EPG has one. */
    currentTitle: (channel: IptvChannel) => string | null;
    favoriteIds?: ReadonlySet<string>;
  },
): LiveSportsEntry[] {
  const fav = opts.favoriteIds;
  const out = entries.map((e): LiveSportsEntry => {
    let liveNow = false;
    let sport = e.sport;
    let idle = e.idle;
    if (e.start != null) {
      liveNow =
        opts.now >= e.start - EARLY_MS && opts.now < e.start + DURATION_H[e.sport] * 3600000;
    } else {
      const title = currentTitleOf(e, opts.currentTitle);
      // An empty slot whose guide has a real programme on is carrying something after all.
      if (idle && isRealProgram(title)) idle = false;
      if (title) {
        liveNow = e.event
          ? isRealProgram(title) && !NOT_LIVE_PROGRAM.test(title)
          : isLiveGameTitle(title);
        if (liveNow && sport === "other") sport = sportOfText(title, e.country) ?? sport;
      }
    }
    return {
      ...e,
      sport,
      idle,
      liveNow,
      favorite: !!fav && e.channels.some((c) => fav.has(c.id)),
    };
  });
  return out.sort(
    (a, b) =>
      Number(b.favorite) - Number(a.favorite) ||
      Number(b.liveNow) - Number(a.liveNow) ||
      Number(a.idle) - Number(b.idle) ||
      a.order - b.order,
  );
}

function currentTitleOf(
  e: SportsChannelEntry,
  currentTitle: (c: IptvChannel) => string | null,
): string | null {
  for (const c of e.channels) {
    const t = currentTitle(c);
    if (t) return t;
  }
  return null;
}

/**
 * The channels worth listing (and counting): everything except empty event slots. Providers ship
 * hundreds of numbered PPV/event slots ("ESPN+ 018", "PPV 12: No Event") per provider; until one
 * names a game or its guide shows one, it is a placeholder, not a sports channel.
 */
export function listedSportsEntries(entries: LiveSportsEntry[]): LiveSportsEntry[] {
  return entries.filter((e) => !e.idle || e.liveNow || e.favorite);
}

// ---------------------------------------------------------------------------------------------
// Rows and filters

export type SportsRow = { sport: SportCategory; entries: LiveSportsEntry[] };

/** "Live events now" (event feeds with a game on first) and one row per sport, in a fixed order. */
export function sportsChannelRows(entries: LiveSportsEntry[]): {
  live: LiveSportsEntry[];
  rows: SportsRow[];
} {
  const live = entries
    .filter((e) => e.liveNow)
    .sort(
      (a, b) =>
        Number(b.favorite) - Number(a.favorite) ||
        Number(b.event) - Number(a.event) ||
        (a.start ?? Infinity) - (b.start ?? Infinity) ||
        a.order - b.order,
    );
  const bySport = new Map<SportCategory, LiveSportsEntry[]>();
  for (const e of entries) {
    const list = bySport.get(e.sport);
    if (list) list.push(e);
    else bySport.set(e.sport, [e]);
  }
  const rows = SPORT_CATEGORIES.filter((s) => bySport.has(s)).map((sport) => ({
    sport,
    entries: bySport.get(sport) ?? [],
  }));
  return { live, rows };
}

export type SportsChip = "all" | "live" | SportCategory;

export function filterSportsEntries(
  entries: LiveSportsEntry[],
  opts: { chip: SportsChip; query: string; extraText?: (e: LiveSportsEntry) => string },
): LiveSportsEntry[] {
  const words = opts.query.toLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter((e) => {
    if (opts.chip === "live" && !e.liveNow) return false;
    if (opts.chip !== "all" && opts.chip !== "live" && e.sport !== opts.chip) return false;
    if (!words.length) return true;
    const hay = [
      e.title,
      e.slot ?? "",
      ...e.channels.map((c) => `${c.name} ${c.group ?? ""}`),
      opts.extraText?.(e) ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/** Counts per chip, for the chip row. */
export function chipCounts(entries: LiveSportsEntry[]): Map<SportsChip, number> {
  const m = new Map<SportsChip, number>([
    ["all", entries.length],
    ["live", 0],
  ]);
  for (const e of entries) {
    if (e.liveNow) m.set("live", (m.get("live") ?? 0) + 1);
    m.set(e.sport, (m.get(e.sport) ?? 0) + 1);
  }
  return m;
}
