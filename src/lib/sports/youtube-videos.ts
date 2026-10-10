export interface SportsYoutubeVideo {
  id: string;
  title: string;
  url: string;
  image: string;
  published: string;
  /** Public channel pages report relative dates; these are estimates, not exact timestamps. */
  publishedApproximate?: boolean;
  channel: string;
  /** A league preview is explicitly labelled and is not footage of the selected event. */
  scope?: "event" | "league";
}

export interface SportsYoutubeQuery {
  names: string[];
  league?: string;
  eventTitle?: string;
  /** Match date distinguishes rematches and previous seasons. */
  eventStartMs?: number;
  /** Optional YouTube URLs supplied by the event's existing trusted metadata provider. */
  providerUrls?: string[];
  /** Deprecated: retained for caller compatibility; unrelated league footage is never selected. */
  allowLeaguePreview?: boolean;
  /** Names and abbreviations supplied by the same trusted event/team metadata. */
  participants?: { name: string; abbr?: string; aliases?: string[] }[];
}

type YoutubeChannel = { id: string; name: string };
const DAY = 86_400_000;
// IDs are the externalId + RSS link published by each official YouTube handle,
// verified Sep 2026. Feeds can independently be unavailable; no API key is used.
const CHANNELS: Record<string, YoutubeChannel> = {
  UFC: { id: "UCvgfXK4nTYKudb0rFR6noLA", name: "UFC" },
  PFL: { id: "UCPrONRG9hO1f-OrxW-WH-xg", name: "PFL MMA" },
  ONE: { id: "UCiormkBf3jm6mfb7k0yPbKA", name: "ONE Championship" },
  BOXING: { id: "UCurvRE5fGcdUgCYWgh-BDsg", name: "DAZN Boxing" },
  NBA: { id: "UCWJ2lWNubArHWmf3FIHbfcQ", name: "NBA" },
  WNBA: { id: "UCO9a_ryN_l7DIDS-VIt-zmw", name: "WNBA" },
  NFL: { id: "UCDVYQ4Zhbm3S2dlz7P1GBDg", name: "NFL" },
  MLB: { id: "UCoLrcjPV5PbUrUyXq5mjc_A", name: "MLB" },
  NHL: { id: "UCqFMzb-4AUf6WAIbl132QKA", name: "NHL" },
  F1: { id: "UCB_qr75-ydFVKSF9Dmo6izg", name: "FORMULA 1" },
  NASCAR: { id: "UCuN9hYw2RpoAW8rZ3VK3isA", name: "NASCAR" },
  INDY: { id: "UCy1F61QvUUQXAXi2Voa_fUw", name: "INDYCAR" },
  EPL: { id: "UCG5qGWdu8nIRZqJ_GgDwQ-w", name: "Premier League" },
  UCL: { id: "UCyGa1YEx9ST66rYrJTGIKOw", name: "UEFA" },
  LALIGA: { id: "UCTv-XvfzLX3i4IGWAm4sbmA", name: "LALIGA" },
  SERIEA: { id: "UCBJeMCIeLQos7wacox4hmLQ", name: "Serie A" },
  TENNIS: { id: "UCbcxFkd6B9xUU54InHv4Tig", name: "Tennis TV" },
  TENNIS_WTA: { id: "UCaBIVVpHjq6j3tSyxwTE-8Q", name: "WTA" },
  DOTA2: { id: "UCTQKT5QqO3h7y32G8VzuySQ", name: "Dota 2" },
  LOL: { id: "UCvqRdlKsE5Q8mf8YXbdIJLw", name: "LoL Esports" },
  VALORANT: { id: "UCA1d3HFGFUmkKr2JIUA5Vlw", name: "VALORANT Champions Tour" },
  CS2: { id: "UCPq2ETz4aAGo2Z-8JisDPIA", name: "ESL Counter-Strike" },
  BLAST: { id: "UC9k--dE_UE0Faxzgb_DDkYQ", name: "BLAST Premier" },
  RLCS: { id: "UCBjQwd62OJgixzW49TKGERg", name: "Rocket League" },
};
const ALIASES: Record<string, string> = {
  LCK: "LOL",
  LEC: "LOL",
  LPL: "LOL",
  LCS: "LOL",
  ROCKETLEAGUE: "RLCS",
  INDYCAR: "INDY",
  NXS: "NASCAR",
  NCTS: "NASCAR",
  BELL: "PFL",
  BELLATOR: "PFL",
  ATP: "TENNIS",
  WTA: "TENNIS_WTA",
};
const leagueKey = (league?: string) => {
  const key = (league || "").trim().toUpperCase();
  return ALIASES[key] || key;
};
export function channelsForLeague(league?: string): YoutubeChannel[] {
  const key = leagueKey(league);
  return [CHANNELS[key], ...(key === "CS2" ? [CHANNELS.BLAST] : [])].filter(Boolean).slice(0, 2);
}
const normalize = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\b(?:[a-z]\.){2,}/g, (value) => value.replace(/\./g, ""))
    .replace(/\b(ufc|pfl|one|bellator)(\d{2,4})\b/g, "$1 $2")
    .replace(/\b(season|week|round)\s*(\d{1,3})\b/g, "$1 $2")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const contains = (text: string, phrase: string) => ` ${text} `.includes(` ${phrase} `);

