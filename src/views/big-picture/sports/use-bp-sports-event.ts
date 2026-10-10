import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, BellRing, ExternalLink, Heart } from "lucide-react";
import { openUrl } from "@/lib/window";
import { useUiLanguage } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { getLeagueLabel } from "@/lib/sports/espn-leagues";
import type { LeagueDef, SportsGame, SportsMatchDetail, SportsSide } from "@/lib/sports/espn-types";
import { formatSportsEventDate } from "@/lib/sports/event-date";
import {
  isTeamFavourite,
  toggleFavouriteTeam,
  useFavourites,
  type FavouriteTeam,
} from "@/lib/sports/favourites";
import { hubLeague } from "@/lib/sports/hub-data";
import { sportsLeagueByTag } from "@/lib/sports/provider";
import { reminderId, saveSportsReminder, useSportsReminders } from "@/lib/sports/reminders";
import {
  fetchStandings,
  findStandingsRow,
  type StandingsGroup,
  type StandingsTable,
} from "@/lib/sports/standings";
import { useAthletePortrait } from "@/views/sports/use-athlete-portrait";
import { useBoxingEvent } from "@/views/sports/use-boxing-event";
import { useMatchDetail } from "@/views/sports/use-match-detail";
import { useBpT } from "../bp-i18n";
import type { BpDetailAction } from "../use-bp-detail-actions";

const INDIVIDUAL = new Set(["tennis", "combat", "golf", "motorsport"]);

const NO_TABLE = new Set(["tennis", "combat", "golf", "motorsport", "esports", "boxing"]);

const UNNAMED = /^(tbd|tba|winner|loser)\b/i;

const SUMMARY_SOURCES = new Set(["espn", "thesportsdb", "api-sports"]);

const DEFAULT_LEAD = 15;

export type BpSportsEventData = {
  game: SportsGame;
  detail: SportsMatchDetail | null;
  loading: boolean;
  failed: boolean;
  retry: () => void;
  league: LeagueDef | undefined;
  leagueLabel: string;
  group: string;
  individual: boolean;
  homeArt: string;
  awayArt: string;
  when: string;
  standings: StandingsTable | null;
  standingsGroup: StandingsGroup | null;
  summary: boolean;
  sides: boolean;
  scores: boolean;
};

function named(name: string): boolean {
  return name.trim() !== "" && !UNNAMED.test(name);
}

export function useBpSportsEvent(input: SportsGame): BpSportsEventData {
  const locale = useUiLanguage();
  const game = useBoxingEvent(input);
  const officialBoxing = game.source === "official-boxing";
  const { detail, loading, failed, retry } = useMatchDetail(game, !officialBoxing);
  const league = sportsLeagueByTag(game.league) ?? hubLeague(game.league);
  const group = league?.group ?? "";
  const individual = INDIVIDUAL.has(group);
  const path = league?.path ?? "";
  const home = useAthletePortrait(
    { path, id: game.home.id, name: game.home.name, image: game.home.logo },
    individual,
  );
  const away = useAthletePortrait(
    { path, id: game.away.id, name: game.away.name, image: game.away.logo },
    individual,
  );

  const [standings, setStandings] = useState<StandingsTable | null>(null);
  useEffect(() => {
    setStandings(null);
    if (!league || NO_TABLE.has(group)) return;
    let active = true;
    void fetchStandings(game.league)
      .then((table) => {
        if (active) setStandings(table);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [game.league, group, league]);

  const sides = named(game.home.name) && named(game.away.name);

  const standingsGroup = useMemo(() => {
    if (!standings) return null;
    const hit =
      findStandingsRow(standings, game.home.id) ?? findStandingsRow(standings, game.away.id);
    return hit?.group ?? standings.groups[0] ?? null;
  }, [standings, game.home.id, game.away.id]);

  return {
    game,
    detail,
    loading,
    failed,
    retry,
    league,
    leagueLabel: league ? getLeagueLabel(league) : game.league,
    group,
    individual,
    homeArt: home.image || game.home.logo,
    awayArt: away.image || game.away.logo,
    when: formatSportsEventDate(game.startMs, locale, false, game.dateOnly),
    standings,
    standingsGroup,
    summary: SUMMARY_SOURCES.has(game.source ?? "espn"),
    sides,
    scores: sides && game.state !== "pre" && (game.home.score !== "" || game.away.score !== ""),
  };
}

function favouriteOf(side: SportsSide, leagueKey: string, group: string): FavouriteTeam | null {
  if (!side.id || !side.name || UNNAMED.test(side.name)) return null;
  return { id: side.id, leagueKey, group, name: side.name, abbr: side.abbr, logo: side.logo };
}

export function useBpSportsEventActions(data: BpSportsEventData): BpDetailAction[] {
  const t = useBpT();
  const { game, league, group } = data;
  const { settings } = useSettings();
  const { openSettings } = useView();
  const favourites = useFavourites();
  const reminders = useSportsReminders();
  const id = reminderId(game);
  const reminded = reminders.some((item) => item.id === id);
  const leagueKey = hubLeague(game.league)?.key ?? league?.key ?? game.league;
  const channels = useMemo(
    () =>
      (["discord", "telegram"] as const).filter((channel) =>
        channel === "discord" ? settings.webhooks.discordUrl : settings.webhooks.telegramUrl,
      ),
    [settings.webhooks.discordUrl, settings.webhooks.telegramUrl],
  );

  const toggleReminder = useCallback(() => {
    if (reminded) {
      saveSportsReminder(null, id);
      return;
    }
    if (channels.length === 0) {
      openSettings("webhooks");
      return;
    }
    saveSportsReminder({
      id,
      name: game.context?.name || `${game.away.name} · ${game.home.name}`,
      league: game.league,
      startMs: game.startMs,
      leadMinutes: DEFAULT_LEAD,
      channels: [...channels],
      sent: {},
      attempted: {},
      failed: [],
    });
  }, [reminded, id, channels, game, openSettings]);

  return useMemo(() => {
    const out: BpDetailAction[] = [];
    const remindable =
      game.dateOnly === undefined &&
      game.state === "pre" &&
      Number.isFinite(game.startMs) &&
      game.startMs > Date.now();
    if (remindable) {
      out.push({
        key: "reminder",
        label: reminded
          ? t("Reminder set")
          : channels.length === 0
            ? t("Set up reminders")
            : t("Remind me {n} minutes before", { n: DEFAULT_LEAD }),
        icon: reminded ? BellRing : Bell,
        active: reminded,
        onPress: toggleReminder,
      });
    }
    if (!INDIVIDUAL.has(group) && group !== "esports") {
      for (const key of ["away", "home"] as const) {
        const team = favouriteOf(game[key], leagueKey, group);
        if (!team) continue;
        const on = isTeamFavourite(favourites, leagueKey, team.id);
        out.push({
          key: `follow-${key}`,
          label: on
            ? t("Following {name}", { name: team.name })
            : t("Follow {name}", { name: team.name }),
          icon: Heart,
          logo: team.logo || undefined,
          filled: on,
          active: on,
          onPress: () => toggleFavouriteTeam(team),
        });
      }
    }
    if (game.source === "opendota" && game.id) {
      out.push({
        key: "opendota",
        label: t("View match statistics"),
        icon: ExternalLink,
        onPress: () => void openUrl(`https://www.opendota.com/matches/${game.id}`),
      });
    }
    return out;
  }, [t, game, reminded, channels.length, toggleReminder, group, leagueKey, favourites]);
}
