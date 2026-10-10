import { useEffect, useMemo, useRef, useState } from "react";
import type { SportsGame } from "@/lib/sports/espn-types";
import { SPORTS_BROADCASTS } from "@/lib/sports/broadcasts";
import { esportsGame } from "@/lib/sports/esports-catalog";
import {
  fetchEsportsFeed,
  type EsportsGameId,
  type EsportsMatch,
} from "@/lib/sports/esports-feeds";
import { esportsExternalUrl, type EsportsStream } from "@/lib/sports/esports-streams";

const LEAGUE_GAMES: Record<string, EsportsGameId> = {
  DOTA2: "dota2",
  DOTA: "dota2",
  TI: "dota2",
  LCK: "lol",
  LEC: "lol",
  LPL: "lol",
  LCS: "lol",
  LTA: "lol",
  MSI: "lol",
  WORLDS: "lol",
  RLCS: "rocketleague",
  VCT: "valorant",
  VALORANT: "valorant",
  CS: "cs2",
  CS2: "cs2",
  IEM: "cs2",
  BLAST: "cs2",
  ESL: "cs2",
};

const NEAR_MS = 3 * 60 * 60_000;

function bpEsportsGameId(league: string, source?: string): EsportsGameId | null {
  if (source === "opendota") return "dota2";
  return LEAGUE_GAMES[(league || "").toUpperCase()] ?? null;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function sameTeam(a: string, b: string): boolean {
  const left = normalize(a);
  const right = normalize(b);
  if (left.length < 3 || right.length < 3) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function feedMatchFor(matches: EsportsMatch[], game: SportsGame): EsportsMatch | null {
  const names = [game.home.name, game.away.name].filter(Boolean);
  if (names.length === 0) return null;
  let loose: EsportsMatch | null = null;
  for (const match of matches) {
    const hits = match.teams.filter((team) =>
      names.some((name) => sameTeam(team.name, name)),
    ).length;
    if (hits === 0) continue;
    const near =
      !Number.isFinite(game.startMs) || Math.abs(match.startMs - game.startMs) <= NEAR_MS;
    if (!near) continue;
    if (hits >= 2) return match;
    if (!loose) loose = match;
  }
  return loose;
}

function playable(streams: readonly EsportsStream[]): EsportsStream[] {
  const seen = new Set<string>();
  const out: EsportsStream[] = [];
  for (const stream of streams) {
    const url = esportsExternalUrl(stream.url);
    if (!url || seen.has(url) || !stream.title) continue;
    seen.add(url);
    out.push({ ...stream, url });
  }
  return out;
}

function bpCatalogBroadcasts(league: string, source?: string): EsportsStream[] {
  const id = bpEsportsGameId(league, source);
  const def = id ? esportsGame(id) : undefined;
  const organizer = SPORTS_BROADCASTS.filter(
    (item) => item.league && item.league === league,
  ).map<EsportsStream>((item) => ({
    title: `${item.title} · ${item.competition}`,
    url: `https://www.twitch.tv/${item.channel}`,
    platform: "twitch",
  }));
  return playable([...organizer, ...(def?.broadcasts ?? [])]);
}

export type BpBroadcasts = {
  list: EsportsStream[];
  onAir: boolean;
};

export function useBpOfficialBroadcasts(game: SportsGame): BpBroadcasts {
  const { league, source, id } = game;
  const catalog = useMemo(() => bpCatalogBroadcasts(league, source), [league, source]);
  const [feed, setFeed] = useState<EsportsStream[]>([]);
  const gameRef = useRef(game);
  gameRef.current = game;

  useEffect(() => {
    setFeed([]);
    const kind = bpEsportsGameId(league, source);
    if (!kind) return;
    const controller = new AbortController();
    void fetchEsportsFeed(kind, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setFeed(playable(feedMatchFor(result.matches, gameRef.current)?.streams ?? []));
      })
      .catch(() => {});
    return () => controller.abort();
  }, [league, source, id]);

  return useMemo(
    () => ({ list: playable([...feed, ...catalog]), onAir: feed.length > 0 }),
    [feed, catalog],
  );
}
