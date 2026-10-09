/**
 * Liquipedia metadata cassette: text and structure only, never a bitmap.
 *
 * Measured, and the reason nothing here returns an image URL: their CDN runs nginx valid_referers
 * and answered every real Harbor origin with 403 (tauri.localhost, localhost:1420, harbor.site),
 * and the 403 body is itself a valid PNG "no hotlinking" banner that would render inside a card.
 * Independently, event and team logos carry license=fairuselogo and the photography carries
 * license=permission naming Liquipedia as the only grantee. CC BY-SA 3.0 covers the wiki text, so
 * every surface built on this must show a visible "Source: Liquipedia (CC BY-SA 3.0)" credit; that
 * is contractual, and liquipediaCredit() exists to make it one field away.
 *
 * Request discipline, also measured: the Varnish edge returns a hard 406 with body "Gzip encoding
 * is required for API requests" unless Accept-Encoding: gzip is sent, their terms require a
 * descriptive contact-bearing agent, and the published limits are 1 request per 2s overall and 1
 * action=parse per 30s with escalating automated IP bans. Every read goes through one serialised
 * queue honouring both lanes and lands in IndexedDB with a long TTL. localStorage is deliberately
 * untouched: it is already at its 5MB cap on the author's machine.
 */
import type { EsportsGameId } from "./esports-feeds";
import { idbCacheDelete, idbCacheGet, idbCacheSet } from "@/lib/idb-cache";
import { registerEvictable } from "@/lib/maintenance";

export type LiquipediaWiki =
  | "counterstrike"
  | "dota2"
  | "valorant"
  | "leagueoflegends"
  | "rocketleague";

/** The feeds union is the 5-wide one; esports-catalog exports a different 12-wide EsportsGameId. */
export const LIQUIPEDIA_WIKI: Record<EsportsGameId, LiquipediaWiki> = {
  cs2: "counterstrike",
  dota2: "dota2",
  valorant: "valorant",
  lol: "leagueoflegends",
  rocketleague: "rocketleague",
};

/**
 * Measured: only these two inline real match rows in {{Bracket}}. dota2, valorant and
 * leagueoflegends return the same template filled with empty {{Match}} stubs, their rows having
 * moved into LPDB, so asking them for a bracket spends a request to learn nothing.
 */
export const LIQUIPEDIA_INLINE_BRACKETS: ReadonlySet<LiquipediaWiki> = new Set([
  "counterstrike",
  "rocketleague",
]);

export const LIQUIPEDIA_LICENCE = "CC BY-SA 3.0";
export const LIQUIPEDIA_LICENCE_URL = "https://creativecommons.org/licenses/by-sa/3.0/";

export interface LiquipediaCredit {
  source: string;
  licence: string;
  licenceUrl: string;
  pageUrl: string;
}

const normPage = (page: string) => (page ?? "").trim().replace(/_/g, " ").replace(/\s+/g, " ");

export function liquipediaPageUrl(wiki: LiquipediaWiki, page: string): string {
  const path = normPage(page)
    .split("/")
    .map((part) => encodeURIComponent(part.replace(/ /g, "_")))
    .join("/");
  return `https://liquipedia.net/${wiki}/${path}`;
}

export function liquipediaCredit(wiki: LiquipediaWiki, page: string): LiquipediaCredit {
  return {
    source: "Liquipedia",
    licence: LIQUIPEDIA_LICENCE,
    licenceUrl: LIQUIPEDIA_LICENCE_URL,
    pageUrl: liquipediaPageUrl(wiki, page),
  };
}

export interface LpTemplate {
  name: string;
  params: Record<string, string>;
  args: string[];
  raw: string;
}

const NOISE = /<!--[\s\S]*?-->|<ref\b[^>]*\/>|<ref\b[^>]*>[\s\S]*?<\/ref>|<\/?nowiki\s*\/?>/gi;
const normName = (value: string) => value.replace(/[_\s]+/g, " ").trim().toLowerCase();

