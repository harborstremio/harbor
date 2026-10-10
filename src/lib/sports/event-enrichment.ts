import type { LeagueDef, MatchTeamStatRow, SportsGame, SportsSide } from "./espn-types";
import { isFinishedStatus } from "./event-status";
import {
  publicCompetitionUrl,
  isIndividualCompetition,
  mergeCompetitionEntrants,
  parseCompetitionResults,
  parseCompetitionResultText,
  type CompetitionEntrant,
} from "./competition-metadata.ts";
import { sportsDbTimestamp } from "./slice-calendar.ts";

type Raw = Record<string, unknown>;
type JsonLoader = (url: string, signal: AbortSignal) => Promise<unknown>;
export type PublishedEvent = {
  game: SportsGame;
  sourceUrl: string;
  description?: string;
  resultText?: string;
  entrants?: CompetitionEntrant[];
  partial?: boolean;
  venue?: { id?: string; name: string; location?: string };
  season?: string;
  round?: string;
  square?: string;
  banner?: string;
  /** A video link supplied by the metadata provider, not a Harbor stream. */
  videoUrl?: string;
};

const DB = "https://www.thesportsdb.com/api/v1/json/123";
const record = (value: unknown): Raw =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : {};
const text = (value: unknown, limit = 500): string =>
  typeof value === "string" ? value.trim().slice(0, limit) : "";
const id = (value: unknown): string => {
  const valueText = typeof value === "number" ? String(value) : text(value, 30);
  return /^\d{1,16}$/.test(valueText) ? valueText : "";
};
const score = (value: unknown): string | undefined => {
  const valueText = typeof value === "number" ? String(value) : text(value, 24);
  return /^\d+(?:[./:]\d+)*$/.test(valueText) ? valueText : undefined;
};

function image(value: unknown): string | undefined {
  const address = publicCompetitionUrl(value);
  if (!address) return;
  const url = new URL(address);
  if (
    /^(?:r2\.|www\.)?thesportsdb\.com$/.test(url.hostname) &&
    url.pathname.startsWith("/images/media/")
  )
    return address;
  if (/(?:^|\.)espncdn\.com$/.test(url.hostname) && url.pathname.startsWith("/i/teamlogos/"))
    return address;
}

function video(value: unknown): string | undefined {
  const address = publicCompetitionUrl(value);
  if (!address) return;
  const url = new URL(address);
  const videoId =
    url.hostname === "youtu.be"
      ? url.pathname.slice(1)
      : /^(?:www\.|m\.)?youtube\.com$/.test(url.hostname) && url.pathname === "/watch"
        ? url.searchParams.get("v")
        : null;
  return videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)
    ? `https://www.youtube.com/watch?v=${videoId}`
    : undefined;
}

function participant(event: Raw, side: "Home" | "Away", previous: SportsSide): SportsSide {
  const teamId = id(event[`id${side}Team`]);
  const teamName = text(event[`str${side}Team`]);
  // A changed provider participant must not inherit another team's badge or score.
  const sameTeam =
    teamId && previous.id
      ? teamId === previous.id
      : !teamName || teamName.toLowerCase() === previous.name.toLowerCase();
  return {
    id: teamId || (sameTeam ? previous.id : ""),
    name: teamName || previous.name,
    abbr: sameTeam ? previous.abbr : "",
    logo: image(event[`str${side}TeamBadge`]) || (sameTeam ? image(previous.logo) : "") || "",
    score: score(event[`int${side}Score`]) ?? (sameTeam ? score(previous.score) : undefined) ?? "",
    winner: false,
  };
}

/** Enrich one exact event. Never guess teams, positions, live state, or missing scores. */
export function parsePublishedEvent(
  game: SportsGame,
  def: LeagueDef,
  raw: unknown,
): PublishedEvent | null {
  if (!id(game.id) || !id(def.path)) return null;
  const event = record(raw);
  if (id(event.idEvent) !== game.id || id(event.idLeague) !== def.path) return null;
  const status = text(event.strStatus, 100) || game.detail;
  const finished = isFinishedStatus(status) || !!text(event.strResult, 400).trim();
  const state = finished ? "post" : "pre";
  const home = participant(event, "Home", game.home);
  const away = participant(event, "Away", game.away);
  if (finished && /^\d+$/.test(home.score) && /^\d+$/.test(away.score)) {
    home.winner = Number(home.score) > Number(away.score);
    away.winner = Number(away.score) > Number(home.score);
  }
  const eventName = text(event.strEvent) || game.context?.name || home.name;
  const venueName = text(event.strVenue) || game.context?.venue;
  const startMs = sportsDbTimestamp(
    text(event.strTimestamp),
    text(event.dateEvent),
    text(event.strTime),
  );
  const round = text(event.strRound, 80) || undefined;
  return {
    game: {
      ...game,
      source: "thesportsdb-hub",
      state,
      detail: status,
      home,
      away,
      startMs: Number.isFinite(startMs) ? startMs : game.startMs,
      artwork: image(event.strThumb) || image(event.strFanart) || image(game.artwork),
      poster: image(event.strPoster) || image(game.poster),
      context: {
        id: game.id,
        name: eventName,
        round: round || game.context?.round || "",
        draw: text(event.strGroup) || game.context?.draw || "",
        venue: venueName || "",
        major: game.context?.major ?? false,
      },
    },
    sourceUrl: `https://www.thesportsdb.com/event/${game.id}`,
    description: text(event.strDescriptionEN, 8000) || undefined,
    resultText: text(event.strResult, 12000) || undefined,
    venue: venueName
      ? {
          id: id(event.idVenue) || undefined,
          name: venueName,
          location:
            [text(event.strCity), text(event.strCountry)].filter(Boolean).join(", ") || undefined,
        }
      : undefined,
    season: text(event.strSeason, 80) || undefined,
    round,
    square: image(event.strSquare),
    banner: image(event.strBanner),
    videoUrl: video(event.strVideo),
  };
}

