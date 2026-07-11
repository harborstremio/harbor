import { fetchSports, type SportsGame } from "@/lib/sports/espn";
import { useEffect, useState } from "react";

export function useSports(opts: { enabled: boolean; leagues: string[] }): SportsGame[] {
  const { enabled, leagues } = opts;
  const [games, setGames] = useState<SportsGame[]>([]);
  const key = leagues.join(",");

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      fetchSports(leagues)
        .then((g) => {
          if (!cancelled) setGames(g);
        })
        .catch(() => {});
    };
    tick();
    const timer = window.setInterval(tick, 12_000);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [enabled, key]);

  return games;
}