/** Comments and <ref> blocks carry stray pipes and braces that would desync the scanner. */
const denoise = (src: string) => (src ?? "").replace(NOISE, "");

/** End index of the {{...}} opening at `from`, or -1 when it never closes. */
function templateEnd(src: string, from: number): number {
  let depth = 0;
  for (let i = from; i < src.length - 1; i += 1) {
    const code = src.charCodeAt(i);
    if ((code !== 123 && code !== 125) || src.charCodeAt(i + 1) !== code) continue;
    i += 1;
    if (code === 123) depth += 1;
    else if ((depth -= 1) === 0) return i + 1;
  }
  return -1;
}

/** Top-level pipe split: a pipe nested in {{...}} or [[...]] belongs to the child, not the parent. */
function splitParams(body: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i += 1) {
    const code = body.charCodeAt(i);
    const next = body.charCodeAt(i + 1);
    if ((code === 123 || code === 91) && next === code) {
      depth += 1;
      i += 1;
    } else if ((code === 125 || code === 93) && next === code) {
      depth = Math.max(0, depth - 1);
      i += 1;
    } else if (code === 124 && depth === 0) {
      out.push(body.slice(start, i));
      start = i + 1;
    }
  }
  out.push(body.slice(start));
  return out;
}

function parseTemplate(raw: string): LpTemplate {
  const parts = splitParams(raw.slice(2, -2));
  const name = normName(parts.shift() ?? "");
  const params: Record<string, string> = {};
  const args: string[] = [];
  for (const part of parts) {
    const eq = part.indexOf("=");
    const key = eq > 0 ? part.slice(0, eq).trim().replace(/\s+/g, " ").toLowerCase() : "";
    if (key && !/[{}[\]|]/.test(key)) params[key] = part.slice(eq + 1).trim();
    else args.push(part.trim());
  }
  return { name, params, args, raw };
}

const nameMatches = (head: string, name: string) =>
  head.startsWith(name) && /^[|}\s]/.test(head.slice(name.length) || "}");

/**
 * Every template with one of these names at any depth, outermost first. The cheap name probe before
 * templateEnd keeps a 100KB event page linear rather than quadratic.
 */
export function findTemplates(src: string, names: readonly string[]): LpTemplate[] {
  const out: LpTemplate[] = [];
  for (let i = src.indexOf("{{"); i >= 0; i = src.indexOf("{{", i + 2)) {
    const head = src
      .slice(i + 2, i + 50)
      .replace(/[_\s]+/g, " ")
      .toLowerCase();
    if (!names.some((name) => nameMatches(head, name))) continue;
    const end = templateEnd(src, i);
    if (end < 0) break;
    out.push(parseTemplate(src.slice(i, end)));
    i = end - 2;
  }
  return out;
}

/** {{!}} is a literal pipe; any other template collapses to its last positional argument. */
function collapseTemplates(value: string): string {
  let out = value;
  for (let pass = 0; pass < 4 && out.includes("{{"); pass += 1)
    out = out.replace(/\{\{([^{}]*)\}\}/g, (_match, inner: string) => {
      const parts = splitParams(inner);
      if (normName(parts[0] ?? "") === "!") return "|";
      return (
        parts
          .slice(1)
          .filter((part) => !part.includes("="))
          .pop() ?? ""
      ).trim();
    });
  return out;
}

