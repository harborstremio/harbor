import { useEffect, useState } from "react";
import type { SportsGame } from "@/lib/sports/espn-types";
import { fetchBoxingCalendars } from "@/lib/sports/providers/boxing-schedule";

/** Refresh a saved event snapshot without clearing its artwork or asking ESPN for a promoter event. */
export function useBoxingEvent(game: SportsGame) {
  const key = `${game.source}:${game.id}`;
  const enabled = game.source === "official-boxing";
  const [state, setState] = useState<{ key: string; game: SportsGame } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void fetchBoxingCalendars(controller.signal)
      .then((games) => {
        const fresh = games.find((item) => item.source === game.source && item.id === game.id);
        if (fresh && !controller.signal.aborted) setState({ key, game: fresh });
      })
      .catch(() => {
        /* Keep the published snapshot when its calendar cannot refresh. */
      });
    return () => controller.abort();
  }, [key, enabled]);
  return state?.key === key ? state.game : game;
}
