import { useEffect, useState } from "react";
import type { SportsGame } from "@/lib/sports/espn-types";
import { fetchEsportsFeed, type EsportsMatch } from "@/lib/sports/esports-feeds";
import { legacyEsportsMatch } from "@/lib/sports/legacy-esports-match";
import { officialBroadcastSource } from "@/lib/sports/esports-streams";
import { useView } from "@/lib/view";
import { EsportsMatchView } from "./esports-match";
export function LegacyEsportsEvent({ game, onClose, page = false, shellBackAvailable = false }: { game: SportsGame; onClose: () => void; page?: boolean; shellBackAvailable?: boolean }) {
  const { openPlayer } = useView();
  const fallback = legacyEsportsMatch(game)!;
  const [resolved, setResolved] = useState<{ key: string; match: EsportsMatch }>();
  const key = `${fallback.game}:${fallback.id}`;
  useEffect(() => {
    const controller = new AbortController();
    fetchEsportsFeed(fallback.game, { signal: controller.signal })
      .then((feed) => {
        const match = feed.matches.find(
          (item) =>
            item.id === fallback.id ||
            (fallback.game === "dota2" && item.id.replace(/^dota2?:/, "") === fallback.id),
        );
        if (match && !controller.signal.aborted) setResolved({ key, match });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [key]);
  return (
    <EsportsMatchView
      match={resolved?.key === key ? resolved.match : fallback}
      onClose={onClose}
      page={page}
      shellBackAvailable={shellBackAvailable}
      onWatch={(stream) => {
        const source = officialBroadcastSource(stream);
        if (source) {
          openPlayer(source);
          if (!page) onClose();
        }
      }}
    />
  );
}