export function cleanWikitext(value: string): string {
  return collapseTemplates(denoise(value))
    .replace(/\[\[[^[\]|]+\|([^[\]]*)\]\]/g, "$1")
    .replace(/\[\[([^[\]|]+)\]\]/g, "$1")
    .replace(/\[(?:https?:)?\/\/[^\s\]]+[ \t]+([^\]]*)\]/g, "$1")
    .replace(/\[((?:https?:)?\/\/[^\s\]]+)\]/g, "$1")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/'''?/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function safeUrl(raw: string): string | undefined {
  const value = (raw ?? "").trim();
  try {
    const url = new URL(value.startsWith("//") ? `https:${value}` : value);
    const http = url.protocol === "https:" || url.protocol === "http:";
    return http && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function num(value: string | undefined): number | undefined {
  const text = (value ?? "").trim();
  return text !== "" && Number.isFinite(Number(text)) ? Number(text) : undefined;
}

/** "2,881,791", "$1,000,000.00" and "2.881.791" all mean the same integer. */
export function parseMoney(raw: string): number | undefined {
  const match = /\d[\d,. ']*/.exec(denoise(raw).replace(/\{\{[^{}]*\}\}/g, ""));
  if (!match) return undefined;
  const digits = match[0].replace(/[^\d.]/g, "");
  const value = Number(/\.\d{1,2}$/.test(digits) ? digits : digits.replace(/\./g, ""));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export interface LiquipediaLeague {
  wiki: LiquipediaWiki;
  page: string;
  name?: string;
  series?: string;
  organisers: string[];
  startMs?: number;
  /** The last millisecond of the edate day in UTC, so "still running" holds on the final day. */
  endMs?: number;
  dates?: { start?: string; end?: string };
  country?: string;
  city?: string;
  /** Measured: venue is "[https://host/ Label]", never a plain string. Never render it raw. */
  venue?: { label?: string; url?: string };
  tier?: { liquipedia?: string; publisher?: string; type?: string; raw?: string };
  prizePoolUsd?: number;
  prizePoolRaw?: string;
  /** Set when prizepoolusd was a {{:Event/2025/prizepool}} transclusion needing its own read. */
  prizePoolPage?: string;
  mapPool: string[];
  teamCount?: number;
  format?: string;
  previous?: { page: string; label?: string };
  next?: { page: string; label?: string };
  credit: LiquipediaCredit;
}

/** Most wikis store the tier numerically, a few literally. The raw value is kept either way. */
const TIER_LABELS: Record<string, string> = {
  "1": "S-Tier",
  "2": "A-Tier",
  "3": "B-Tier",
  "4": "C-Tier",
  "5": "D-Tier",
};

function wikiDay(raw: string | undefined, endOfDay: boolean): number | undefined {
  const match = /(\d{4})-(\d{2})-(\d{2})/.exec(raw ?? "");
  if (!match) return undefined;
  const at = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isFinite(at) ? at + (endOfDay ? 86_399_999 : 0) : undefined;
}

/** Measured: previous/next carry a pipe escape, "StarLadder/2025/Major{{!}}SL Budapest 2025". */
function pageRef(raw: string | undefined): { page: string; label?: string } | undefined {
  const value = denoise(raw ?? "")
    .replace(/\{\{\s*!\s*\}\}/g, "|")
    .replace(/\[\[|\]\]/g, "")
    .trim();
  if (!value) return undefined;
  const parts = value.split("|");
  const page = normPage(cleanWikitext(parts[0]));
  return page ? { page, label: cleanWikitext(parts.slice(1).join("|")) || undefined } : undefined;
}

function linkField(raw: string): { label?: string; url?: string } | undefined {
  const value = denoise(raw).trim();
  if (!value) return undefined;
  const match = /\[((?:https?:)?\/\/[^\s\]]+)(?:[ \t]+([^\]]*))?\]/.exec(value);
  const label = cleanWikitext(match ? (match[2] ?? "") : value) || undefined;
  const url = match ? safeUrl(match[1]) : undefined;
  return label || url ? { label, url } : undefined;
}

export function parseLeagueInfobox(
  wikitext: string,
  wiki: LiquipediaWiki,
  page: string,
): LiquipediaLeague | null {
  const box = findTemplates(denoise(wikitext), ["infobox league"])[0];
  if (!box) return null;
  const p = box.params;
  const pick = (...keys: string[]): string | undefined => {
    for (const key of keys) {
      const value = cleanWikitext(p[key] ?? "");
      if (value) return value;
    }
    return undefined;
  };
  const organisers: string[] = [];
  for (const key of ["organizer", "organiser"])
    for (let n = 0; n <= 6; n += 1) {
      const value = cleanWikitext(p[n === 0 ? key : `${key}${n}`] ?? "");
      if (value && !organisers.includes(value)) organisers.push(value);
    }
  // CS2 fields seven active maps; the loop runs two past that so an extra slot is never dropped.
  const mapPool: string[] = [];
  for (let n = 1; n <= 9; n += 1) {
    const value = cleanWikitext(p[`map${n}`] ?? "");
    if (value) mapPool.push(value);
  }
  const usdRaw = (p.prizepoolusd ?? "").trim();
  const transclusion = /\{\{\s*:\s*([^|}]+?)\s*\}\}/.exec(usdRaw);
  const prizePoolPage = transclusion ? normPage(transclusion[1]) : undefined;
  const tierRaw = pick("liquipediatier");
  const start = pick("sdate", "date");
  const end = pick("edate", "date");
  return {
    wiki,
    page: normPage(page),
    name: pick("name", "shortname"),
    series: pick("series", "series1"),
    organisers,
    startMs: wikiDay(start, false),
    endMs: wikiDay(end, true),
    dates: start || end ? { start, end } : undefined,
    country: pick("country", "country1"),
    city: pick("city", "city1"),
    venue: linkField(p.venue ?? ""),
    tier: tierRaw
      ? {
          liquipedia: TIER_LABELS[tierRaw] ?? tierRaw,
          publisher: pick("publishertier"),
          type: pick("liquipediatiertype"),
          raw: tierRaw,
        }
      : undefined,
    prizePoolUsd: prizePoolPage ? undefined : parseMoney(usdRaw),
    prizePoolRaw: prizePoolPage ? undefined : pick("prizepool", "prizepoolusd"),
    prizePoolPage,
    mapPool,
    teamCount: num(cleanWikitext(p.team_number ?? "")),
    format: pick("format"),
    previous: pageRef(p.previous),
    next: pageRef(p.next),
    credit: liquipediaCredit(wiki, page),
  };
}

export interface LiquipediaSection {
  line: string;
  level: number;
  /** MediaWiki's own anchor rules escape more than spaces; good enough to key a stage table on. */
  anchor: string;
}

/**
 * The stage outline, read out of wikitext headings rather than action=parse&prop=sections. Same
 * answer, and it stays on the 2-second lane instead of the 30-second one.
 */
export function parseSections(wikitext: string): LiquipediaSection[] {
  const out: LiquipediaSection[] = [];
  for (const match of denoise(wikitext).matchAll(/^(={2,6})[ \t]*(.+?)[ \t]*\1[ \t]*$/gm)) {
    const line = cleanWikitext(match[2]);
    if (line) out.push({ line, level: match[1].length, anchor: line.replace(/ /g, "_") });
  }
  return out;
}

const OPPONENTS = ["teamopponent", "soloopponent", "literalopponent"];

/** A Liquipedia page name ("spirit"), not a display name. Join it through Harbor's team identity. */
const opponentName = (tpl: LpTemplate) =>
  cleanWikitext(tpl.args[0] || tpl.params.team || tpl.params.p1 || tpl.params.name || "");

export interface LiquipediaPrizeSlot {
  place: string;
  rank?: number;
  usd?: number;
  local?: string;
  teams: string[];
}

/** Placement-by-placement money. Only Liquipedia publishes this keylessly, and on all five wikis. */
export function parsePrizePool(wikitext: string): LiquipediaPrizeSlot[] {
  const src = denoise(wikitext);
  const pools = findTemplates(src, ["teamprizepool", "soloprizepool"]);
  const scopes = pools.length ? pools.map((pool) => pool.raw) : [src];
  return scopes
    .flatMap((scope) => findTemplates(scope, ["slot", "prize pool slot"]))
    .map((slot) => {
      const place = cleanWikitext(slot.params.place ?? slot.args[0] ?? "");
      const rank = /^(\d+)/.exec(place);
      return {
        place,
        rank: rank ? Number(rank[1]) : undefined,
        usd: parseMoney(slot.params.usdprize ?? ""),
        local: cleanWikitext(slot.params.localprize ?? "") || undefined,
        teams: findTemplates(slot.raw, OPPONENTS).map(opponentName).filter(Boolean),
      };
    })
    .filter((slot) => slot.place !== "" && (slot.usd !== undefined || slot.teams.length > 0));
}

export interface LiquipediaBracketOpponent {
  name?: string;
  score?: number;
  scoreRaw?: string;
  winner?: boolean;
}

export interface LiquipediaBracketMap {
  name?: string;
  scores?: [number, number];
  winner?: number;
  vod?: string;
}

export interface LiquipediaBracketMatch {
  key: string;
  round: number;
  order: number;
  opponents: LiquipediaBracketOpponent[];
  maps: LiquipediaBracketMap[];
  bestOf?: number;
  winner?: number;
  dateRaw?: string;
  resolved: boolean;
}

export interface LiquipediaBracket {
  layout?: string;
  id?: string;
  status: "ready" | "empty";
  /** A machine code, never display copy: Harbor has 16 locales and this file adds no i18n key. */
  reason?: "empty-match-stubs";
  rounds: { round: number; matches: LiquipediaBracketMatch[] }[];
  matchCount: number;
  resolvedCount: number;
}

const SIDE_ROUNDS = [/^(?:o\d+)?t1(?:ct|t)$/, /^(?:o\d+)?t2(?:ct|t)$/];

/** CS2 inlines per-half CT/T round wins plus overtime halves instead of a map score. Sum them. */
function mapScores(p: Record<string, string>): [number, number] | undefined {
  const [first, second] = [num(p.score1), num(p.score2)];
  if (first !== undefined && second !== undefined) return [first, second];
  const halves = SIDE_ROUNDS.map((side) =>
    Object.entries(p)
      .filter(([key]) => side.test(key))
      .reduce((sum, [, value]) => sum + (num(value) ?? 0), 0),
  );
  return halves[0] + halves[1] > 0 ? [halves[0], halves[1]] : undefined;
}

function bracketOpponent(raw: string): LiquipediaBracketOpponent {
  const tpl = findTemplates(raw ?? "", OPPONENTS)[0];
  if (!tpl) return {};
  const scoreRaw = cleanWikitext(tpl.params.score ?? "");
  return {
    name: opponentName(tpl) || undefined,
    score: num(scoreRaw),
    scoreRaw: scoreRaw || undefined,
    winner: tpl.params.win === "1" || undefined,
  };
}

function bracketMatch(
  key: string,
  round: number,
  order: number,
  tpl: LpTemplate,
): LiquipediaBracketMatch {
  const p = tpl.params;
  const opponents = [1, 2].map((n) => bracketOpponent(p[`opponent${n}`] ?? ""));
  const maps: LiquipediaBracketMap[] = [];
  for (let n = 1; n <= 9; n += 1) {
    const map = findTemplates(p[`map${n}`] ?? "", ["map"])[0];
    if (!map) continue;
    maps.push({
      name: cleanWikitext(map.params.map || map.args[0] || "") || undefined,
      scores: mapScores(map.params),
      winner: num(map.params.winner),
      vod: safeUrl(map.params.vod || p[`vodgame${n}`] || ""),
    });
  }
  return {
    key,
    round,
    order,
    opponents,
    maps,
    bestOf: num(p.bestof),
    winner: num(p.winner),
    dateRaw: cleanWikitext(p.date ?? "") || undefined,
    resolved: opponents.some((side) => Boolean(side.name)),
  };
}

/**
 * Every {{Bracket}} on the page. One whose matches resolve no opponent comes back status "empty"
 * and must never be drawn: seven empty {{Match}} stubs produce nothing, not a ghost tree of TBDs.
 */
export function parseBrackets(wikitext: string): LiquipediaBracket[] {
  return findTemplates(denoise(wikitext), ["bracket"]).map((tpl): LiquipediaBracket => {
    const matches: LiquipediaBracketMatch[] = [];
    for (const [key, value] of Object.entries(tpl.params)) {
      const slot = /^r(\d+)[a-z]*(\d+)$/.exec(key) ?? /^r(\d+)$/.exec(key);
      const match = slot ? findTemplates(value, ["match"])[0] : undefined;
      if (!slot || !match) continue;
      const order = slot[2] === undefined ? matches.length + 1 : Number(slot[2]);
      matches.push(bracketMatch(key, Number(slot[1]), order, match));
    }
    const byRound = new Map<number, LiquipediaBracketMatch[]>();
    for (const match of matches) {
      const bucket = byRound.get(match.round);
      if (bucket) bucket.push(match);
      else byRound.set(match.round, [match]);
    }
    const resolvedCount = matches.filter((match) => match.resolved).length;
    return {
      layout: cleanWikitext(tpl.args[0] ?? "") || undefined,
      id: tpl.params.id || undefined,
      status: resolvedCount > 0 ? "ready" : "empty",
      reason: resolvedCount > 0 ? undefined : "empty-match-stubs",
      rounds: [...byRound.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([round, list]) => ({ round, matches: list.sort((a, b) => a.order - b.order) })),
      matchCount: matches.length,
      resolvedCount,
    };
  });
}

const AGENT = "HarborEsports/1.0 (https://harbor.site; bugs@harbor.site)";

/**
 * Api-User-Agent is MediaWiki's own channel for platforms that own the User-Agent header. Harbor's
 * Rust bridge forwards both verbatim, and reqwest's gzip feature is enabled in src-tauri/Cargo.toml,
 * so setting Accept-Encoding by hand satisfies the edge and the body still arrives decoded.
 */
const HEADERS: Record<string, string> = {
  "User-Agent": AGENT,
  "Api-User-Agent": AGENT,
  "Accept-Encoding": "gzip",
  Accept: "application/json",
};

const MINUTE = 60_000;
const GENERAL_GAP_MS = 2_000;
/** Nothing here calls action=parse, since parseSections() reads the outline out of wikitext. The
 *  lane is still enforced so that whoever adds the first action=parse caller inherits it. */
const PARSE_GAP_MS = 30_000;
const BAN_BACKOFF_MS = 2 * MINUTE;
const MAX_BODY = 4_000_000;

export const LIQUIPEDIA_TTL = {
  live: 15 * MINUTE,
  running: 6 * 60 * MINUTE,
  settled: 30 * 24 * 60 * MINUTE,
};

export interface LiquipediaLanes {
  generalAt: number;
  parseAt: number;
}

/** Pure, so the two-lane spacing is testable without waiting on a real clock. */
export function reserveLiquipediaSlot(
  lanes: LiquipediaLanes,
  parse: boolean,
  now: number,
): { at: number; lanes: LiquipediaLanes } {
  const at = Math.max(now, lanes.generalAt, parse ? lanes.parseAt : 0);
  return {
    at,
    lanes: { generalAt: at + GENERAL_GAP_MS, parseAt: parse ? at + PARSE_GAP_MS : lanes.parseAt },
  };
}

export type LiquipediaReader = (
  url: string,
  headers: Record<string, string>,
) => Promise<{ status: number; ok: boolean; text: string }>;

export interface LiquipediaOptions {
  ttlMs?: number;
  signal?: AbortSignal;
  /** Tests inject this; it is the only seam, so a test that forgets it reaches no network either. */
  read?: LiquipediaReader;
}

let lanes: LiquipediaLanes = { generalAt: 0, parseAt: 0 };
let chain: Promise<unknown> = Promise.resolve();

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Liquipedia request was cancelled"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("Liquipedia request was cancelled"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** One queue for the whole app: overlapping event pages are exactly what trips the ban. */
function enqueue<T>(job: () => Promise<T>, parse: boolean, signal?: AbortSignal): Promise<T> {
  const run = chain.then(async () => {
    const slot = reserveLiquipediaSlot(lanes, parse, Date.now());
    lanes = slot.lanes;
    const wait = slot.at - Date.now();
    if (wait > 0) await sleep(wait, signal);
    return job();
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function defaultReader(url: string, headers: Record<string, string>) {
  const { safeFetch } = await import("@/lib/safe-fetch");
  const response = await safeFetch(url, { headers });
  return { status: response.status, ok: response.ok, text: await response.text() };
}

function apiUrl(wiki: LiquipediaWiki, params: Record<string, string>): string {
  const query = new URLSearchParams({ format: "json", formatversion: "2", ...params });
  return `https://liquipedia.net/${wiki}/api.php?${query}`;
}

function request(url: string, parse: boolean, options: LiquipediaOptions): Promise<string> {
  const read = options.read ?? defaultReader;
  return enqueue(
    async () => {
      const response = await read(url, HEADERS);
      if (response.status === 406) throw new Error("Liquipedia requires Accept-Encoding: gzip");
      if ([403, 429, 503].includes(response.status)) {
        // Their bans escalate, so one refusal parks both lanes rather than retrying into it.
        const until = Date.now() + BAN_BACKOFF_MS;
        lanes = {
          generalAt: Math.max(lanes.generalAt, until),
          parseAt: Math.max(lanes.parseAt, until),
        };
        throw new Error(`Liquipedia throttled this client (${response.status})`);
      }
      if (!response.ok) throw new Error(`Liquipedia returned ${response.status}`);
      if (response.text.length > MAX_BODY) throw new Error("Liquipedia response is too large");
      return response.text;
    },
    parse,
    options.signal,
  );
}

const CACHE_PREFIX = "harbor.liquipedia.";
const INDEX_KEY = `${CACHE_PREFIX}index`;
const CACHE_MAX = 96;
const durable = () => typeof indexedDB !== "undefined";

type Cached = { at: number; text: string };

const memory = new Map<string, Cached>();
let index: Record<string, number> | null = null;
let indexTimer: ReturnType<typeof setTimeout> | undefined;

async function cacheRead(key: string): Promise<Cached | null> {
  const hot = memory.get(key);
  if (hot) return hot;
  if (!durable()) return null;
  const stored = (await idbCacheGet(CACHE_PREFIX + key))?.data as Cached | undefined;
  if (!stored || typeof stored.text !== "string") return null;
  memory.set(key, stored);
  return stored;
}

async function cacheWrite(key: string, entry: Cached): Promise<void> {
  memory.set(key, entry);
  if (!durable()) return;
  await idbCacheSet(CACHE_PREFIX + key, { at: entry.at, data: entry });
  if (!index) index = ((await idbCacheGet(INDEX_KEY))?.data as Record<string, number>) ?? {};
  const map = index;
  map[key] = entry.at;
  const keys = Object.keys(map).sort((a, b) => (map[a] ?? 0) - (map[b] ?? 0));
  for (const stale of keys.slice(0, Math.max(0, keys.length - CACHE_MAX))) {
    delete map[stale];
    memory.delete(stale);
    void idbCacheDelete(CACHE_PREFIX + stale);
  }
  clearTimeout(indexTimer);
  const snapshot = { ...map };
  indexTimer = setTimeout(() => void idbCacheSet(INDEX_KEY, { at: Date.now(), data: snapshot }), 1000);
}

// The durable copy survives either way, so only an aggressive pass gives up the warm pages.
registerEvictable("liquipedia", (aggressive) => {
  if (aggressive) memory.clear();
});

export interface LiquipediaText {
  text: string;
  fetchedAt: number;
  /** True when the network failed and a cached copy past its TTL is being served instead. */
  stale: boolean;
}

const inFlight = new Map<string, Promise<LiquipediaText | null>>();

function revisionContent(raw: string): string | undefined {
  type Page = { missing?: boolean; revisions?: { slots?: { main?: { content?: string } } }[] };
  const root = JSON.parse(raw) as { error?: { info?: string }; query?: { pages?: Page[] } };
  if (root.error) throw new Error(`Liquipedia: ${root.error.info ?? "api error"}`);
  const page = root.query?.pages?.[0];
  const content = page && !page.missing ? page.revisions?.[0]?.slots?.main?.content : undefined;
  return typeof content === "string" && content ? content : undefined;
}

/**
 * prop=revisions wikitext, which sits on the 2-second lane. A page cached inside its TTL costs
 * nothing, concurrent callers share one request, and a network failure with any cached copy at all
 * serves that copy stale rather than emptying the surface. The first caller's TTL wins a race.
 */
export function liquipediaWikitext(
  wiki: LiquipediaWiki,
  page: string,
  options: LiquipediaOptions = {},
): Promise<LiquipediaText | null> {
  const key = `${wiki}/${normPage(page)}`;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const work = (async () => {
    const cached = await cacheRead(key);
    if (cached && Date.now() - cached.at < (options.ttlMs ?? LIQUIPEDIA_TTL.running))
      return { text: cached.text, fetchedAt: cached.at, stale: false };
    const url = apiUrl(wiki, {
      action: "query",
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
      titles: normPage(page),
    });
    try {
      const text = revisionContent(await request(url, false, options));
      if (!text) return cached ? { text: cached.text, fetchedAt: cached.at, stale: true } : null;
      const at = Date.now();
      await cacheWrite(key, { at, text });
      return { text, fetchedAt: at, stale: false };
    } catch (error) {
      if (cached) return { text: cached.text, fetchedAt: cached.at, stale: true };
      throw error;
    }
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, work);
  return work;
}

/** Infobox fields, resolving the measured prizepoolusd transclusion with one extra read. */
export async function liquipediaLeague(
  wiki: LiquipediaWiki,
  page: string,
  options: LiquipediaOptions = {},
): Promise<LiquipediaLeague | null> {
  const doc = await liquipediaWikitext(wiki, page, options);
  const league = doc ? parseLeagueInfobox(doc.text, wiki, page) : null;
  if (!league?.prizePoolPage) return league;
  const sub = await liquipediaWikitext(wiki, league.prizePoolPage, options).catch(() => null);
  const usd = sub ? parseMoney(sub.text) : undefined;
  return usd === undefined
    ? league
    : { ...league, prizePoolUsd: usd, prizePoolRaw: sub?.text.trim() };
}

export type LiquipediaBracketGap = "unsupported-wiki" | "no-bracket" | "empty-match-stubs";

/** Ready brackets only. `gap` is a machine code explaining an empty list, not display copy. */
export async function liquipediaBrackets(
  wiki: LiquipediaWiki,
  page: string,
  options: LiquipediaOptions = {},
): Promise<{ brackets: LiquipediaBracket[]; gap?: LiquipediaBracketGap }> {
  if (!LIQUIPEDIA_INLINE_BRACKETS.has(wiki)) return { brackets: [], gap: "unsupported-wiki" };
  const doc = await liquipediaWikitext(wiki, page, options);
  const parsed = doc ? parseBrackets(doc.text) : [];
  const ready = parsed.filter((bracket) => bracket.status === "ready");
  if (ready.length) return { brackets: ready };
  return { brackets: [], gap: parsed.length ? "empty-match-stubs" : "no-bracket" };
}

/** Subpage discovery. Pass "Event/" to restrict the listing to one event's own stage pages. */
export async function liquipediaSubpages(
  wiki: LiquipediaWiki,
  prefix: string,
  options: LiquipediaOptions = {},
): Promise<string[]> {
  const url = apiUrl(wiki, {
    action: "query",
    list: "allpages",
    apprefix: normPage(prefix),
    apnamespace: "0",
    aplimit: "100",
  });
  const root = JSON.parse(await request(url, false, options)) as {
    query?: { allpages?: { title?: string }[] };
  };
  return (root.query?.allpages ?? []).map((row) => String(row.title ?? "")).filter(Boolean);
}
