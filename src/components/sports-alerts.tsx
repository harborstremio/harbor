import { Star, Trophy, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";
import {
  effectiveTeams,
  useJlFavoritePlayers,
  useJlSportsFavorites,
} from "@/lib/jl/sports/favorites";
import { gameKey } from "@/lib/jl/sports/game-story";
import { followedGamesThisWeek, selectTopGames } from "@/lib/jl/sports/gameday";
import { isFavoriteGame, rankGames } from "@/lib/jl/sports/rank";
import {
  alertsToShow,
  detectAlerts,
  toAlertGame,
  type AlertGame,
  type FollowedAthlete,
  type SportsAlert,
} from "@/lib/jl/sports/sports-alerts";
import { fetchStorySummary } from "@/lib/jl/sports/story-feed";
import { useSettings } from "@/lib/settings";
import type { SportsGame } from "@/lib/sports/espn";
import { useView } from "@/lib/view";
import { useJlGames } from "@/views/live/live-home/jl-sports/use-jl-sports";

const VISIBLE_MS = 12_000;
const MAX_SHOWN = 2;
const SEEN_KEY = "jl.sports.alerts.seen";

// Never shown twice, even after a reload in the same session.
function seenIds(): string[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "[]") as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function remember(ids: string[]): void {
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seenIds(), ...ids].slice(-300)));
  } catch {
    /* storage unavailable: alerts may repeat after a reload */
  }
}

/** App-wide Sports alerts; polls only while "Sports alerts" is on and Sports isn't hidden. */
export function SportsAlerts() {
  const { settings } = useSettings();
  if (!settings.sportsAlerts || settings.hideContent.sports) return null;
  return <SportsAlertsHost />;
}

function SportsAlertsHost() {
  const t = useT();
  const { player, openMatchDetail } = useView();
  const teams = useJlSportsFavorites();
  const players = useJlFavoritePlayers();
  const favorites = useMemo(() => effectiveTeams(teams, players), [teams, players]);
  const games = useJlGames(favorites);
  const athletes = useMemo<FollowedAthlete[]>(
    () => players.map((p) => ({ league: p.league, id: p.id, name: p.name, teamId: p.teamId })),
    [players],
  );

  const prev = useRef<AlertGame[] | null>(null);
  const topKeys = useRef(new Set<string>());
  const byKey = useRef(new Map<string, SportsGame>());
  const playerActive = !!player;
  const playerRef = useRef(playerActive);
  const [shown, setShown] = useState<SportsAlert[]>([]);

  useEffect(() => {
    if (!games.length) return;
    let cancelled = false;
    const now = new Date();
    const ranked = rankGames(games, favorites, { now });
    for (const r of selectTopGames(ranked, followedGamesThisWeek(games, favorites, now)))
      topKeys.current.add(gameKey(r.game));
    // Play-by-play only for live games of your teams (few): everything else diffs the scoreboard.
    const live = games.filter((g) => g.state === "in" && isFavoriteGame(g, favorites));
    void Promise.all(
      live.map((g) => fetchStorySummary(g).then((s) => [gameKey(g), s] as const)),
    ).then((pairs) => {
      if (cancelled) return;
      const plays = new Map(pairs);
      const snapshot = games.map((g) => {
        const key = gameKey(g);
        byKey.current.set(key, g);
        const summary = plays.get(key);
        return toAlertGame(g, {
          mine: isFavoriteGame(g, favorites),
          top: topKeys.current.has(key),
          plays: summary ? summary.plays : undefined,
          athletes,
        });
      });
      const seen = new Set(seenIds());
      const fresh = alertsToShow(detectAlerts(prev.current, snapshot), {
        playerActive: playerRef.current,
      }).filter((a) => !seen.has(a.id));
      prev.current = snapshot;
      if (!fresh.length) return;
      remember(fresh.map((a) => a.id));
      setShown((s) => [...s, ...fresh].slice(-MAX_SHOWN));
    });
    return () => {
      cancelled = true;
    };
  }, [games, favorites, athletes]);

  useEffect(() => {
    playerRef.current = playerActive;
  }, [playerActive]);
  // Starting playback quiets what's on screen to your own teams' alerts.
  const visible = alertsToShow(shown, { playerActive });

  const dismiss = useCallback((id: string) => setShown((s) => s.filter((a) => a.id !== id)), []);

  if (!visible.length) return null;
  return createPortal(
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 end-6 z-[230] flex w-[min(360px,calc(100vw-3rem))] flex-col gap-2"
    >
      {visible.map((a) => (
        <AlertToast
          key={a.id}
          alert={a}
          onDismiss={dismiss}
          onDetails={
            playerActive
              ? null
              : () => {
                  const game = byKey.current.get(a.gameKey);
                  dismiss(a.id);
                  if (game) openMatchDetail(game);
                }
          }
          label={
            a.kind === "athlete"
              ? t("Your athlete")
              : a.kind === "final"
                ? t("Final")
                : a.kind === "kickoff"
                  ? t("Game on")
                  : a.kind === "lead"
                    ? t("Lead change")
                    : t("Your team scored")
          }
        />
      ))}
    </div>,
    document.body,
  );
}

function AlertToast({
  alert,
  label,
  onDismiss,
  onDetails,
}: {
  alert: SportsAlert;
  label: string;
  onDismiss: (id: string) => void;
  onDetails: (() => void) | null;
}) {
  const t = useT();
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(alert.id), VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [alert.id, onDismiss]);
  const Icon = alert.mine ? Star : Trophy;
  return (
    <aside
      role="status"
      className="animate-slide-from-right rtl:animate-slide-from-left pointer-events-auto relative rounded-2xl border border-edge-soft/70 bg-elevated/90 p-4 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.7)] backdrop-blur-md"
    >
      <button
        onClick={() => onDismiss(alert.id)}
        aria-label={t("Dismiss")}
        className="absolute end-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-ink-subtle hover:bg-raised hover:text-ink"
      >
        <X size={14} />
      </button>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
        <Icon size={12} fill="currentColor" strokeWidth={alert.mine ? 0 : 2} />
        {label}
      </p>
      <p className="mt-1 pe-6 text-[14px] font-semibold text-ink">{alert.title}</p>
      <p className="text-[12.5px] text-ink-muted">{alert.text}</p>
      {onDetails && (
        <button
          onClick={onDetails}
          className="mt-2.5 h-8 rounded-full border border-edge px-3.5 text-[12px] font-semibold text-ink hover:bg-raised"
        >
          {t("Game details")}
        </button>
      )}
    </aside>
  );
}
