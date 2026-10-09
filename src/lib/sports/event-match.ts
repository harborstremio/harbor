import type { SportsGame } from "./espn-types";

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const words = (value: string) =>
  normalize(value)
    .split(/\s+/)
    .filter(
      (word) => !["jr", "sr", "ii", "iii", "vs", "v", "fc", "cf", "sc", "the"].includes(word),
    );
const hasPhrase = (haystack: string, needle: string) =>
  needle.length >= 3 && ` ${haystack} `.includes(` ${needle} `);
const common = new Set(["united", "city", "club", "sporting", "athletic", "state", "university"]);

/** Match event identity independently of network popularity. Short surnames such as Van
 * count only together with the opponent; a lone city/name never establishes a fixture. */
export function createEventChannelMatcher(game: SportsGame) {
  const title = game.context?.name || "";
  const pair = title.split(/\b(?:vs?\.?|versus)\s+/i);
  const titlePair =
    pair.length === 2
      ? [
          words(pair[0].split(":").at(-1) || "")
            .filter((w) => !/^\d+$/.test(w))
            .at(-1),
          words(pair[1])
            .filter((w) => !/^\d+$/.test(w))
            .at(-1),
        ]
      : [];
  const sides = [game.home, game.away].map((side) => words(side.name));
  const eventNumber = /\bufc\s*(\d{3,4})\b/i.exec(title)?.[1];
  const eventDay = new Date(game.startMs);
  const eventDayMs = Date.UTC(
    eventDay.getUTCFullYear(),
    eventDay.getUTCMonth(),
    eventDay.getUTCDate(),
  );
  return (channelName: string) => {
    const channel = normalize(channelName);
    const sideHits = sides.map(
      (tokens, index) =>
        hasPhrase(channel, tokens.join(" ")) ||
        (tokens.length > 0 &&
          !common.has(tokens.at(-1)!) &&
          tokens.at(-1) !== sides[1 - index].at(-1) &&
          hasPhrase(channel, tokens.at(-1)!)),
    );
    const pairHit =
      titlePair.length === 2 && titlePair.every((token) => token && hasPhrase(channel, token));
    const both = pairHit || sideHits.every(Boolean);
    const channelNumber = /\bufc\s*(\d{3,4})\b/i.exec(channelName)?.[1];
    const numberMatch = !!eventNumber && eventNumber === channelNumber;
    const numberConflict = !!eventNumber && !!channelNumber && eventNumber !== channelNumber;
    const date = /\b(20\d{2})[-/.](\d{2})[-/.](\d{2})\b/.exec(channelName);
    const dayMs = date ? Date.UTC(+date[1], +date[2] - 1, +date[3]) : null;
    const dateConflict = dayMs !== null && Math.abs(dayMs - eventDayMs) > 86400_000;
    const replay = /\b(?:ended|replay|rerun|highlights|classic)\b/i.test(channelName);
    return {
      both,
      numberMatch,
      conflict: numberConflict || dateConflict || replay,
      score: both ? 120 : numberMatch ? 95 : 0,
    };
  };
}

export function eventChannelEvidence(game: SportsGame, channelName: string) {
  return createEventChannelMatcher(game)(channelName);
}