export function sportsYoutubeVideoId(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const host = url.hostname.replace(/^www\./, "");
    if (!["youtube.com", "youtu.be", "youtube-nocookie.com"].includes(host)) return null;
    const id =
      host === "youtu.be"
        ? url.pathname.slice(1)
        : url.pathname === "/watch"
          ? url.searchParams.get("v")
          : url.pathname.match(/^\/(?:embed|live|shorts)\/([^/]+)\/?$/)?.[1];
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function entities(value: string): string {
  return value
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1")
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (raw, token: string) => {
      const named: Record<string, string> = {
        amp: "&",
        lt: "<",
        gt: ">",
        quot: '"',
        apos: "'",
      };
      if (token in named) return named[token];
      const point = token.startsWith("#x")
        ? parseInt(token.slice(2), 16)
        : parseInt(token.slice(1), 10);
      return Number.isFinite(point) &&
        point >= 0 &&
        point <= 0x10ffff &&
        !(point >= 0xd800 && point <= 0xdfff)
        ? String.fromCodePoint(point)
        : raw;
    });
}
const tag = (xml: string, name: string) =>
  entities(
    xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`))?.[1]?.trim() || "",
  );

const TEAM_LEAGUES = new Set(["NBA", "WNBA", "NFL", "MLB", "NHL"]);
const FOOTBALL_LEAGUES = new Set(["EPL", "UCL", "LALIGA", "SERIEA", "BUNDESLIGA", "LIGUE1", "MLS"]);
// Keep the IPTV matcher's common-word exclusions, but never use its broad
// single-token ranking to establish the identity of a video.
const AMBIGUOUS = new Set([
  "city",
  "united",
  "club",
  "real",
  "sporting",
  "athletic",
  "state",
  "university",
  "new york",
  "los angeles",
  "manchester",
  "london",
  "ny",
  "la",
  "sf",
  "fc",
  "cf",
  "sc",
]);
const FOOTBALL_NAMES: Record<string, string[]> = {
  "manchester united": ["man utd", "manchester utd", "man united"],
  "manchester city": ["man city"],
  "tottenham hotspur": ["tottenham", "spurs"],
  "tottenham hotspurs": ["tottenham", "spurs"],
  tottenham: ["spurs"],
  "paris saint germain": ["paris sg", "psg"],
};
type Participant = { name: string; aliases: Set<string>; surname: string };
function participantProfiles(query: SportsYoutubeQuery): Participant[] {
  const key = leagueKey(query.league);
  const team =
    TEAM_LEAGUES.has(key) ||
    FOOTBALL_LEAGUES.has(key) ||
    ["CS2", "DOTA2", "LOL", "VALORANT", "RLCS"].includes(key);
  const names = [
    ...new Set(
      (query.names.length ? query.names : (query.participants || []).map((side) => side.name))
        .map(normalize)
        .filter(
          (name) => name.length >= 2 && !/^(tba|opponent tba|unknown|to be announced)$/.test(name),
        ),
    ),
  ].slice(0, 4);
  const profiles = names.map((name) => {
    const aliases = new Set([name]);
    const supplied = query.participants?.find((side) => normalize(side.name) === name);
    if (team) {
      const withoutClub = name.replace(/^(?:fc|cf|afc|ac) /, "").replace(/ (?:fc|cf|afc|sc)$/, "");
      if (!AMBIGUOUS.has(withoutClub)) aliases.add(withoutClub);
      for (const alias of (supplied?.aliases || []).slice(0, 12).map(normalize)) {
        if (
          alias.length >= 3 &&
          !AMBIGUOUS.has(alias) &&
          (!name.startsWith(alias + " ") || alias === name)
        )
          aliases.add(alias);
      }
      const abbr = normalize(supplied?.abbr || "");
      if (
        /^[a-z0-9]{2,6}$/.test(abbr) &&
        (abbr.length >= 3 || /\d/.test(abbr)) &&
        !AMBIGUOUS.has(abbr)
      )
        aliases.add(abbr);
      if (FOOTBALL_LEAGUES.has(key))
        for (const alias of FOOTBALL_NAMES[withoutClub] || []) aliases.add(alias);
      if (TEAM_LEAGUES.has(key)) {
        const words = name.split(" ");
        const tail = words.at(-1)!;
        const nickname = ["sox", "jays", "leafs", "jackets", "knights", "blazers"].includes(tail)
          ? words.slice(-2).join(" ")
          : tail;
        if (words.length > 1 && nickname.length >= 4 && !AMBIGUOUS.has(nickname))
          aliases.add(nickname);
        aliases.add(name.replace(/^new york /, "ny ").replace(/^los angeles /, "la "));
      }
    }
    return { name, aliases, surname: name.split(" ").at(-1)! };
  });
  // Shared nicknames, abbreviations and cities never identify either opponent.
  const counts = new Map<string, number>();
  for (const profile of profiles)
    for (const alias of profile.aliases) counts.set(alias, (counts.get(alias) || 0) + 1);
  for (const profile of profiles)
    for (const alias of profile.aliases)
      if ((counts.get(alias) || 0) > 1 || AMBIGUOUS.has(alias)) profile.aliases.delete(alias);
  return profiles;
}
function matchupParts(title: string): [string, string] | null {
  const separator = /\b(?:versus|vs?)\b\.?|@/i.exec(title) || /\bat\b/i.exec(title);
  return separator
    ? [
        normalize(title.slice(0, separator.index)),
        normalize(title.slice(separator.index + separator[0].length)),
      ]
    : null;
}
function participantHit(text: string, person: Participant, surnameAllowed: boolean): boolean {
  if ([...person.aliases].some((alias) => contains(text, alias))) return true;
  if (
    !surnameAllowed ||
    person.surname.length < 3 ||
    AMBIGUOUS.has(person.surname) ||
    !contains(text, person.surname)
  )
    return false;
  const before =
    text
      .split(new RegExp(`\\b${person.surname}\\b`))[0]
      .trim()
      .split(" ")
      .at(-1) || "";
  // "Adam Smith" cannot become "John Smith" just because the description
  // mentions John. A surname alone or the correct first initial is acceptable.
  return (
    !before ||
    /^\d+$/.test(before) ||
    person.name.split(" ").includes(before) ||
    (before.length === 1 && person.name.startsWith(before)) ||
    ["ufc", "fight", "preview", "countdown", "vs", "v"].includes(before)
  );
}
function conflictingVideoDate(title: string, eventAt: number): boolean {
  const date = new Date(eventAt);
  const expected = new Set([
    `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`,
    `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
  ]);
  const dates: string[] = [];
  for (const match of title.matchAll(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/g))
    dates.push(`${+match[1]}-${+match[2]}-${+match[3]}`);
  for (const match of title.matchAll(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}|\d{2}))?\b/g)) {
    if (+match[1] > 12 || +match[2] > 31) continue;
    const year = match[3]
      ? +match[3] < 100
        ? 2000 + +match[3]
        : +match[3]
      : date.getUTCFullYear();
    dates.push(`${year}-${+match[1]}-${+match[2]}`);
  }
  const months = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  for (const match of title
    .toLowerCase()
    .matchAll(
      /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(20\d{2}))?\b/g,
    ))
    dates.push(
      `${match[3] ? +match[3] : date.getUTCFullYear()}-${months.indexOf(match[1].slice(0, 3)) + 1}-${+match[2]}`,
    );
  return dates.some((value) => !expected.has(value));
}
const rematch = (text: string) =>
  text
    .match(/\b(?:vs?|versus)\b.+?\s(1|2|3|4|ii|iii|iv)\b/)?.[1]
    ?.replace(/^ii$/, "2")
    .replace(/^iii$/, "3")
    .replace(/^iv$/, "4");

