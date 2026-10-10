import { loadGameDetail, loadGameHighlights, loadMostPlayedGames, loadStoreSelectionPage, readGameDetailSnapshot } from "./catalog";
import { savedMetadataAt } from "./metadata-records";
import { decodeExploreHistory, selectExploreGames, type ExploreCandidate, type ExploreHistory } from "./explore-selection";
import type { GameDetail } from "./types";

export type ExploreVisit = {
  id: string;
  profile: string;
  history: ExploreHistory;
  picks: ExploreCandidate[];
  games: GameDetail[];
  selected?: number;
  page: number;
  recorded: boolean;
  detailsAt?: number;
  pending?: Promise<void>;
};
const memory = new Map<string, ExploreHistory>();
const storageKey = (profile: string) => `harbor:games:explore-visits:v1:${encodeURIComponent(profile)}`;
export function createExploreVisit(profile: string): ExploreVisit {
  let history = memory.get(profile) ?? [];
  try { const stored = localStorage.getItem(storageKey(profile)); if (stored !== null) history = decodeExploreHistory(JSON.parse(stored)); } catch { /* Storage is optional. */ }
  return { id: crypto.randomUUID(), profile, history, picks: [], games: [], page: 0, recorded: false };
}

/** Record a greeting only once it is actually visible, never on prefetch. */
export function recordExploreVisit(visit: ExploreVisit, lead: number) {
  if (visit.recorded) return;
  visit.recorded = true;
  const history = [{ at: Date.now(), lead, games: visit.picks.map(item => item.game.steamId!) }, ...visit.history].slice(0, 6);
  memory.delete(visit.profile); memory.set(visit.profile, history);
  if (memory.size > 20) memory.delete(memory.keys().next().value!);
  try { localStorage.setItem(storageKey(visit.profile), JSON.stringify(history)); } catch { /* Keep in-memory repeat protection. */ }
}

/** The shared metadata cache refreshes sources after 15 minutes. Changing a
 * visit changes selection, not the request cache or truthful source ordering. */
export function loadExploreVisit(visit: ExploreVisit, update: () => void, refresh = false): Promise<void> {
  if (visit.pending) return visit.pending.then(update);
  if (visit.games.length && !refresh) { update(); return Promise.resolve(); }
  const task = (async () => {
    if (!visit.picks.length) {
      const [played, sellers, releases] = await Promise.allSettled([
        loadMostPlayedGames(40), loadStoreSelectionPage("topsellers"), loadStoreSelectionPage("popularnew"),
      ]);
      const recent = releases.status === "fulfilled" ? releases.value.games.slice(0, 24) : [];
      const reviews = await loadGameHighlights(recent.flatMap(game => game.steamId ? [game.steamId] : [])).catch(() => []);
      visit.picks = selectExploreGames({
        played: played.status === "fulfilled" ? played.value.games : [],
        sellers: sellers.status === "fulfilled" ? sellers.value.games : [],
        releases: recent.map(game => ({ ...game, reviews: reviews.find(item => item.steamId === game.steamId)?.reviews })),
      }, visit.id, visit.history);
    }
    if (!visit.picks.length) throw Error("Explore sources unavailable");
    const publish = (game: GameDetail) => {
      if (game.comingSoon) return;
      const index = visit.games.findIndex(item => item.steamId === game.steamId);
      if (index >= 0) visit.games[index] = game;
      else visit.games.push(game);
      visit.selected ??= visit.games[0]?.steamId;
      update();
    };
    const hydrate = async (picks: ExploreCandidate[]) => {
      // Start the group together, but paint the chosen lead without waiting for
      // every other game's optional artwork. Keep the visit's selection order.
      const results = picks.map(async pick => {
        const game = await loadGameDetail(pick.game.steamId!);
        const cachedAt = savedMetadataAt([pick.game, game]);
        return { ...game, ...(cachedAt !== undefined ? { cachedAt } : {}) };
      }).map(task => task.catch(() => undefined));
      for (const task of results) { const game = await task; if (game) publish(game); }
    };
    // A saved lead can be drawn while its metadata refreshes in the background.
    let freshLead = false;
    void readGameDetailSnapshot(visit.picks[0].game.steamId!).then(game => { if (game && !freshLead && !visit.games.length) publish(game); }).catch(() => {});
    // Paint the opening group first; only selected games receive full metadata.
    await hydrate(visit.picks.slice(0, 3));
    freshLead = true;
    await hydrate(visit.picks.slice(3));
    if (!visit.games.length) throw Error("Explore game details unavailable");
    visit.detailsAt = Date.now();
  })();
  visit.pending = task;
  void task.finally(() => { visit.pending = undefined; }).catch(() => {});
  return task;
}
