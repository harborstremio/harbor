import { useMemo, useState } from "react";
import { House } from "lucide-react";
import { Row } from "@/components/row";
import { useT, useUiLanguage } from "@/lib/i18n";
import { useView } from "@/lib/view";
import type { SportsGame } from "@/lib/sports/espn";
import {
  involvesTeam,
  isHomeTeam,
  matchSides,
  mergeGames,
  outcomeFor,
  useFavourites,
  useFavouriteTeams,
  useTeamSchedule,
  type FavouriteTeam,
  type TeamOutcome,
} from "@/lib/sports/favourites";
import { useSports } from "@/views/live/live-home/use-sports";
import { fmtClock } from "@/views/live/live-home/now-format";
import { LiveBadge } from "./live-badge";

export function kickoffParts(ms: number, locale: string): { day: string; time: string } {
  if (!ms || Number.isNaN(ms)) return { day: "", time: "" };
  const d = new Date(ms);
  const sameDay = d.toDateString() === new Date().toDateString();
  const day = sameDay ? "" : d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
  return { day, time: fmtClock(ms) };
}

export function kickoffLabel(ms: number, locale: string): string {
  const { day, time } = kickoffParts(ms, locale);
  return [day, time].filter(Boolean).join(" ");
}

export function outcomeDotClass(outcome: TeamOutcome): string {
  if (outcome === "win") return "bg-success";
  if (outcome === "loss") return "bg-danger/60";
  return "bg-ink-subtle/50";
}

export function useTeamGames(
  team: FavouriteTeam | null,
  board?: SportsGame[],
): { games: SportsGame[]; loading: boolean } {
  const { games: schedule, loading } = useTeamSchedule(team);
  const ownBoard = !board;
  const leagues = useMemo(() => (team && ownBoard ? [team.leagueKey] : []), [team?.leagueKey, ownBoard]);
  const polled = useSports({ enabled: !!team && ownBoard, leagues });
  const live = board ?? polled;
  const games = useMemo(() => {
    if (!team) return [];
    return mergeGames(
      schedule,
      live.filter((g) => involvesTeam(g, team)),
    );
  }, [schedule, live, team]);
  return { games, loading };
}

export function TeamRow({ team, board }: { team: FavouriteTeam; board?: SportsGame[] }) {
  const t = useT();
  const lang = useUiLanguage();
  const fav = useFavourites();
  const { openMatchDetail } = useView();
  const { games, loading } = useTeamGames(team, board);
  const locale = lang === "ar" ? "ar-SA" : "en-US";
  const home = isHomeTeam(fav, team);

  if (!loading && games.length === 0) return null;

  return (
    <Row
      min={244}
      shape="tile"
      scrollKey={`sports:team-${team.leagueKey}-${team.id}`}
      title={
        <span className="flex min-w-0 items-center gap-2.5">
          {team.logo && <img src={team.logo} alt="" draggable={false} className="h-6 w-6 shrink-0 object-contain" />}
          <span className="min-w-0 truncate">{team.name}</span>
          {home && (
            <span className="flex h-[19px] shrink-0 items-center gap-1 rounded-full bg-elevated px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-subtle">
              <House size={9} />
              {t("Home team")}
            </span>
          )}
        </span>
      }
    >
      {loading && games.length === 0
        ? Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-[108px] w-full rounded-lg bg-elevated/40" />
          ))
        : games.map((game) => (
            <FixtureCard
              key={game.id}
              game={game}
              team={team}
              locale={locale}
              onOpen={() => openMatchDetail(game)}
            />
          ))}
    </Row>
  );
}

export function FavouriteTeamRows({ group, board }: { group?: string; board?: SportsGame[] }) {
  const teams = useFavouriteTeams(group);
  if (teams.length === 0) return null;
  return (
    <>
      {teams.map((team) => (
        <TeamRow key={`${team.leagueKey}-${team.id}`} team={team} board={board} />
      ))}
    </>
  );
}

function FixtureCard({
  game,
  team,
  locale,
  onOpen,
}: {
  game: SportsGame;
  team: FavouriteTeam;
  locale: string;
  onOpen: () => void;
}) {
  const t = useT();
  const [err, setErr] = useState(false);
  const { own, opponent, atHome } = matchSides(game, team);
  const outcome = outcomeFor(game, team);
  const played = game.state !== "pre";
  const { day, time } = kickoffParts(game.startMs, locale);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-[108px] w-full flex-col justify-between rounded-lg bg-elevated p-3 text-start ring-1 ring-inset ring-edge-soft transition-colors hover:bg-raised"
    >
      {game.state === "in" ? (
        <LiveBadge label={game.detail} />
      ) : (
        <span className="truncate text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-subtle">
          {game.state === "post" ? game.detail || t("Final") : day || t("Today")}
        </span>
      )}

      <div className="flex min-w-0 items-center gap-2">
        {opponent.logo && !err ? (
          <img
            src={opponent.logo}
            alt=""
            draggable={false}
            loading="lazy"
            onError={() => setErr(true)}
            className="h-7 w-7 shrink-0 object-contain"
          />
        ) : (
          <span className="h-7 w-7 shrink-0 rounded-full bg-canvas/60" />
        )}
        <span className="shrink-0 text-[10.5px] font-medium text-ink-subtle">{atHome ? t("vs") : t("at")}</span>
        <span className="truncate text-[13.5px] font-semibold text-ink">{opponent.name || opponent.abbr}</span>
      </div>

      <div className="flex items-center justify-between gap-2">
        {played ? (
          <span className="text-[17px] font-bold tabular-nums text-ink">
            {own.score || "0"}
            <span className="px-1 text-ink-subtle">-</span>
            {opponent.score || "0"}
          </span>
        ) : (
          <span className="text-[13px] font-semibold tabular-nums text-ink">{time}</span>
        )}
        {outcome && (
          <span className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${outcomeDotClass(outcome)}`} />
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-subtle">
              {outcome === "win" ? t("Won") : outcome === "loss" ? t("Lost") : t("Drew")}
            </span>
          </span>
        )}
      </div>
    </button>
  );
}