export function sportsYoutubeRelevant(
  title: string,
  description: string,
  published: string,
  query: SportsYoutubeQuery,
  now = Date.now(),
): boolean {
  const at = Date.parse(published);
  const event = normalize(query.eventTitle || "");
  const profiles = participantProfiles(query);
  if (!event && !profiles.length) return false;
  if (!Number.isFinite(at) || at > now + 5 * 60_000 || at < now - (event ? 14 : 90) * DAY)
    return false;
  const titleText = normalize(title);
  const descriptionText = normalize(description.slice(0, 1000));
  const eventAt = query.eventStartMs;
  const preview =
    /\b(preview|trailer|teaser|countdown|face off|faceoff|weigh in|weigh ins|embedded|road to|build up|pregame|pre game)\b/.test(
      titleText,
    );
  const result =
    /\b(highlights?|recap|replay|full match|full fight|full game|result|results|postgame|post game|reaction|react|every touch)\b/.test(
      titleText,
    );
  if (event && /\b(throwback|rewind|classic|archive|on this day)\b/.test(titleText)) return false;
  if (Number.isFinite(eventAt)) {
    if (
      at < eventAt! - 30 * DAY ||
      at > eventAt! + 3 * DAY ||
      conflictingVideoDate(title, eventAt!)
    )
      return false;
    const years = title.match(/\b20\d{2}\b/g)?.map(Number) || [];
    if (years.length && !years.includes(new Date(eventAt!).getUTCFullYear())) return false;
    // A recent upload of last week's game is not this week's upcoming fixture.
    if (result && !preview && (eventAt! > now || at < eventAt! - 2 * 3_600_000)) return false;
  }
  const numbered = event.match(/\b(ufc|pfl|one|bellator) (\d{2,4})\b/);
  const titledNumbers = numbered
    ? [...titleText.matchAll(new RegExp(`\\b${numbered[1]} (\\d{2,4})\\b`, "g"))].map(
        (match) => match[1],
      )
    : [];
  if (numbered && titledNumbers.some((number) => number !== numbered[2])) return false;
  const exactNumber = !!numbered && titledNumbers.includes(numbered[2]);
  const eventRematch = rematch(event),
    titleRematch = rematch(titleText);
  if (eventRematch && titleRematch && eventRematch !== titleRematch) return false;
  if (Number.isFinite(eventAt) && eventAt! > now && !preview && !exactNumber) return false;
  let specificContextMatch = false;
  // A specific series episode is itself an event even before its fighters are
  // announced. A league/round label alone cannot identify a particular fixture.
  const contextNumbers = [...event.matchAll(/\b(season|week|round) (\d{1,3})\b/g)];
  const contextName = contextNumbers.length ? event.slice(0, contextNumbers[0].index).trim() : "";
  if (
    contextNumbers.length >= 2 &&
    contextName.split(" ").length >= 3 &&
    contains(titleText, contextName)
  ) {
    if (
      contextNumbers.some(([, label, value]) => {
        const titled = titleText.match(new RegExp(`\\b${label} (\\d{1,3})\\b`));
        return titled && titled[1] !== value;
      })
    )
      return false;
    if (contextNumbers.every(([, label, value]) => contains(titleText, `${label} ${value}`)))
      specificContextMatch = true;
  }
  const parts = matchupParts(title);
  if (parts && profiles.length === 2) {
    const distinctSurnames = profiles[0].surname !== profiles[1].surname;
    const groundedNames = profiles.every((profile) => contains(descriptionText, profile.name));
    const surnameAllowed = distinctSurnames && (exactNumber || groundedNames);
    return (
      (participantHit(parts[0], profiles[0], surnameAllowed) &&
        participantHit(parts[1], profiles[1], surnameAllowed)) ||
      (participantHit(parts[0], profiles[1], surnameAllowed) &&
        participantHit(parts[1], profiles[0], surnameAllowed))
    );
  }
  if (exactNumber) return true;
  if (specificContextMatch) return true;
  const grandPrix = event.match(/\b([a-z]+) grand prix\b/);
  if (grandPrix && contains(titleText, grandPrix[0])) return true;
  const titleHits = profiles.map((profile) => participantHit(titleText, profile, false));
  if (profiles.length > 1) {
    if (titleHits.every(Boolean)) return true;
    // A league roundup may list every team in its description. Require a named
    // participant in the title and an explicit matchup in the opening sentence.
    if (profiles.length === 2 && titleHits.some(Boolean)) {
      const opening = description
        .slice(0, 700)
        .split(/[.!?\n]/)[0]
        .replace(/\b(?:faces?|meets?|hosts?|visits?|battles?|takes? on)\b/i, "vs");
      const pair = matchupParts(opening);
      if (
        pair &&
        ((contains(pair[0], profiles[0].name) && contains(pair[1], profiles[1].name)) ||
          (contains(pair[0], profiles[1].name) && contains(pair[1], profiles[0].name)))
      )
        return true;
    }
    return false;
  }
  if (profiles.length === 1 && (titleHits[0] || contains(descriptionText, profiles[0].name)))
    return true;
  // A generic league name or a repeated team prefix cannot identify an event.
  const uniqueWords = event
    .split(" ")
    .filter(
      (word) =>
        word.length >= 3 &&
        ![
          "the",
          "and",
          "versus",
          "live",
          "match",
          "game",
          "round",
          "season",
          "final",
          "sport",
          "sports",
          "ufc",
          "nba",
          "nfl",
        ].includes(word),
    );
  return uniqueWords.length >= 3 && contains(titleText, event);
}

