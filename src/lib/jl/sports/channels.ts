import type { EpgIndex, IptvChannel } from "../../iptv/types.ts";
import type { SportsGame, SportsSide } from "../../sports/espn.ts";
import { parseEventChannel, teamKey, type ParsedEvent } from "./event-parse.ts";

/**
 * "Which of my channels has this game?" against the customer's own playlist, on the device:
 *  1. provider event channels ("NCAAF 03: #1 Texas vs. #14 Tennessee @ 26 Sep 12:00 PM ET"),
 *  2. the broadcast network's channel ("ESPN" → "US: ESPN HD"),
 *  3. guide listings that name both teams, or the league's generic listing in the home city.
 */

export type GameChannelSource = "event" | "network" | "guide";

export type GameChannel = { channel: IptvChannel; via: GameChannelSource; alternate: boolean };

type GuideProgram = { tvgId: string; title: string; description: string; startMs: number; endMs: number };

export type SportsChannelIndex = {
  events: Array<{ channel: IptvChannel; event: ParsedEvent }>;
  named: Array<{ channel: IptvChannel; upper: string }>;
  byTvgId: Map<string, IptvChannel[]>;
  guide: GuideProgram[];
};

const MAX_CHANNELS = 6;
const SAME_GAME_MS = 20 * 60000;
const FOOTBALL_SPORT: Record<string, "nfl" | "cfb"> = { NFL: "nfl", NCAAF: "cfb" };
const PRO_LEAGUES = new Set(["NFL", "NBA", "NHL", "MLB"]);

const GENERIC_LISTINGS: Record<string, RegExp> = {
  MLB: /^(MLB Baseball|Major League Baseball)/i,
  NBA: /^NBA\b/i,
  NHL: /^NHL\b/i,
  NFL: /^NFL\b/i,
};

/** Builds the lookup once per playlist/guide refresh; game lookups then stay cheap. */
export function buildSportsChannelIndex(
  channels: IptvChannel[],
  epg: EpgIndex | null,
  now: Date,
): SportsChannelIndex {
  const events: SportsChannelIndex["events"] = [];
  const named: SportsChannelIndex["named"] = [];
  const byTvgId = new Map<string, IptvChannel[]>();
  for (const channel of channels) {
    const event = parseEventChannel(channel.name, channel.group ?? "", now);
    if (event) {
      events.push({ channel, event });
      continue;
    }
    named.push({ channel, upper: channel.name.toUpperCase() });
    if (channel.tvgId) {
      const list = byTvgId.get(channel.tvgId);
      if (list) list.push(channel);
      else byTvgId.set(channel.tvgId, [channel]);
    }
  }
  const guide: GuideProgram[] = [];
  if (epg) {
    const from = now.getTime() - 5 * 3600000;
    const to = now.getTime() + 18 * 3600000;
    for (const [tvgId, programs] of epg.byChannel) {
      if (!byTvgId.has(tvgId)) continue;
      for (const p of programs) {
        if (p.endMs <= from || p.startMs >= to) continue;
        guide.push({
          tvgId,
          title: teamKey(p.title),
          description: (p.description ?? "").toLowerCase(),
          startMs: p.startMs,
          endMs: p.endMs,
        });
      }
    }
  }
  return { events, named, byTvgId, guide };
}

function sideKeys(side: SportsSide): string[] {
  return [side.location, side.name].filter((n): n is string => !!n).map(teamKey).filter((k) => k.length >= 2);
}

function keysMatch(a: string, b: string): boolean {
  return a === b || (a.length > 4 && b.length > 4 && (a.startsWith(`${b} `) || b.startsWith(`${a} `)));
}

function eventChannels(game: SportsGame, index: SportsChannelIndex): GameChannel[] {
  const sport = FOOTBALL_SPORT[game.league];
  if (!sport || !game.startMs) return [];
  const keys = [...sideKeys(game.away), ...sideKeys(game.home)];
  return index.events
    .filter(({ event }) => {
      if (event.sport !== sport) return false;
      if (Math.abs(event.start.getTime() - game.startMs) > SAME_GAME_MS) return false;
      return event.teams.some((t) => {
        const k = teamKey(t.name);
        return keys.some((j) => keysMatch(k, j));
      });
    })
    .map(({ channel, event }) => ({ channel, via: "event" as const, alternate: event.alternate }));
}

const ALIASES: Record<string, string[]> = {
  FS1: ["FS1", "FOX SPORTS 1"],
  FS2: ["FS2", "FOX SPORTS 2"],
  ESPNU: ["ESPNU"],
  ESPN2: ["ESPN2", "ESPN 2"],
  "NFL Net": ["NFL NETWORK"],
  "NFL Network": ["NFL NETWORK"],
  "MLB Net": ["MLB NETWORK"],
  "MLB Network": ["MLB NETWORK"],
  "NBA TV": ["NBA TV"],
  "NHL Net": ["NHL NETWORK"],
  "NHL Network": ["NHL NETWORK"],
  BTN: ["BIG TEN NETWORK", "BTN"],
  "Big Ten Network": ["BIG TEN NETWORK", "BTN"],
  "SEC Network": ["SEC NETWORK"],
  SECN: ["SEC NETWORK"],
  "ACC Network": ["ACC NETWORK"],
  ACCN: ["ACC NETWORK"],
  "CBS Sports Network": ["CBS SPORTS NETWORK", "CBSSN"],
  CBSSN: ["CBS SPORTS NETWORK", "CBSSN"],
  "USA Net": ["USA NETWORK"],
  "Golf Channel": ["GOLF CHANNEL", "GOLF"],
  "Tennis Channel": ["TENNIS CHANNEL"],
  "TNT Sports": ["TNT"],
  truTV: ["TRUTV"],
};

