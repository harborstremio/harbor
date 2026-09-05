import { detectCountry, detectCountryFromGroup } from "@/lib/iptv/country-detect";
import { hasArabic, normalizeArabic } from "@/lib/iptv/rtl";
import type { IptvChannel } from "@/lib/iptv/types";
import type { LeagueDef, SportsGame, SportsSide } from "@/lib/sports/espn";
import { sportsLeagueByTag } from "@/lib/sports/provider";
import {
  BLOC,
  BRACKET_PREFIX,
  COMMON_TEAM_WORDS,
  FLAG_RE,
  JUNK_RE,
  LABEL_SEP_RE,
  LEAGUE_ALIASES,
  MARKS_RE,
  NETWORKS,
  NET_BY_ID,
  NEUTRAL_PREFIX,
  PATH_REGION,
  QUALITY_RE,
  RAW_QUALITY_RE,
  SEP_PREFIX,
  SPORTY_RE,
  TEAM_STOP,
} from "./iptv-networks";

export type MatchReasonKind = "attached" | "team" | "league" | "listing" | "network" | "region";
export type MatchReason = { kind: MatchReasonKind; label: string };
export type MatchTier = "exact" | "likely" | "possible";

export type ChannelMatch = {
  channel: IptvChannel;
  label: string;
  score: number;
  confidence: number;
  tier: MatchTier;
  attached: boolean;
  reasons: MatchReason[];
};

export type PreparedChannel = {
  channel: IptvChannel;
  label: string;
  norm: string;
  pad: string;
  compact: string;
  brand: string;
  tokens: Set<string>;
  groupPad: string;
  region: string | null;
  regionLabel: string;
  networks: string[];
  number: number | null;
};

export type SportsChannelIndex = { channels: PreparedChannel[]; scanned: number };

export type MatchOptions = {
  attachedIds?: readonly string[];
  broadcastNames?: readonly string[];
  limit?: number;
};

const W_TEAM_BOTH = 60;
const W_TEAM_ONE = 26;
const W_TEAM_WEAK = 16;
const W_LEAGUE = 34;
const W_LEAGUE_GROUP = 12;
const W_NET_LEAGUE = 30;
const W_NET_GROUP = 14;
const W_NET_ANY = 6;
const W_NET_REGION = 6;
const W_LISTING_EXACT = 34;
const W_LISTING_NUMBER = 26;
const W_LISTING_BRAND = 14;
const P_LISTING_NUMBER = 16;
const W_REGION = 5;
const SATURATION = 92;
const FLOOR = 20;
const LABEL_MAX = 24;
const DEGLUE_RE = /\b([\p{L}]{3,})(\d{1,2})\b/gu;

function stripPrefix(name: string): { region: string | null; rest: string } {
  const flags = FLAG_RE.exec(name);
  let rest = flags ? name.slice(flags[0].length).trim() : name.trim();
  let region = flags ? (detectCountryFromGroup(flags[0])?.code ?? null) : null;
  for (let i = 0; i < 2; i++) {
    const m = BRACKET_PREFIX.exec(rest) ?? SEP_PREFIX.exec(rest);
    if (!m || !m[1]) break;
    const country = detectCountryFromGroup(m[1]);
    if (!country && !NEUTRAL_PREFIX.has(m[1].toLowerCase())) break;
    const next = rest.slice(m[0].length).trim();
    if (!next) break;
    if (country) region = region ?? country.code;
    rest = next;
  }
  return { region, rest };
}

export function normalizeChannelName(name: string): string {
  const { rest } = stripPrefix(name);
  let s = hasArabic(rest) ? normalizeArabic(rest) : rest;
  s = s.toLowerCase().normalize("NFKD").replace(MARKS_RE, "");
  s = s.replace(/[^\p{L}\p{N}]+/gu, " ");
  s = s.replace(DEGLUE_RE, "$1 $2");
  s = s.replace(QUALITY_RE, " ");
  return s.replace(/\s+/g, " ").trim();
}