type FeedVideo = SportsYoutubeVideo & { description: string };

/** Only exact event/participant matches may become previews. */
export function selectSportsYoutubeVideos(
  videos: FeedVideo[],
  query: SportsYoutubeQuery,
  now = Date.now(),
): SportsYoutubeVideo[] {
  const seen = new Set<string>();
  const unique = videos
    .filter((video) => {
      if (seen.has(video.id)) return false;
      seen.add(video.id);
      return true;
    })
    .sort((a, b) => Date.parse(b.published) - Date.parse(a.published));
  const exact = unique.filter((video) =>
    sportsYoutubeRelevant(video.title, video.description, video.published, query, now),
  );
  return exact.slice(0, 8).map(({ description: _, ...video }) => ({
    ...video,
    scope: "event" as const,
  }));
}

export function parseSportsYoutubeFeed(xml: string, channel: YoutubeChannel): FeedVideo[] {
  if (xml.length > 600_000 || !/<feed\b/.test(xml) || /<!DOCTYPE|<!ENTITY/i.test(xml)) return [];
  const entries = [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/g)].slice(0, 30);
  return entries.flatMap(([, entry]) => {
    const id = tag(entry, "yt:videoId");
    if (!/^[a-zA-Z0-9_-]{11}$/.test(id) || tag(entry, "yt:channelId") !== channel.id) return [];
    const title = tag(entry, "title").slice(0, 300);
    const published = tag(entry, "published");
    if (!title || !Number.isFinite(Date.parse(published))) return [];
    return [
      {
        id,
        title,
        url: `https://www.youtube.com/watch?v=${id}`,
        image: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        published,
        channel: channel.name,
        description: tag(entry, "media:description").slice(0, 1000),
      },
    ];
  });
}