/** Volleyball scores are sets won; line scores are the points in each published set. */
export function parseEspnVolleyballSets(raw: unknown, eventId: string): MatchTeamStatRow[] {
  const header = record(record(raw).header);
  if (id(header.id) !== eventId) return [];
  const competitions = Array.isArray(header.competitions)
    ? header.competitions.slice(0, 5).map(record)
    : [];
  const competition = competitions.find((item) => id(item.id) === eventId);
  const sides = Array.isArray(competition?.competitors)
    ? competition.competitors.slice(0, 8).map(record)
    : [];
  const home = sides.find((side) => side.homeAway === "home");
  const away = sides.find((side) => side.homeAway === "away");
  if (!home || !away) return [];
  const homeSets = Array.isArray(home.linescores) ? home.linescores.slice(0, 5) : [];
  const awaySets = Array.isArray(away.linescores) ? away.linescores.slice(0, 5) : [];
  const points = (value: unknown) => {
    const item = record(value);
    return score(item.displayValue) ?? score(item.value);
  };
  return Array.from({ length: Math.max(homeSets.length, awaySets.length) }, (_, index) => {
    const homeValue = points(homeSets[index]);
    const awayValue = points(awaySets[index]);
    return homeValue !== undefined || awayValue !== undefined
      ? [
          {
            label: `Set ${index + 1}`,
            homeValue: homeValue ?? "—",
            awayValue: awayValue ?? "—",
          },
        ]
      : [];
  }).flat();
}

const cache = new Map<string, { value: PublishedEvent | null; expires: number }>();
type Flight = {
  controller: AbortController;
  promise: Promise<PublishedEvent | null>;
  users: number;
};
const flights = new Map<string, Flight>();
const keyFor = (game: SportsGame, def: LeagueDef) => `${def.path}:${game.id}`;

export function readPublishedEvent(game: SportsGame, def: LeagueDef): PublishedEvent | undefined {
  return cache.get(keyFor(game, def))?.value ?? undefined;
}

async function defaultJson(url: string, signal: AbortSignal): Promise<unknown> {
  const { safeFetch } = await import("@/lib/safe-fetch");
  const response = await safeFetch(url, { signal });
  if (!response.ok) throw new Error("Event details unavailable");
  return response.json();
}

/** One lookup on demand; opening the same event shares work, and closing it cancels work. */
export function loadPublishedEvent(
  game: SportsGame,
  def: LeagueDef,
  signal: AbortSignal,
  json: JsonLoader = defaultJson,
  force = false,
): Promise<PublishedEvent | null> {
  if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  if (!id(def.path) || !id(game.id)) return Promise.resolve(null);
  const key = keyFor(game, def);
  const hit = cache.get(key);
  if (!force && hit && hit.expires > Date.now()) return Promise.resolve(hit.value);
  let flight = flights.get(key);
  if (!flight || flight.controller.signal.aborted) {
    if (flights.size >= 8) return Promise.reject(new Error("Event details are busy"));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    const entry: Flight = {
      controller,
      users: 0,
      promise: Promise.resolve(null),
    };
    const request = json(`${DB}/lookupevent.php?id=${game.id}`, controller.signal).then(async (raw) => {
      const events = record(raw).events;
      if (events !== null && !Array.isArray(events)) throw new Error("Event details unavailable");
      const event = (Array.isArray(events) ? events.slice(0, 20).map(record) : []).find(
        (item) => id(item.idEvent) === game.id && id(item.idLeague) === def.path,
      );
      const published = event ? parsePublishedEvent(game, def, event) : null;
      if (!published || !isIndividualCompetition(def.group) || published.game.state !== "post")
        return published;
      try {
        const results = await json(`${DB}/eventresults.php?id=${game.id}`, controller.signal);
        controller.signal.throwIfAborted();
        return {
          ...published,
          entrants: mergeCompetitionEntrants(
            parseCompetitionResultText(published.resultText),
            parseCompetitionResults(record(results).results, game.id),
          ),
        };
      } catch {
        controller.signal.throwIfAborted();
        return { ...published, partial: true };
      }
    });
    const aborted = new Promise<never>((_, reject) => {
      controller.signal.addEventListener(
        "abort",
        () => reject(new DOMException("Aborted", "AbortError")),
        { once: true },
      );
    });
    entry.promise = Promise.race([request, aborted])
      .then((value) => {
        controller.signal.throwIfAborted();
        cache.set(key, {
          value,
          expires: Date.now() + (value && !value.partial ? 600_000 : 30_000),
        });
        while (cache.size > 40) cache.delete(cache.keys().next().value!);
        return value;
      })
      .finally(() => {
        clearTimeout(timer);
        if (flights.get(key) === entry) flights.delete(key);
      });
    flights.set(key, entry);
    flight = entry;
  }
  const entry = flight;
  entry.users++;
  return new Promise((resolve, reject) => {
    let settled = false;
    const release = () => {
      if (settled) return false;
      settled = true;
      signal.removeEventListener("abort", abort);
      if (--entry.users === 0) entry.controller.abort();
      return true;
    };
    const abort = () => {
      if (release()) reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
    entry.promise.then(
      (value) => {
        if (release()) resolve(value);
      },
      (error) => {
        if (release()) reject(error);
      },
    );
  });
}