export function channelChipLabel(name: string): string {
  const { rest } = stripPrefix(name);
  const cleaned = rest
    .replace(RAW_QUALITY_RE, " ")
    .replace(LABEL_SEP_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
  const out = cleaned || name.trim();
  if (out.length <= LABEL_MAX) return out;
  const cut = out.slice(0, LABEL_MAX);
  const space = cut.lastIndexOf(" ");
  return `${(space >= 12 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

function numberOf(norm: string): number | null {
  const parts = norm.split(" ");
  for (let i = parts.length - 1; i >= 0; i--) {
    if (/^\d{1,2}$/.test(parts[i])) return Number(parts[i]);
    const glued = /^[\p{L}]{2,}(\d{1,2})$/u.exec(parts[i]);
    if (glued) return Number(glued[1]);
  }
  return null;
}

export function leagueForTag(tag: string): LeagueDef | undefined {
  return sportsLeagueByTag(tag);
}

function pushPhrase(out: Set<string>, raw: string | undefined): void {
  if (!raw) return;
  const s = normalizeChannelName(raw);
  if (s.length >= 3 || /\d/.test(s)) out.add(s);
}

export function leagueKeywords(leagueTag: string): string[] {
  const out = new Set<string>();
  const def = leagueForTag(leagueTag);
  if (def) {
    pushPhrase(out, def.labelEn);
    pushPhrase(out, def.label);
    pushPhrase(out, def.key);
  }
  pushPhrase(out, leagueTag);
  for (const alias of (LEAGUE_ALIASES[leagueTag] ?? "").split("|")) pushPhrase(out, alias);
  out.delete("");
  return [...out];
}

function regionForLeague(def: LeagueDef | undefined): string | null {
  if (!def) return null;
  const seg = def.path.split("/")[1] ?? "";
  return PATH_REGION[seg.split(".")[0]] ?? PATH_REGION[seg] ?? null;
}

function regionStrength(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  if (a === b) return 2;
  const ba = BLOC[a] ?? a;
  const bb = BLOC[b] ?? b;
  return ba === b || a === bb || ba === bb ? 1 : 0;
}

type TeamProfile = { name: string; phrase: string; words: string[]; abbr: string | null };

function teamProfile(side: SportsSide): TeamProfile {
  const phrase = normalizeChannelName(side.name);
  const words = phrase.split(" ").filter((w) => w.length >= 4 && !TEAM_STOP.has(w));
  const abbr = side.abbr && side.abbr.length >= 3 ? side.abbr.toLowerCase() : null;
  return { name: side.name || side.abbr, phrase, words, abbr };
}

function prepare(channel: IptvChannel): PreparedChannel {
  const { region: prefixRegion, rest } = stripPrefix(channel.name);
  const norm = normalizeChannelName(channel.name);
  const rawGroup = channel.group ?? "";
  const groupNorm = hasArabic(rawGroup) ? normalizeArabic(rawGroup) : rawGroup.toLowerCase();
  const compact = norm.replace(/[^\p{L}\p{N}]/gu, "");
  const country = detectCountry(channel);
  const networks: string[] = [];
  for (const n of NETWORKS) if (n.re.test(norm)) networks.push(n.id);
  return {
    channel,
    label: channelChipLabel(rest || channel.name),
    norm,
    pad: ` ${norm} `,
    compact,
    brand: compact.replace(/\d+/g, ""),
    tokens: new Set(norm.split(" ").filter(Boolean)),
    groupPad: ` ${groupNorm} `,
    region: country?.code ?? prefixRegion,
    regionLabel: country?.name ?? prefixRegion ?? "",
    networks,
    number: numberOf(norm),
  };
}

const INDEX_CACHE = new WeakMap<readonly IptvChannel[], SportsChannelIndex>();

export function buildSportsChannelIndex(channels: readonly IptvChannel[]): SportsChannelIndex {
  const cached = INDEX_CACHE.get(channels);
  if (cached) return cached;
  const out: PreparedChannel[] = [];
  for (const channel of channels) {
    if (!channel.url || !channel.name) continue;
    const p = prepare(channel);
    if (p.norm.length < 2 || JUNK_RE.test(p.norm)) continue;
    const sporty =
      p.networks.length > 0 ||
      SPORTY_RE.test(p.norm) ||
      SPORTY_RE.test(p.groupPad) ||
      SPORTY_RE.test(channel.name.toLowerCase());
    if (!sporty) continue;
    out.push(p);
  }
  const index: SportsChannelIndex = { channels: out, scanned: channels.length };
  INDEX_CACHE.set(channels, index);
  return index;
}

type Listing = { norm: string; brand: string; number: number | null };

function listingsOf(names: readonly string[]): Listing[] {
  const out: Listing[] = [];
  for (const raw of names) {
    const norm = normalizeChannelName(raw);
    if (norm.length < 2) continue;
    const compact = norm.replace(/[^\p{L}\p{N}]/gu, "");
    out.push({ norm, brand: compact.replace(/\d+/g, ""), number: numberOf(norm) });
  }
  return out;
}

function scoreTeams(p: PreparedChannel, teams: TeamProfile[], reasons: MatchReason[]): number {
  let hits = 0;
  let weak = 0;
  for (const team of teams) {
    if (team.phrase.length >= 4 && p.pad.includes(` ${team.phrase} `)) {
      hits += 1;
      reasons.push({ kind: "team", label: team.name });
      continue;
    }
    const matched = team.words.filter((w) => p.tokens.has(w));
    const strong =
      matched.length >= 2 ||
      (matched.length === 1 && matched[0].length >= 5 && !COMMON_TEAM_WORDS.has(matched[0]));
    if (strong) {
      hits += 1;
      reasons.push({ kind: "team", label: team.name });
    } else if (team.abbr && p.tokens.has(team.abbr)) {
      weak += 1;
    }
  }
  return hits >= 2 ? W_TEAM_BOTH : hits === 1 ? W_TEAM_ONE : weak >= 2 ? W_TEAM_WEAK : 0;
}

function scoreNetworks(
  p: PreparedChannel,
  tag: string,
  group: string,
  leagueRegion: string | null,
  reasons: MatchReason[],
): number {
  let best = 0;
  let bestBase = 0;
  let bestLabel = "";
  for (const id of p.networks) {
    const n = NET_BY_ID.get(id);
    if (!n) continue;
    const base = n.leagues.includes(tag) ? W_NET_LEAGUE : group && n.groups.includes(group) ? W_NET_GROUP : W_NET_ANY;
    const total = base + regionStrength(n.region, leagueRegion) * W_NET_REGION;
    if (total > best) {
      best = total;
      bestBase = base;
      bestLabel = n.label;
    }
  }
  if (bestBase >= W_NET_GROUP) reasons.push({ kind: "network", label: bestLabel });
  return best;
}

function scoreListings(p: PreparedChannel, listings: Listing[], reasons: MatchReason[]): number {
  for (const listing of listings) {
    if (p.pad.includes(` ${listing.norm} `)) {
      reasons.push({ kind: "listing", label: listing.norm });
      return W_LISTING_EXACT;
    }
    const brandHit =
      listing.brand.length >= 4 &&
      p.brand.length >= 4 &&
      (listing.brand.startsWith(p.brand) || p.brand.startsWith(listing.brand));
    if (!brandHit) continue;
    if (listing.number == null || p.number == null) return W_LISTING_BRAND;
    if (listing.number !== p.number) return -P_LISTING_NUMBER;
    reasons.push({ kind: "listing", label: listing.norm });
    return W_LISTING_NUMBER;
  }
  return 0;
}

function tierOf(confidence: number, attached: boolean): MatchTier {
  if (attached || confidence >= 0.85) return "exact";
  return confidence >= 0.5 ? "likely" : "possible";
}

export function matchChannelsForGame(
  game: SportsGame,
  index: SportsChannelIndex,
  opts: MatchOptions = {},
): ChannelMatch[] {
  const attachedIds = new Set(opts.attachedIds ?? []);
  const def = leagueForTag(game.league);
  const keywords = leagueKeywords(game.league);
  const leagueLabel = def?.labelEn ?? game.league;
  const leagueRegion = regionForLeague(def);
  const group = def?.group ?? "";
  const teams = [teamProfile(game.home), teamProfile(game.away)];
  const listings = listingsOf(opts.broadcastNames ?? []);
  const out: ChannelMatch[] = [];

  for (const p of index.channels) {
    const attached = attachedIds.has(p.channel.id);
    const reasons: MatchReason[] = [];
    let score = scoreTeams(p, teams, reasons);

    for (const kw of keywords) {
      if (p.pad.includes(` ${kw} `)) {
        score += W_LEAGUE;
        reasons.push({ kind: "league", label: leagueLabel });
        break;
      }
      if (p.groupPad.includes(` ${kw} `)) {
        score += W_LEAGUE_GROUP;
        reasons.push({ kind: "league", label: leagueLabel });
        break;
      }
    }

    score += scoreNetworks(p, game.league, group, leagueRegion, reasons);
    score += scoreListings(p, listings, reasons);

    const regionFit = regionStrength(p.region, leagueRegion);
    if (regionFit > 0) {
      score += regionFit * W_REGION;
      if (p.regionLabel) reasons.push({ kind: "region", label: p.regionLabel });
    }

    if (!attached && score < FLOOR) continue;
    const confidence = attached ? 1 : Math.max(0, Math.min(1, score / SATURATION));
    out.push({
      channel: p.channel,
      label: p.label,
      score,
      confidence: Math.round(confidence * 100) / 100,
      tier: tierOf(confidence, attached),
      attached,
      reasons: attached ? [{ kind: "attached", label: leagueLabel }, ...reasons] : reasons,
    });
  }

  out.sort((a, b) => {
    if (a.attached !== b.attached) return a.attached ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    return a.label.localeCompare(b.label);
  });
  return out.slice(0, opts.limit ?? 8);
}

export function bestChannelForGame(
  game: SportsGame,
  index: SportsChannelIndex,
  opts: MatchOptions = {},
): ChannelMatch | null {
  return matchChannelsForGame(game, index, { ...opts, limit: 1 })[0] ?? null;
}

export function searchSportsChannels(
  index: SportsChannelIndex,
  query: string,
  limit = 40,
): PreparedChannel[] {
  const q = normalizeChannelName(query);
  if (!q) return index.channels.slice(0, limit);
  const compact = q.replace(/\s+/g, "");
  const out: PreparedChannel[] = [];
  for (const p of index.channels) {
    if (p.norm.includes(q) || p.compact.includes(compact)) out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}
