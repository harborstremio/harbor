import { Cloud, Play, Sparkles, Star, Trophy, Users } from "lucide-react";
import { useState } from "react";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import { useJlSession } from "@/lib/jl/account/client";
import { useJlLink } from "@/lib/jl/account/sync";
import { isFollowing, toggleFavoriteTeam } from "@/lib/jl/sports/favorites";
import type { JlFavoriteTeam } from "@/lib/jl/sports/rank";
import { useSettings } from "@/lib/settings";
import type { SportsGame, SportsSide } from "@/lib/sports/espn";
import { fmtClock } from "../now-format";
import { GameBackdrop } from "./game-backdrop";
import { SportsKeysHint } from "./sports-keys-hint";
import type { JlSportsActions } from "./use-jl-sports-dialogs";
import type { JlHubGame } from "./use-jl-sports";

type Translate = ReturnType<typeof useT>;

export function JlSportsHub({
  top,
  ticker,
  favorites,
  actions,
  onOpenGame,
}: {
  top: JlHubGame[];
  ticker: JlHubGame[];
  favorites: JlFavoriteTeam[];
  actions: JlSportsActions;
  onOpenGame: (game: SportsGame) => void;
}) {
  const t = useT();
  const session = useJlSession();
  const link = useJlLink();
  const { openSportsPage } = useView();
  return (
    <section className="flex flex-col gap-3 ps-[9px]">
      <div className="flex items-center gap-2.5 pe-[9px]">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">{t("Sports Hub")}</h2>
        <span className="text-[12px] text-ink-subtle/80">{t("Top games, ranked for you")}</span>
        <SportsKeysHint />
        <button
          onClick={actions.follow}
          className="ms-auto flex h-8 items-center gap-1.5 rounded-full border border-edge-soft px-3 text-[12px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink"
        >
          <Users size={13} />
          {t("Teams & players")}
        </button>
        <button
          onClick={() => openSportsPage({ kind: "leagues" })}
          className="flex h-8 items-center gap-1.5 rounded-full border border-edge-soft px-3 text-[12px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink"
        >
          <Trophy size={13} />
          {t("Leagues")}
        </button>
        <button
          onClick={actions.account}
          className="flex h-8 items-center gap-1.5 rounded-full border border-edge-soft px-3 text-[12px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink"
        >
          <Cloud size={13} className={link && session ? "text-accent" : ""} />
          {link && session ? t("Synced · {profile}", { profile: link.name }) : t("Sign in to sync")}
        </button>
      </div>
      {ticker.length > 0 && <FavoritesTicker items={ticker} onWatch={actions.watch} />}
      {top.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2 pe-[9px]">
          {top.map((item) => (
            <HubCard
              key={`${item.game.league}:${item.game.id}`}
              item={item}
              favorites={favorites}
              actions={actions}
              onOpenGame={onOpenGame}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function FavoritesTicker({ items, onWatch }: { items: JlHubGame[]; onWatch: (item: JlHubGame) => void }) {
  const t = useT();
  return (
    <div className="flex items-center gap-2 overflow-x-auto pe-[9px]">
      <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
        <Star size={11} fill="currentColor" strokeWidth={0} />
        {t("Your teams")}
      </span>
      {items.map((item) => {
        const { game, channels } = item;
        return (
          <button
            key={`${game.league}:${game.id}`}
            onClick={() => onWatch(item)}
            title={t("Ways to watch")}
            className="flex h-8 shrink-0 items-center gap-2 rounded-full border border-edge-soft bg-elevated px-3 text-[12px] text-ink transition-colors hover:border-edge"
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-subtle">{game.league}</span>
            <span className="font-semibold">
              {game.away.abbr || game.away.name} {game.away.score}
            </span>
            <span className="text-ink-subtle">·</span>
            <span className="font-semibold">
              {game.home.abbr || game.home.name} {game.home.score}
            </span>
            <span className={game.state === "in" ? "text-danger" : "text-ink-subtle"}>{statusText(game, t)}</span>
            {channels.length > 0 && <Play size={11} fill="currentColor" strokeWidth={0} className="text-accent" />}
          </button>
        );
      })}
    </div>
  );
}

function HubCard({
  item,
  favorites,
  actions,
  onOpenGame,
}: {
  item: JlHubGame;
  favorites: JlFavoriteTeam[];
  actions: JlSportsActions;
  onOpenGame: (game: SportsGame) => void;
}) {
  const t = useT();
  const { settings } = useSettings();
  const { game, reasons, channels, mine } = item;
  const live = game.state === "in";
  return (
    <div className="relative flex w-[300px] shrink-0 flex-col gap-2.5 overflow-hidden rounded-xl border border-edge-soft/55 bg-elevated p-3 [&>*:not([aria-hidden])]:relative">
      <GameBackdrop game={game} surface="elevated" />
      <button onClick={() => onOpenGame(game)} className="flex flex-col gap-2 text-start" title={t("Game details")}>
        <div className="flex items-center justify-between gap-2">
          <span
            className={`flex h-[18px] items-center rounded px-1.5 text-[10.5px] font-bold uppercase tracking-[0.06em] ${
              live ? "bg-danger text-white" : "border border-edge-soft/60 text-ink-subtle"
            }`}
          >
            {statusText(game, t)}
          </span>
          <span className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-subtle">
            {[game.league, game.network].filter(Boolean).join(" · ")}
          </span>
        </div>
        <TeamLine side={game.away} active={game.state !== "pre"} />
        <TeamLine side={game.home} active={game.state !== "pre"} />
      </button>
      <div className="flex items-center gap-1.5">
        <FollowButton side={game.away} league={game.league} favorites={favorites} />
        <FollowButton side={game.home} league={game.league} favorites={favorites} />
        {mine && game.state === "pre" && (
          <button
            onClick={() => actions.pregame(item)}
            className="ms-auto flex h-7 items-center gap-1 rounded-full border border-edge-soft px-2.5 text-[11px] font-semibold text-ink-muted hover:text-ink"
          >
            <Sparkles size={11} />
            {t("Pre-game")}
          </button>
        )}
      </div>
      {(reasons.length > 0 || game.odds) && (
        <div className="flex flex-wrap gap-1">
          {reasons.slice(0, 2).map((r) => (
            <span key={r.label} className="rounded-full bg-canvas/60 px-2 py-0.5 text-[10.5px] text-ink-muted">
              {t(r.label, r.vars)}
            </span>
          ))}
          {game.odds && <span className="rounded-full bg-canvas/60 px-2 py-0.5 text-[10.5px] text-ink-subtle">{game.odds}</span>}
        </div>
      )}
      <WatchButton item={item} onWatch={actions.watch} />
      {channels.length === 0 && settings.sportsChannelFinder && (
        <span className="-mt-1 text-center text-[11px] text-ink-subtle">{t("Not on your channels")}</span>
      )}
    </div>
  );
}

export function WatchButton({ item, onWatch }: { item: JlHubGame; onWatch: (item: JlHubGame) => void }) {
  const t = useT();
  const count = item.channels.length;
  return (
    <button
      onClick={() => onWatch(item)}
      className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-ink px-3 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
    >
      <Play size={12} fill="currentColor" strokeWidth={0} />
      {count > 0 ? t("Watch · {n} channels", { n: count }) : t("Ways to watch")}
    </button>
  );
}

export function TeamLine({ side, active }: { side: SportsSide; active: boolean }) {
  const [err, setErr] = useState(false);
  return (
    <div className="flex items-center gap-2">
      {side.logo && !err ? (
        <img src={side.logo} alt="" draggable={false} loading="lazy" onError={() => setErr(true)} className="h-5 w-5 shrink-0 object-contain" />
      ) : (
        <span className="h-5 w-5 shrink-0 rounded-full bg-canvas/60" />
      )}
      {side.rank ? <span className="text-[11px] font-semibold text-ink-subtle">#{side.rank}</span> : null}
      <span className="flex-1 truncate text-[13.5px] font-semibold text-ink">{side.location || side.name}</span>
      <span className={`w-8 shrink-0 text-end text-[17px] font-bold tabular-nums ${active ? "text-ink" : "text-ink-subtle"}`}>
        {side.score}
      </span>
    </div>
  );
}

function FollowButton({
  side,
  league,
  favorites,
}: {
  side: SportsSide;
  league: string;
  favorites: JlFavoriteTeam[];
}) {
  const t = useT();
  if (!side.id) return null;
  const following = isFollowing(favorites, league, side.id);
  const label = side.abbr || side.location || side.name;
  return (
    <button
      onClick={() => toggleFavoriteTeam({ league, id: side.id ?? "", name: side.name })}
      aria-pressed={following}
      title={following ? t("Unfollow {team}", { team: side.name }) : t("Follow {team}", { team: side.name })}
      className={`flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold transition-colors ${
        following ? "border-accent/40 bg-accent-soft text-accent" : "border-edge-soft text-ink-subtle hover:text-ink"
      }`}
    >
      <Star size={11} fill={following ? "currentColor" : "none"} strokeWidth={2} />
      {label}
    </button>
  );
}

export function statusText(game: SportsGame, t: Translate): string {
  if (game.state === "in") return game.detail || t("Live");
  if (game.state === "post") return game.detail || t("Final");
  if (!game.startMs) return game.detail || t("Upcoming");
  const start = new Date(game.startMs);
  if (start.toDateString() === new Date().toDateString()) return fmtClock(game.startMs);
  const date = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${date} ${fmtClock(game.startMs)}`;
}
