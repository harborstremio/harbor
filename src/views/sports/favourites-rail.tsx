import { useMemo, useState } from "react";
import { House, Plus, Star } from "lucide-react";
import { useT, useUiLanguage } from "@/lib/i18n";
import { useView } from "@/lib/view";
import type { SportsGame } from "@/lib/sports/espn";
import {
  isHomeTeam,
  lastResult,
  matchSides,
  nextFixture,
  outcomeFor,
  recentForm,
  useFavourites,
  useFavouriteTeams,
  type FavouriteTeam,
} from "@/lib/sports/favourites";
import { useSports } from "@/views/live/live-home/use-sports";
import { kickoffLabel, outcomeDotClass, useTeamGames } from "./team-row";
import { TeamPicker } from "./team-picker";

export function FavouritesRail({
  board,
  className = "",
  onSelectTeam,
}: {
  board?: SportsGame[];
  className?: string;
  onSelectTeam?: (team: FavouriteTeam) => void;
}) {
  const t = useT();
  const teams = useFavouriteTeams();
  const [picking, setPicking] = useState(false);
  const leagues = useMemo(() => [...new Set(teams.map((x) => x.leagueKey))], [teams]);
  const polled = useSports({ enabled: !board && teams.length > 0, leagues });
  const live = board ?? polled;

  return (
    <aside className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
          {t("Favourites")}
        </span>
        {teams.length > 0 && (
          <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-elevated px-1 text-[10px] font-bold tabular-nums text-ink-muted">
            {teams.length}
          </span>
        )}
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="ms-auto flex h-7 items-center gap-1.5 rounded-full bg-elevated px-2.5 text-[11.5px] font-medium text-ink-muted transition-colors hover:bg-raised hover:text-ink"
        >
          <Plus size={12} />
          {t("Add")}
        </button>
      </div>

      {teams.length === 0 ? (
        <EmptyState onAdd={() => setPicking(true)} />
      ) : (
        <div className="harbor-cascade flex flex-col gap-1">
          {teams.map((team) => (
            <RailTeam key={`${team.leagueKey}-${team.id}`} team={team} board={live} onSelectTeam={onSelectTeam} />
          ))}
        </div>
      )}

      {picking && <TeamPicker onClose={() => setPicking(false)} />}
    </aside>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg bg-surface p-4">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-canvas text-ink-subtle">
        <Star size={14} />
      </span>
      <p className="text-[12.5px] font-medium leading-snug text-ink">{t("You have not added any favourites yet")}</p>
      <p className="text-[11.5px] leading-relaxed text-ink-subtle">
        {t("Pick the clubs you follow and their next fixture and last result stay pinned here.")}
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-1 inline-flex h-9 items-center rounded-lg bg-ink px-3.5 text-[12.5px] font-medium text-canvas transition-transform hover:scale-[1.01] active:scale-[0.98]"
      >
        {t("Add teams")}
      </button>
    </div>
  );
}

function RailTeam({
  team,
  board,
  onSelectTeam,
}: {
  team: FavouriteTeam;
  board: SportsGame[];
  onSelectTeam?: (team: FavouriteTeam) => void;
}) {
  const lang = useUiLanguage();
  const fav = useFavourites();
  const { openMatchDetail } = useView();
  const [err, setErr] = useState(false);
  const { games, loading } = useTeamGames(team, board);
  const locale = lang === "ar" ? "ar-SA" : "en-US";

  const upcoming = nextFixture(games);
  const previous = lastResult(games);
  const form = recentForm(games, team);
  const highlight = upcoming ?? previous;

  const open = () => {
    if (onSelectTeam) onSelectTeam(team);
    else if (highlight) openMatchDetail(highlight);
  };

  return (
    <button
      type="button"
      onClick={open}
      className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-start transition-colors hover:bg-surface"
    >
      {team.logo && !err ? (
        <img
          src={team.logo}
          alt=""
          draggable={false}
          loading="lazy"
          onError={() => setErr(true)}
          className="mt-0.5 h-6 w-6 shrink-0 object-contain"
        />
      ) : (
        <span className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-canvas/60" />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[12.5px] font-semibold text-ink">{team.name}</span>
          {isHomeTeam(fav, team) && <House size={9} className="shrink-0 text-ink-subtle" />}
        </span>
        <FixtureLine
          game={upcoming ?? previous}
          team={team}
          locale={locale}
          loading={loading && games.length === 0}
        />
        {form.length > 0 && (
          <span className="flex items-center gap-1 pt-0.5">
            {form.map((outcome, i) => (
              <span key={i} className={`h-1.5 w-1.5 rounded-full ${outcomeDotClass(outcome)}`} />
            ))}
          </span>
        )}
      </span>
    </button>
  );
}

function FixtureLine({
  game,
  team,
  locale,
  loading,
}: {
  game: SportsGame | null;
  team: FavouriteTeam;
  locale: string;
  loading: boolean;
}) {
  const t = useT();
  if (loading) return <span className="block h-3 w-24 rounded-full bg-elevated/40" />;
  if (!game) return <span className="truncate text-[11px] text-ink-subtle">{t("No fixtures scheduled")}</span>;

  const { own, opponent, atHome } = matchSides(game, team);
  const versus = `${atHome ? t("vs") : t("at")} ${opponent.abbr || opponent.name}`;
  const outcome = outcomeFor(game, team);

  if (game.state === "in") {
    return (
      <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-ink-muted">
        <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-danger" />
        <span className="shrink-0 tabular-nums">{`${own.score || "0"}-${opponent.score || "0"}`}</span>
        <span className="truncate">{versus}</span>
      </span>
    );
  }

  if (game.state === "post") {
    return (
      <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-ink-subtle">
        {outcome && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${outcomeDotClass(outcome)}`} />}
        <span className="shrink-0 tabular-nums">{`${own.score || "0"}-${opponent.score || "0"}`}</span>
        <span className="truncate">{versus}</span>
      </span>
    );
  }

  return (
    <span className="truncate text-[11px] text-ink-subtle">
      {`${kickoffLabel(game.startMs, locale)} ${versus}`}
    </span>
  );
}
