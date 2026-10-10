import {
  Cloud,
  Globe2,
  GraduationCap,
  Info,
  Play,
  Radio,
  Shield,
  Sparkles,
  Star,
  Trophy,
  Tv,
  Users,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import { useCfbdVisionLinks } from "@/lib/jl/sports/use-cfbd";
import { useJlSession } from "@/lib/jl/account/client";
import { useJlLink } from "@/lib/jl/account/sync";
import { isFollowing, toggleFavoriteTeam } from "@/lib/jl/sports/favorites";
import type { JlFavoriteTeam } from "@/lib/jl/sports/rank";
import { teamLook } from "@/lib/jl/sports/team-look";
import { brandLook } from "@/lib/jl/sports/vision";
import { isCurrentLiveGame, visibleScore } from "@/lib/jl/sports/presentation";
import { useSettings } from "@/lib/settings";
import type { SportsGame, SportsSide } from "@/lib/sports/espn";
import { fmtClock } from "../now-format";
import { GameBackdrop, TeamMark } from "./game-backdrop";
import { SportsKeysHint } from "./sports-keys-hint";
import type { JlSportsActions } from "./use-jl-sports-dialogs";
import type { JlAlsoToday, JlHubGame } from "./use-jl-sports";
import { useGameArt } from "./use-sports-extras";

type Translate = ReturnType<typeof useT>;

const ALSO_TODAY_LIMIT = 6;

/** A section title with the accent bar, as the rest of the Sports Hub uses. */
export function SectionHeading({ title, aside }: { title: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 pe-[9px]">
      <h2 className="flex items-center gap-3 text-[20px] font-semibold text-ink 2xl:text-[26px]">
        <span
          aria-hidden
          className="h-6 w-1.5 rounded-full bg-gradient-to-b from-accent to-accent/30"
        />
        {title}
      </h2>
      {aside}
    </div>
  );
}

export function JlSportsHub({
  top,
  ticker,
  favorites,
  actions,
  onOpenGame,
  onLeagues,
  shortcuts = true,
}: {
  top: JlHubGame[];
  ticker: JlHubGame[];
  favorites: JlFavoriteTeam[];
  actions: JlSportsActions;
  onOpenGame: (game: SportsGame) => void;
  /** Off where the page shows Teams & players / Leagues / Colleges under its hero instead. */
  shortcuts?: boolean;
  /**
   * Where "Leagues" goes when the page has its own league browser (the Sports page's Explore).
   * World sports then gets its own button, since JL's leagues page is where it lived.
   */
  onLeagues?: () => void;
}) {
  const t = useT();
  const session = useJlSession();
  const link = useJlLink();
  const { openSportsPage } = useView();
  // With a CollegeFootballData key, college teams JL Vision hasn't linked get linked here.
  useCfbdVisionLinks();
  const pill =
    "flex h-9 items-center gap-1.5 rounded-full border border-edge-soft bg-canvas/40 px-3.5 text-[12.5px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink";
  return (
    <section className="flex flex-col gap-4 ps-[9px]">
      <div className="flex flex-wrap items-center gap-2.5 pe-[9px]">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
          {t("Sports Hub")}
        </h2>
        <span className="text-[12px] text-ink-subtle/80">{t("Top games, ranked for you")}</span>
        <SportsKeysHint />
        <div className="ms-auto flex flex-wrap items-center gap-2">
          {shortcuts && (
            <>
              <button onClick={actions.follow} className={pill}>
                <Users size={14} />
                {t("Teams & players")}
              </button>
              <button
                onClick={onLeagues ?? (() => openSportsPage({ kind: "leagues" }))}
                className={pill}
              >
                <Trophy size={14} />
                {t("Leagues")}
              </button>
            </>
          )}
          {onLeagues && (
            <button onClick={() => openSportsPage({ kind: "world" })} className={pill}>
              <Globe2 size={14} />
              {t("World sports")}
            </button>
          )}
          {shortcuts && (
            <button onClick={() => openSportsPage({ kind: "colleges" })} className={pill}>
              <GraduationCap size={14} />
              {t("Colleges")}
            </button>
          )}
          {shortcuts && (
            <button onClick={() => openSportsPage({ kind: "conferences" })} className={pill}>
              <Shield size={14} />
              {t("Conferences")}
            </button>
          )}
          <button onClick={actions.account} className={pill}>
            <Cloud size={14} className={link && session ? "text-accent" : ""} />
            {link && session
              ? t("Synced · {profile}", { profile: link.name })
              : t("Sign in to sync")}
          </button>
        </div>
      </div>
      {ticker.length > 0 && <FavoritesTicker items={ticker} onWatch={actions.watch} />}
      {top.length > 0 && (
        <>
          <SectionHeading
            title={t("Top 10 today")}
            aside={
              <span className="ms-auto text-[13px] font-medium text-ink-subtle">
                {t("{n} games", { n: top.length })}
              </span>
            }
          />
          <ol className="-mt-2 flex gap-3 overflow-x-auto pb-3 pe-[9px] pt-3">
            {top.map((item, i) => (
              <TopPoster
                key={`${item.game.league}:${item.game.id}`}
                item={item}
                rank={i + 1}
                favorites={favorites}
                actions={actions}
                onOpenGame={onOpenGame}
              />
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

function FavoritesTicker({
  items,
  onWatch,
}: {
  items: JlHubGame[];
  onWatch: (item: JlHubGame) => void;
}) {
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
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-subtle">
              {game.league}
            </span>
            <span className="font-semibold">
              {game.away.abbr || game.away.name} {visibleScore(game, game.away)}
            </span>
            <span className="text-ink-subtle">·</span>
            <span className="font-semibold">
              {game.home.abbr || game.home.name} {visibleScore(game, game.home)}
            </span>
            <span className={isCurrentLiveGame(game) ? "text-danger" : "text-ink-subtle"}>
              {statusText(game, t)}
            </span>
            {channels.length > 0 && (
              <Play size={11} fill="currentColor" strokeWidth={0} className="text-accent" />
            )}
          </button>
        );
      })}
    </div>
  );
}

function ctaLabel(item: JlHubGame, t: Translate): string {
  const n = item.channels.length;
  if (!n) return t("Ways to watch");
  return isCurrentLiveGame(item.game) ? t("Watch live") : t("Watch · {n} channels", { n });
}

function StatusChip({ game, className = "" }: { game: SportsGame; className?: string }) {
  const t = useT();
  const live = isCurrentLiveGame(game);
  return (
    <span
      className={`inline-flex h-[22px] items-center gap-1.5 rounded-full px-2 text-[11px] font-semibold ${
        live ? "bg-danger text-white" : "bg-canvas/70 text-ink backdrop-blur"
      } ${className}`}
    >
      {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}
      {statusText(game, t)}
    </span>
  );
}

/** A Top 10 game as a tall poster with its rank standing behind it. */
function TopPoster({
  item,
  rank,
  favorites,
  actions,
  onOpenGame,
}: {
  item: JlHubGame;
  rank: number;
  favorites: JlFavoriteTeam[];
  actions: JlSportsActions;
  onOpenGame: (game: SportsGame) => void;
}) {
  const t = useT();
  const { settings } = useSettings();
  const { game, reasons, channels, mine } = item;
  const art = useGameArt(game);
  const focusId =
    [game.away, game.home].find((s) => s.id && isFollowing(favorites, game.league, s.id))?.id ??
    null;
  const detail = [
    ...reasons.slice(0, 2).map((r) => t(r.label, r.vars)),
    game.network,
    game.odds,
  ].filter(Boolean);
  return (
    <li
      className={`flex shrink-0 ${rank >= 10 ? "ps-[8.5rem] 2xl:ps-[11rem]" : "ps-[4.75rem] 2xl:ps-[6rem]"}`}
    >
      <div className="flex w-[clamp(196px,13.5vw,300px)] flex-col gap-2">
        <div className="relative">
          {/* The rank stands behind the poster's lower corner, as on a streaming Top 10. */}
          <span
            aria-hidden
            className="jl-sports-display jl-rank-numeral pointer-events-none absolute bottom-0 end-[calc(100%-2rem)] select-none text-[8.5rem] font-black leading-[0.74] 2xl:text-[11rem]"
          >
            {rank}
          </span>
          <button
            onClick={() => actions.watch(item)}
            aria-label={`${ctaLabel(item, t)}: ${game.away.name} ${t("at")} ${game.home.name}`}
            className="group relative z-10 block aspect-[2/3] w-full overflow-hidden rounded-2xl text-start shadow-[0_18px_40px_-18px_rgba(0,0,0,0.7)] ring-1 ring-edge transition duration-200 hover:-translate-y-1 hover:ring-2 hover:ring-accent"
          >
            <GameBackdrop game={game} variant="poster" focusId={focusId} />
            <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2">
              <span className="rounded-full bg-canvas/70 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink backdrop-blur">
                {game.league}
              </span>
              <StatusChip game={game} />
            </div>
            <div className="absolute inset-x-0 top-[20%] flex items-center justify-center gap-3">
              <TeamMark
                look={teamLook(game.away, art.away, brandLook(game.league, game.away.id))}
                className="h-[30%] w-[34%] max-h-20 min-h-14"
                textClass="text-[18px]"
              />
              <span className="jl-sports-display text-[11px] font-bold uppercase text-ink/75">
                {t("at")}
              </span>
              <TeamMark
                look={teamLook(game.home, art.home, brandLook(game.league, game.home.id))}
                className="h-[30%] w-[34%] max-h-20 min-h-14"
                textClass="text-[18px]"
              />
            </div>
            <div className="absolute inset-x-3 bottom-3 flex flex-col gap-1">
              {[game.away, game.home].map((side, i) => (
                <p
                  key={i}
                  className="flex items-center justify-between gap-2 text-[15px] font-semibold leading-tight text-ink 2xl:text-[17px]"
                >
                  <span className="truncate">
                    {side.rank ? (
                      <span className="me-1 text-[11px] font-bold text-accent">#{side.rank}</span>
                    ) : null}
                    {side.location || side.name}
                  </span>
                  {game.state !== "pre" && (
                    <span className="jl-sports-display text-[17px] font-black tabular-nums">
                      {side.score}
                    </span>
                  )}
                </p>
              ))}
              <p className="line-clamp-1 pt-0.5 text-[11.5px] text-ink-muted">
                {detail.join(" · ") || " "}
              </p>
              <span
                className={`mt-1.5 inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${
                  channels.length ? "bg-accent text-canvas" : "bg-ink/15 text-ink backdrop-blur"
                }`}
              >
                {channels.length ? (
                  <Play size={12} fill="currentColor" strokeWidth={0} />
                ) : (
                  <Radio size={12} />
                )}
                {ctaLabel(item, t)}
              </span>
            </div>
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <FollowButton side={game.away} league={game.league} favorites={favorites} />
          <FollowButton side={game.home} league={game.league} favorites={favorites} />
          {mine && game.state === "pre" && (
            <SmallAction label={t("Pre-game")} onClick={() => actions.pregame(item)}>
              <Sparkles size={12} />
            </SmallAction>
          )}
          <SmallAction label={t("Game details")} onClick={() => onOpenGame(game)}>
            <Info size={12} />
          </SmallAction>
        </div>
        {channels.length === 0 && settings.sportsChannelFinder && (
          <span className="text-[11px] text-ink-subtle">{t("Not on your channels")}</span>
        )}
      </div>
    </li>
  );
}

function SmallAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-7 w-7 items-center justify-center rounded-full border border-edge-soft bg-canvas/50 text-ink-muted transition-colors hover:border-edge hover:text-ink"
    >
      {children}
    </button>
  );
}

/** The day's other games, one section per league, as wide cards with both teams' logos. */
export function AlsoToday({
  groups,
  favorites,
  actions,
  onOpenGame,
}: {
  groups: JlAlsoToday[];
  favorites: JlFavoriteTeam[];
  actions: JlSportsActions;
  onOpenGame: (game: SportsGame) => void;
}) {
  const t = useT();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  if (!groups.length) return null;
  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => {
        const open = expanded.has(group.league);
        const shown = open ? group.items : group.items.slice(0, ALSO_TODAY_LIMIT);
        return (
          <section
            key={group.league}
            className="flex flex-col gap-4 ps-[9px]"
            aria-label={t("Also today · {league}", { league: t(group.label) })}
          >
            <SectionHeading
              title={t("Also today · {league}", { league: t(group.label) })}
              aside={
                <span className="ms-auto text-[13px] font-medium text-ink-subtle">
                  {group.live > 0 ? `${t("{n} on now", { n: group.live })} · ` : ""}
                  {t("{n} games", { n: group.items.length })}
                </span>
              }
            />
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,400px),1fr))] gap-4 pe-[9px] 2xl:grid-cols-[repeat(auto-fill,minmax(520px,1fr))]">
              {shown.map((item) => (
                <WallCard
                  key={`${item.game.league}:${item.game.id}`}
                  item={item}
                  favorites={favorites}
                  onWatch={actions.watch}
                  onOpenGame={onOpenGame}
                />
              ))}
            </ul>
            {group.items.length > ALSO_TODAY_LIMIT && (
              <button
                onClick={() =>
                  setExpanded((cur) => {
                    const next = new Set(cur);
                    if (open) next.delete(group.league);
                    else next.add(group.league);
                    return next;
                  })
                }
                className="mx-auto flex h-9 items-center rounded-full border border-edge-soft px-4 text-[12.5px] font-semibold text-ink-muted hover:border-edge hover:text-ink"
              >
                {open ? t("Show less") : t("Show all {n}", { n: group.items.length })}
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}

function WallCard({
  item,
  favorites,
  onWatch,
  onOpenGame,
}: {
  item: JlHubGame;
  favorites: JlFavoriteTeam[];
  onWatch: (item: JlHubGame) => void;
  onOpenGame: (game: SportsGame) => void;
}) {
  const t = useT();
  const { game, channels } = item;
  const art = useGameArt(game);
  const scored = game.state !== "pre";
  const focusId =
    [game.away, game.home].find((s) => s.id && isFollowing(favorites, game.league, s.id))?.id ??
    null;
  return (
    <li className="relative">
      <button
        onClick={() => onWatch(item)}
        aria-label={`${ctaLabel(item, t)}: ${game.away.name} ${t("at")} ${game.home.name}`}
        className="group relative flex aspect-[16/7] w-full flex-col overflow-hidden rounded-2xl text-start ring-1 ring-edge transition duration-200 hover:ring-2 hover:ring-accent"
      >
        <GameBackdrop game={game} variant="card" slot="card" focusId={focusId} />
        <div className="relative grid flex-1 grid-cols-[1fr_auto_1fr] items-center gap-2 px-5 pt-6">
          <WallTeam
            side={game.away}
            look={teamLook(game.away, art.away, brandLook(game.league, game.away.id))}
          />
          <div className="flex flex-col items-center gap-1">
            {scored ? (
              <span className="jl-sports-display text-[26px] font-black tabular-nums text-ink 2xl:text-[32px]">
                {game.away.score}
                <span className="mx-2 text-ink/40">–</span>
                {game.home.score}
              </span>
            ) : (
              <span className="jl-sports-display text-[15px] font-bold uppercase text-ink/75">
                {t("at")}
              </span>
            )}
            {game.odds && (
              <span className="max-w-[9rem] text-center text-[11px] leading-tight text-ink-muted">
                {game.odds}
              </span>
            )}
          </div>
          <WallTeam
            side={game.home}
            look={teamLook(game.home, art.home, brandLook(game.league, game.home.id))}
          />
        </div>
        <div className="relative flex items-center justify-between gap-2 bg-canvas/65 px-4 py-2 text-[12px] backdrop-blur">
          <span
            className={`flex items-center gap-1.5 font-semibold ${isCurrentLiveGame(game) ? "text-danger" : "text-ink/85"}`}
          >
            {isCurrentLiveGame(game) && (
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />
            )}
            {statusText(game, t)}
          </span>
          {game.network && (
            <span className="flex min-w-0 items-center gap-1.5 truncate uppercase tracking-[0.08em] text-ink-muted">
              <Tv size={13} className="shrink-0" />
              {game.network}
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${
              channels.length ? "bg-accent text-canvas" : "bg-ink/15 text-ink"
            }`}
          >
            {channels.length ? (
              <Play size={11} fill="currentColor" strokeWidth={0} />
            ) : (
              <Radio size={11} />
            )}
            {ctaLabel(item, t)}
          </span>
        </div>
      </button>
      <div className="absolute end-2 top-2 z-10 flex items-center gap-1.5">
        <FollowButton side={game.away} league={game.league} favorites={favorites} />
        <FollowButton side={game.home} league={game.league} favorites={favorites} />
        <SmallAction label={t("Game details")} onClick={() => onOpenGame(game)}>
          <Info size={12} />
        </SmallAction>
      </div>
    </li>
  );
}

function WallTeam({ side, look }: { side: SportsSide; look: ReturnType<typeof teamLook> }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
      <TeamMark
        look={look}
        className="h-[clamp(56px,5vw,96px)] w-[clamp(56px,5vw,96px)]"
        textClass="text-[clamp(18px,1.6vw,30px)]"
      />
      <p className="line-clamp-1 max-w-full text-[15px] font-semibold text-ink 2xl:text-[17px]">
        {side.rank ? (
          <span className="me-1 text-[11px] font-bold text-accent">#{side.rank}</span>
        ) : null}
        {side.location || side.name}
      </p>
    </div>
  );
}

export function WatchButton({
  item,
  onWatch,
}: {
  item: JlHubGame;
  onWatch: (item: JlHubGame) => void;
}) {
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
        <img
          src={side.logo}
          alt=""
          draggable={false}
          loading="lazy"
          onError={() => setErr(true)}
          className="h-5 w-5 shrink-0 object-contain"
        />
      ) : (
        <span className="h-5 w-5 shrink-0 rounded-full bg-canvas/60" />
      )}
      {side.rank ? (
        <span className="text-[11px] font-semibold text-ink-subtle">#{side.rank}</span>
      ) : null}
      <span className="flex-1 truncate text-[13.5px] font-semibold text-ink">
        {side.location || side.name}
      </span>
      {active && (
        <span className="w-8 shrink-0 text-end text-[17px] font-bold tabular-nums text-ink">
          {side.score}
        </span>
      )}
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
      title={
        following
          ? t("Unfollow {team}", { team: side.name })
          : t("Follow {team}", { team: side.name })
      }
      className={`flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold backdrop-blur transition-colors ${
        following
          ? "border-accent/40 bg-accent-soft text-accent"
          : "border-edge-soft bg-canvas/50 text-ink-subtle hover:text-ink"
      }`}
    >
      <Star size={11} fill={following ? "currentColor" : "none"} strokeWidth={2} />
      {label}
    </button>
  );
}

export function statusText(game: SportsGame, t: Translate): string {
  if (game.savedAt !== undefined) return `${t("Saved")} · ${fmtClock(game.savedAt)}`;
  if (game.state === "in") return game.detail || t("Live");
  if (game.state === "post") return game.detail || t("Final");
  if (!game.startMs) return game.detail || t("Upcoming");
  const start = new Date(game.startMs);
  if (start.toDateString() === new Date().toDateString()) return fmtClock(game.startMs);
  const date = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${date} ${fmtClock(game.startMs)}`;
}
