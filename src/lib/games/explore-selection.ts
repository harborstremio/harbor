import type { GameSummary } from "./types";

export type ExploreSource = "most_played" | "top_sellers" | "new_releases";
export type ExploreCandidate = { game: GameSummary; source: ExploreSource; rank: number; weight: number };
export type ExploreHistory = { at: number; lead: number; games: number[] }[];
export type ExploreFeeds = {
  played: (GameSummary & { chartRank: number })[];
  sellers: GameSummary[];
  releases: (GameSummary & { reviews?: { positive: number; count: number } })[];
};

/** A stable draw for one visit; fetch timing and React renders cannot reshuffle it. */
export function exploreDraw(seed: string, key: string): number {
  let hash = 2166136261;
  for (const char of `${seed}:${key}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  hash ^= hash >>> 16; hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15; hash = Math.imul(hash, 0x846ca68b); hash ^= hash >>> 16;
  return ((hash >>> 0) + 1) / 4294967297;
}

export function decodeExploreHistory(value: unknown, now = Date.now()): ExploreHistory {
  if (!Array.isArray(value)) return [];
  const validId = (id: unknown): id is number => Number.isSafeInteger(id) && Number(id) > 0;
  return value.slice(0, 6).flatMap(item => {
    if (!item || typeof item !== "object" || !Number.isFinite(item.at) || item.at > now || now - item.at > 30 * 86400_000 || !validId(item.lead) || !Array.isArray(item.games)) return [];
    return [{ at: item.at, lead: item.lead, games: [...new Set<number>(item.games.filter(validId))].slice(0, 12) }];
  });
}

/** Reserve seven of nine slots for current top-20 chart games when available.
 * Shuffle within that pool; this ordering is not itself a chart ranking. */
export function selectExploreGames(feeds: ExploreFeeds, seed: string, history: ExploreHistory, now = Date.now()): ExploreCandidate[] {
  const candidates = new Map<number, ExploreCandidate>();
  const lanes: Record<ExploreSource, ExploreCandidate[]> = { most_played: [], top_sellers: [], new_releases: [] };
  const add = (games: GameSummary[], source: ExploreSource, limit: number) => {
    for (const [index, game] of games.slice(0, limit).entries()) {
      if (!Number.isSafeInteger(game.steamId) || !game.steamId || game.comingSoon) continue;
      if (source === "new_releases" && (!game.releaseTimestamp || game.releaseTimestamp * 1000 > now || now - game.releaseTimestamp * 1000 > 90 * 86400_000)) continue;
      const reviews = (game as ExploreFeeds["releases"][number]).reviews;
      if (source === "new_releases" && (!reviews || reviews.count < 100 || reviews.positive < 70)) continue;
      const rank = source === "most_played" ? (game as ExploreFeeds["played"][number]).chartRank : index + 1;
      if (!Number.isSafeInteger(rank) || rank <= 0) continue;
      const quality = source === "new_releases" && reviews ? 0.65 + 0.35 * Math.min(1, Math.log10(reviews.count / 100 + 1)) : 1;
      const candidate = { game, source, rank, weight: quality / Math.sqrt(1 + (rank - 1) / 5) };
      lanes[source].push(candidate);
      const existing = candidates.get(game.steamId);
      if (!existing || (source !== "new_releases" && (existing.source === "new_releases" || candidate.weight > existing.weight))) candidates.set(game.steamId, candidate);
    }
  };
  add([...feeds.played].sort((a, b) => a.chartRank - b.chartRank), "most_played", 40);
  add(feeds.sellers, "top_sellers", 40);
  add(feeds.releases, "new_releases", 30);
  const selected: ExploreCandidate[] = [], used = new Set<number>();
  const take = (candidate?: ExploreCandidate) => {
    if (candidate && !used.has(candidate.game.steamId!)) { selected.push(candidate); used.add(candidate.game.steamId!); }
  };
  take(lanes.most_played[0]);
  take(lanes.top_sellers.find(item => !used.has(item.game.steamId!)));
  const novelty = (id: number) => history[0]?.games.includes(id) ? 0.12 : history.slice(1, 3).some(visit => visit.games.includes(id)) ? 0.5 : 1;
  const order = (items: ExploreCandidate[], lane: string) => [...items].sort((a, b) => {
    const score = (item: ExploreCandidate) => -Math.log(exploreDraw(seed, `${lane}:${item.game.steamId}`)) / (item.weight * novelty(item.game.steamId!));
    return score(a) - score(b);
  });
  // Current chart standing wins over novelty: seven chart picks, two releases.
  const chartLeaders = [...candidates.values()].filter(item => item.source !== "new_releases" && item.rank <= 20);
  for (const candidate of order(chartLeaders, "charts")) {
    if (selected.length >= 7) break;
    take(candidate);
  }
  for (const candidate of order(lanes.new_releases.filter(item => !used.has(item.game.steamId!)), "new_releases").slice(0, 2)) take(candidate);
  for (const candidate of order([...candidates.values()], "fill")) {
    if (selected.length >= 9) break;
    take(candidate);
  }
  // Keep leaders in the set without forcing either to greet every visit.
  const recentLeads = history.slice(0, 3).map(visit => visit.lead);
  const openingPool = selected.filter(item => item.source !== "new_releases" && item.rank <= 20);
  const greetings = openingPool.length > 1 ? openingPool : selected;
  let eligible = greetings.filter(item => !recentLeads.includes(item.game.steamId!));
  if (!eligible.length) eligible = greetings.filter(item => item.game.steamId !== history[0]?.lead);
  const lead = order(eligible.length ? eligible : selected, "lead")[0];
  const rest = order(selected.filter(item => item !== lead), "deck");
  return lead ? [lead, ...rest] : [];
}

/** Rotate within a provider page, retaining its strongest entry and every item.
 * Appending another page therefore cannot move existing cards or repeat them. */
export function rotateExplorePage<T extends { id: string }>(games: T[], seed: string, offset: number): T[] {
  if (!seed || games.length < 3) return games;
  const anchors = offset === 0 ? games.slice(0, 1) : [];
  return [...anchors, ...games.slice(anchors.length).sort((a, b) => exploreDraw(seed, `${offset}:${a.id}`) - exploreDraw(seed, `${offset}:${b.id}`))];
}