const youtubeText = (value: unknown): string => {
  const item = value as { simpleText?: string; runs?: { text?: string }[] } | undefined;
  return typeof item?.simpleText === "string"
    ? item.simpleText
    : Array.isArray(item?.runs)
      ? item.runs.map((run) => (typeof run?.text === "string" ? run.text : "")).join("")
      : "";
};

/** Parse only the JSON YouTube publishes in its ordinary public channel page. */
export function parseSportsYoutubeChannelPage(
  html: string,
  channel: YoutubeChannel,
  now = Date.now(),
): FeedVideo[] {
  if (html.length > 4_000_000) return [];
  const marker = html.indexOf("var ytInitialData = ");
  if (marker === -1) return [];
  const start = html.indexOf("{", marker);
  if (start === -1) return [];
  let depth = 0,
    quoted = false,
    escaped = false,
    end = -1;
  for (let index = start; index < html.length; index++) {
    const char = html[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === "{") depth++;
    else if (char === "}" && --depth === 0) {
      end = index + 1;
      break;
    }
  }
  if (end === -1) return [];
  try {
    const data = JSON.parse(html.slice(start, end));
    if (data?.metadata?.channelMetadataRenderer?.externalId !== channel.id) return [];
    const stack: unknown[] = [data.contents];
    const videos = new Map<string, FeedVideo>();
    let visited = 0;
    while (stack.length && visited++ < 20_000 && videos.size < 30) {
      const node = stack.pop() as Record<string, unknown> | undefined;
      if (!node || typeof node !== "object") continue;
      const renderer = (node.channelVideoPlayerRenderer ||
        node.videoRenderer ||
        node.gridVideoRenderer) as Record<string, unknown> | undefined;
      if (renderer) {
        const id = renderer.videoId;
        const title = youtubeText(renderer.title).slice(0, 300);
        const relative = youtubeText(renderer.publishedTimeText);
        const ownerIds = [
          renderer.ownerText,
          renderer.shortBylineText,
          renderer.longBylineText,
        ].flatMap((value) => {
          const byline = value as
            | {
                runs?: {
                  navigationEndpoint?: {
                    browseEndpoint?: { browseId?: string };
                  };
                }[];
              }
            | undefined;
          return Array.isArray(byline?.runs)
            ? byline.runs
                .map((run) => run?.navigationEndpoint?.browseEndpoint?.browseId)
                .filter(Boolean)
            : [];
        });
        const age = relative.match(
          /^(?:Streamed |Premiered )?(\d+) (minute|hour|day|week)s? ago$/i,
        );
        const status = JSON.stringify([renderer.badges, renderer.thumbnailOverlays]);
        if (
          typeof id === "string" &&
          /^[a-zA-Z0-9_-]{11}$/.test(id) &&
          title &&
          age &&
          !ownerIds.some((id) => id !== channel.id) &&
          !renderer.upcomingEventData &&
          !renderer.isLiveNow &&
          !/"(?:LIVE|UPCOMING|BADGE_STYLE_TYPE_LIVE_NOW)"/.test(status)
        ) {
          const units: Record<string, number> = {
            minute: 60_000,
            hour: 3_600_000,
            day: DAY,
            week: 7 * DAY,
          };
          const published = new Date(
            now - Number(age[1]) * units[age[2].toLowerCase()],
          ).toISOString();
          const description = youtubeText(
            renderer.description || renderer.descriptionSnippet,
          ).slice(0, 1000);
          const previous = videos.get(id);
          if (!previous || description.length > previous.description.length)
            videos.set(id, {
              id,
              title,
              description,
              published,
              publishedApproximate: true,
              channel: channel.name,
              url: `https://www.youtube.com/watch?v=${id}`,
              image: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            });
        }
      }
      for (const value of Object.values(node))
        if (value && typeof value === "object") stack.push(value);
    }
    return [...videos.values()];
  } catch {
    return [];
  }
}

