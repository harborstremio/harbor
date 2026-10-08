import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import { leaguePath, type SportsGame } from "@/lib/sports/espn";
import { allsportsGetter } from "@/lib/jl/sports/allsports";
import { findAsMatch } from "@/lib/jl/sports/as-match-map";
import { useAllSportsKey, useAsLoad } from "./allsports-ui";

/**
 * "Open Match Center" for a scoreboard game: shown only when the viewer has an AllSports key
 * and the game was found in AllSports by teams and date.
 */
export function MatchCenterLink({ game }: { game: SportsGame }) {
  const t = useT();
  const key = useAllSportsKey();
  const { openSportsPage } = useView();
  const get = useMemo(() => allsportsGetter(key), [key]);
  const { value: match } = useAsLoad(
    () => (key ? findAsMatch(get, game, leaguePath(game.league)) : Promise.resolve(null)),
    [get, key, game.id, game.league],
  );
  if (!match) return null;
  return (
    <button
      onClick={() =>
        openSportsPage({
          kind: "match-center",
          sport: match.slug,
          matchId: String(match.id),
          name: `${game.home.name} – ${game.away.name}`,
        })
      }
      className="flex h-9 items-center gap-2 rounded-full border border-edge-soft bg-elevated/60 px-4 text-[13px] font-semibold text-ink transition-colors hover:border-edge"
    >
      <BarChart3 size={15} />
      {t("Open Match Center")}
    </button>
  );
}