// Streaming-only services have no linear channel to match.
const STREAMING_ONLY = /^(ESPN\+|Peacock|Prime Video|Paramount\+|Max|Apple TV\+?|Netflix|DAZN|YouTube)$/i;
// Fallback picks skip spin-off feeds ("NBC NEWS NOW", "NBC CNBC", event PPV channels).
const SPIN_OFF = /\b(NEWS|NOW|LX|SN|CNBC|MSNBC|PPV|EVENT|PLUS)\b|\+/i;
const PREFIX = "^((US|USA)[:| ]*)?";
const QUALITY_SUFFIX = "( (HD|FHD|SD|EAST|4K))*( ?\\*)?";
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function searchTerms(network: string): string[] {
  return ALIASES[network] ?? [network.replace(/^The /i, "").replace(/ (Network|Channel)$/i, "").toUpperCase()];
}

export function networkChannel(network: string, index: SportsChannelIndex): IptvChannel | null {
  if (STREAMING_ONLY.test(network.trim())) return null;
  for (const term of searchTerms(network)) {
    const word = escapeRegex(term.trim());
    if (word.length < 2) continue;
    const any = new RegExp(`${PREFIX}${word}( |\\*|$)`, "i");
    const list = index.named.filter((n) => any.test(n.upper));
    if (!list.length) continue;
    const plain = new RegExp(`${PREFIX}${word}${QUALITY_SUFFIX}$`, "i");
    const rest = (name: string) => name.replace(new RegExp(`${PREFIX}${word}`, "i"), "");
    const pick =
      list.filter((n) => plain.test(n.upper)).sort((a, b) => a.upper.length - b.upper.length)[0] ??
      list.filter((n) => !SPIN_OFF.test(rest(n.upper))).sort((a, b) => a.upper.length - b.upper.length)[0];
    if (pick) return pick.channel;
  }
  return null;
}

function guideTerm(side: SportsSide, league: string): string {
  const raw = PRO_LEAGUES.has(league) ? side.nickname || side.name : side.location || side.name;
  return teamKey(raw ?? "");
}

function guideChannels(game: SportsGame, index: SportsChannelIndex, now: Date): GameChannel[] {
  if (!index.guide.length) return [];
  const at = game.state === "in" ? now.getTime() : game.startMs || now.getTime();
  const near = index.guide.filter((p) => p.startMs <= at + 30 * 60000 && p.endMs > at - 60 * 60000);
  const a = guideTerm(game.away, game.league);
  const b = guideTerm(game.home, game.league);
  const has = (title: string, term: string) => term.length >= 3 && ` ${title} `.includes(` ${term} `);
  let hits = near.filter((p) => has(p.title, a) && has(p.title, b));
  const city = game.home.location?.toLowerCase();
  const listing = GENERIC_LISTINGS[game.league];
  if (!hits.length && listing && city && city.length >= 3 && PRO_LEAGUES.has(game.league)) {
    hits = near.filter((p) => listing.test(p.title) && p.description.includes(` in ${city}`));
  }
  const tvgIds = [...new Set(hits.map((p) => p.tvgId))];
  const rank = (c: IptvChannel) => (/back ?up/i.test(c.name) ? 3 : /^(USA|US)[ :|]/i.test(c.name) ? 0 : 1);
  return tvgIds
    .flatMap((id) => index.byTvgId.get(id) ?? [])
    .sort((x, y) => rank(x) - rank(y))
    .map((channel) => ({ channel, via: "guide" as const, alternate: false }));
}

/** Channels for one game, best first: main event feeds, then the network, guide matches, then alternate feeds. */
export function channelsForGame(game: SportsGame, index: SportsChannelIndex, now: Date): GameChannel[] {
  const events = eventChannels(game, index);
  const network = game.network ? networkChannel(game.network, index) : null;
  const ordered: GameChannel[] = [
    ...events.filter((c) => !c.alternate),
    ...(network ? [{ channel: network, via: "network" as const, alternate: false }] : []),
    ...guideChannels(game, index, now),
    ...events.filter((c) => c.alternate),
  ];
  const seen = new Set<string>();
  const out: GameChannel[] = [];
  for (const c of ordered) {
    if (seen.has(c.channel.id)) continue;
    seen.add(c.channel.id);
    out.push(c);
    if (out.length >= MAX_CHANNELS) break;
  }
  return out;
}
