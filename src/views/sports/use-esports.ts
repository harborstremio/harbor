import { useEffect, useState } from "react";
import { fetchEsportsFeed, type EsportsFeed, type EsportsGameId } from "@/lib/sports/esports-feeds";
import { fetchEsportsTeams, type EsportsTeam } from "@/lib/sports/esports-profiles";
import { fetchEsportsRankings, type EsportsRankings } from "@/lib/sports/esports-rankings";

const FEEDS: EsportsGameId[] = ["dota2", "lol", "valorant", "cs2", "rocketleague"];
export function useEsports(
  game: string,
  active: boolean,
  refresh: number,
  options: { profiles?: boolean; teamLogos?: boolean; games?: readonly EsportsGameId[] } = {},
) {
  const profiles = options.profiles !== false;
  const [feeds, setFeeds] = useState<Partial<Record<EsportsGameId, EsportsFeed>>>({});
  const [pending, setPending] = useState<string[]>([]);
  const [teams, setTeams] = useState<EsportsTeam[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamsFailed, setTeamsFailed] = useState(false);
  const [rankings, setRankings] = useState<EsportsRankings | null>(null);
  const [rankingsLoading, setRankingsLoading] = useState(false);
  const [rankingsFailed, setRankingsFailed] = useState(false);
  const [now, setNow] = useState(Date.now);
  const signature =
    game === "all"
      ? FEEDS.filter((key) => options.games === undefined || options.games.includes(key)).join(",")
      : FEEDS.includes(game as EsportsGameId)
        ? game
        : "";
  useEffect(() => {
    if (!active || !signature) {
      setPending([]);
      return;
    }
    const controller = new AbortController();
    const keys = signature.split(",") as EsportsGameId[];
    let busy = false;
    async function run() {
      if (busy || document.visibilityState !== "visible" || controller.signal.aborted) return;
      busy = true;
      setNow(Date.now());
      setPending(keys);
      // Independent providers publish as they finish; one outage cannot blank the arena.
      let cursor = 0;
      await Promise.all(
        Array.from({ length: Math.min(3, keys.length) }, async () => {
          while (cursor < keys.length && !controller.signal.aborted) {
            const key = keys[cursor++];
            try {
              const result = await fetchEsportsFeed(key, {
                signal: controller.signal,
                force: refresh > 0,
              });
              if (!controller.signal.aborted) setFeeds((prev) => ({ ...prev, [key]: result }));
            } catch {
              /* The provider returns its own unavailable state; aborts don't publish. */
            } finally {
              if (!controller.signal.aborted)
                setPending((prev) => prev.filter((value) => value !== key));
            }
          }
        }),
      );
      busy = false;
    }
    void run();
    const timer = window.setInterval(run, 90_000);
    document.addEventListener("visibilitychange", run);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", run);
    };
  }, [signature, active, refresh]);
  const loadTeams =
    profiles ||
    (options.teamLogos === true &&
      signature.split(",").includes("dota2") &&
      !!feeds.dota2?.matches.length);
  useEffect(() => {
    if (!loadTeams || !active || (game !== "all" && game !== "dota2")) {
      setTeamsLoading(false);
      return;
    }
    const controller = new AbortController();
    setTeamsLoading(true);
    setTeamsFailed(false);
    void fetchEsportsTeams(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setTeams(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setTeamsFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setTeamsLoading(false);
      });
    return () => controller.abort();
  }, [active, game, refresh, loadTeams]);
  useEffect(() => {
    if (!profiles || !active || (game !== "all" && game !== "cs2")) {
      setRankingsLoading(false);
      return;
    }
    const controller = new AbortController();
    setRankingsLoading(true);
    setRankingsFailed(false);
    void fetchEsportsRankings(controller.signal, refresh > 0)
      .then((result) => {
        if (!controller.signal.aborted) setRankings(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setRankingsFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setRankingsLoading(false);
      });
    return () => controller.abort();
  }, [active, game, refresh, profiles]);
  return {
    feeds,
    pending,
    teams,
    teamsLoading,
    teamsFailed,
    rankings,
    rankingsLoading,
    rankingsFailed,
    now,
  };
}