type FeedCacheEntry = { at: number; videos: FeedVideo[] };
const FEED_CACHE_KEY = "harbor:sports:youtube-feeds:v1";
const feedCache = new Map<string, FeedCacheEntry>();
const failedUntil = new Map<string, number>();
let cacheHydration: Promise<void> | undefined;
const metadataCache = new Map<string, { at: number; video: SportsYoutubeVideo }>();
type YoutubeTextFetcher = (url: string, signal: AbortSignal) => Promise<string>;

/** Restored data never supplies arbitrary URLs or unverified channel identities. */
export function decodeSportsYoutubeCache(
  raw: string,
  now = Date.now(),
): Array<[string, FeedCacheEntry]> {
  if (raw.length > 1_000_000) return [];
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1 || !Array.isArray(parsed.feeds)) return [];
    const known = new Map(Object.values(CHANNELS).map((channel) => [channel.id, channel]));
    return parsed.feeds
      .slice(0, 21)
      .flatMap((entry: { id?: unknown; at?: unknown; videos?: unknown }) => {
        if (
          !entry ||
          typeof entry.id !== "string" ||
          typeof entry.at !== "number" ||
          !Number.isFinite(entry.at) ||
          entry.at > now + 5 * 60_000 ||
          now - entry.at >= DAY ||
          !Array.isArray(entry.videos)
        )
          return [];
        const channel = known.get(entry.id);
        if (!channel) return [];
        const videos = entry.videos.slice(0, 30).flatMap((video: Partial<FeedVideo>) => {
          if (
            !video ||
            typeof video.id !== "string" ||
            !/^[a-zA-Z0-9_-]{11}$/.test(video.id) ||
            typeof video.title !== "string" ||
            !video.title.trim() ||
            typeof video.published !== "string" ||
            !Number.isFinite(Date.parse(video.published))
          )
            return [];
          return [
            {
              id: video.id,
              title: video.title.slice(0, 300),
              url: `https://www.youtube.com/watch?v=${video.id}`,
              image: `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
              published: video.published,
              ...(video.publishedApproximate === true ? { publishedApproximate: true } : {}),
              channel: channel.name,
              description:
                typeof video.description === "string" ? video.description.slice(0, 1000) : "",
            },
          ];
        });
        return videos.length
          ? [[channel.id, { at: entry.at, videos }] as [string, FeedCacheEntry]]
          : [];
      });
  } catch {
    return [];
  }
}

function restoreFeedCache(): Promise<void> {
  if (!cacheHydration)
    cacheHydration = (async () => {
      const restore = (raw: unknown) => {
        if (typeof raw !== "string") return;
        for (const [id, entry] of decodeSportsYoutubeCache(raw))
          if ((feedCache.get(id)?.at || 0) < entry.at) feedCache.set(id, entry);
      };
      try {
        restore(localStorage.getItem(FEED_CACHE_KEY));
      } catch {
        /* Optional legacy cache. */
      }
      try {
        const { getSportsMetadata } = await import("@/lib/sports/artwork-storage");
        restore(await getSportsMetadata(FEED_CACHE_KEY));
      } catch {
        /* Memory remains usable if persistent storage is unavailable. */
      }
    })();
  return cacheHydration;
}

function persistFeedCache() {
  const feeds = [...feedCache]
    .filter(([, entry]) => Date.now() - entry.at < DAY)
    .slice(-21)
    .map(([id, entry]) => ({
      id,
      ...entry,
      videos: entry.videos.slice(0, 30),
    }));
  let raw = JSON.stringify({ version: 1, feeds });
  while (raw.length > 1_000_000 && feeds.length) {
    feeds.shift();
    raw = JSON.stringify({ version: 1, feeds });
  }
  // Separate sports IndexedDB storage avoids the app's crowded localStorage quota.
  void import("@/lib/sports/artwork-storage")
    .then(({ putSportsMetadata }) => putSportsMetadata(FEED_CACHE_KEY, raw))
    .catch(() => {});
}

class VideoRequestsBusyError extends Error {
  constructor() {
    super("Video requests busy");
  }
}

/** Bounded across all hovers. Queued work owns no transport and is removed on exit. */
export function createYoutubeRequestPool(
  fetcher: YoutubeTextFetcher,
  limit = 3,
  maxQueued = 6,
  timeoutMs = 7000,
): YoutubeTextFetcher {
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    !Number.isInteger(maxQueued) ||
    maxQueued < 0 ||
    timeoutMs <= 0
  )
    throw new Error("Invalid video request limits");
  let active = 0;
  const queue: Array<{ start: () => void }> = [];
  const drain = () => {
    // Reserve each next slot synchronously; a new hover cannot overtake the queue.
    while (active < limit && queue.length) queue.shift()!.start();
  };
  return (url, signal) => {
    if (signal.aborted) return Promise.reject(signal.reason);
    if (active >= limit && queue.length >= maxQueued)
      return Promise.reject(new VideoRequestsBusyError());
    return new Promise<string>((resolve, reject) => {
      const controller = new AbortController();
      let started = false;
      let settled = false;
      let timer: ReturnType<typeof setTimeout>;
      const finish = (result: { text: string } | { error: unknown }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        if (started) active--;
        else {
          const index = queue.indexOf(job);
          if (index !== -1) queue.splice(index, 1);
        }
        drain();
        if ("error" in result) reject(result.error);
        else resolve(result.text);
      };
      const cancel = (reason: unknown) => {
        controller.abort(reason);
        finish({ error: reason });
      };
      const abort = () => cancel(signal.reason);
      const job = {
        start: () => {
          if (settled) return;
          if (signal.aborted) {
            abort();
            return;
          }
          started = true;
          active++;
          Promise.resolve()
            .then(() => {
              controller.signal.throwIfAborted();
              return fetcher(url, controller.signal);
            })
            .then(
              (text) => finish({ text }),
              (error) => finish({ error }),
            );
        },
      };
      signal.addEventListener("abort", abort, { once: true });
      // Includes queue wait and body reading, so rapid hover changes cannot pile up.
      timer = setTimeout(
        () => cancel(new DOMException("Video feed timed out", "TimeoutError")),
        timeoutMs,
      );
      if (active < limit) job.start();
      else queue.push(job);
    });
  };
}

const requestText = createYoutubeRequestPool(async (url, signal) => {
  // The plugin transport preserves native AbortSignal cancellation. The generic
  // Rust JSON transport returns 404 for this public RSS URL on some clients.
  const { safeFetchStream } = await import("@/lib/safe-fetch");
  signal.throwIfAborted();
  const response = await safeFetchStream(url, { signal });
  const maximum = /^https:\/\/www\.youtube\.com\/(?:channel\/|results\?)/.test(url) ? 4_000_000 : 600_000;
  if (!response.ok || Number(response.headers.get("content-length")) > maximum)
    throw new Error("Video feed unavailable");
  const reader = response.body?.getReader();
  let text = "";
  if (reader) {
    const decoder = new TextDecoder();
    let size = 0;
    try {
      for (;;) {
        signal.throwIfAborted();
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > maximum) {
          await reader.cancel();
          throw new Error("Video feed too large");
        }
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      reader.releaseLock();
    }
  } else text = await response.text();
  signal.throwIfAborted();
  if (text.length > maximum) throw new Error("Video feed too large");
  return text;
});

export { requestText as requestSportsYoutubeText };

async function channelFeed(channel: YoutubeChannel, signal: AbortSignal): Promise<FeedVideo[]> {
  signal.throwIfAborted();
  await restoreFeedCache();
  signal.throwIfAborted();
  const hit = feedCache.get(channel.id);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.videos;
  const previous = hit && Date.now() - hit.at < DAY ? hit.videos : [];
  if ((failedUntil.get(channel.id) || 0) > Date.now()) return previous;
  try {
    let videos: FeedVideo[];
    try {
      const xml = await requestText(
        `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`,
        signal,
      );
      videos = parseSportsYoutubeFeed(xml, channel);
      if (!videos.length) throw new Error("Video feed unavailable");
    } catch (error) {
      signal.throwIfAborted();
      // Existing successful data is cheaper and more predictable than another
      // request. A new channel can fall back to its ordinary published page.
      if (previous.length || error instanceof VideoRequestsBusyError) throw error;
      const html = await requestText(`https://www.youtube.com/channel/${channel.id}`, signal);
      videos = parseSportsYoutubeChannelPage(html, channel);
    }
    signal.throwIfAborted();
    if (!videos.length) throw new Error("Video feed unavailable");
    feedCache.delete(channel.id);
    feedCache.set(channel.id, { at: Date.now(), videos });
    while (feedCache.size > 21) feedCache.delete(feedCache.keys().next().value!);
    failedUntil.delete(channel.id);
    persistFeedCache();
    return videos;
  } catch (error) {
    // A cancelled hover must neither publish nor cache its result. A transient
    // failure keeps previously verified videos; relevance dates still apply.
    signal.throwIfAborted();
    if (!(error instanceof VideoRequestsBusyError))
      failedUntil.set(channel.id, Date.now() + 60_000);
    return previous;
  }
}

async function providerVideo(
  id: string,
  query: SportsYoutubeQuery,
  signal: AbortSignal,
): Promise<SportsYoutubeVideo> {
  signal.throwIfAborted();
  const hit = metadataCache.get(id);
  if (hit && Date.now() - hit.at < DAY) return hit.video;
  const fallback: SportsYoutubeVideo = {
    id,
    title: query.eventTitle || query.names.join(" · ") || "YouTube",
    url: `https://www.youtube.com/watch?v=${id}`,
    image: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    published: "",
    channel: "YouTube",
  };
  try {
    const raw = JSON.parse(
      await requestText(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(fallback.url)}&format=json`,
        signal,
      ),
    );
    signal.throwIfAborted();
    if (typeof raw.title === "string" && typeof raw.author_name === "string") {
      const video = {
        ...fallback,
        title: raw.title.slice(0, 300),
        channel: raw.author_name.slice(0, 100),
      };
      metadataCache.set(id, { at: Date.now(), video });
      if (metadataCache.size > 40) metadataCache.delete(metadataCache.keys().next().value!);
      return video;
    }
  } catch {
    signal.throwIfAborted();
    /* A provider-supplied exact URL remains usable without oEmbed metadata. */
  }
  return fallback;
}

/** Call only on an intended hover or while the related-video section is visible. */
async function loadYoutubeVideos(
  query: SportsYoutubeQuery,
  signal: AbortSignal,
): Promise<SportsYoutubeVideo[]> {
  signal.throwIfAborted();
  const ids = [
    ...new Set(
      (query.providerUrls || []).map(sportsYoutubeVideoId).filter((id): id is string => !!id),
    ),
  ].slice(0, 2);
  const channels = channelsForLeague(query.league);
  if (
    !ids.length &&
    (!channels.length ||
      (!query.names.some((name) => name.trim().length >= 4) && !query.eventTitle?.trim()))
  )
    return [];
  if (ids.length) return Promise.all(ids.map((id) => providerVideo(id, query, signal)));
  const feeds = await Promise.all(channels.map((channel) => channelFeed(channel, signal)));
  signal.throwIfAborted();
  return selectSportsYoutubeVideos(feeds.flat(), query);
}

export async function loadSportsYoutubeVideos(
  query: SportsYoutubeQuery,
  signal: AbortSignal,
): Promise<SportsYoutubeVideo[]> {
  signal.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(
    () => controller.abort(new DOMException("Video lookup timed out", "TimeoutError")),
    9000,
  );
  try {
    return await loadYoutubeVideos(query, controller.signal);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
}
