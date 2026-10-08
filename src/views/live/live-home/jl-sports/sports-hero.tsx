import { ChevronLeft, ChevronRight, Info, Sparkles, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import type { InsightLeader } from "@/lib/jl/sports/insight";
import { fetchPlayerLine, fetchPregameInsight } from "@/lib/jl/sports/people";
import { espnHeadshot } from "@/lib/jl/sports/search-parse";
import type { SportsGame, SportsSide } from "@/lib/sports/espn";
import { statusText, WatchButton } from "./jl-sports-hub";
import type { JlSportsActions } from "./use-jl-sports-dialogs";
import type { JlHubGame, JlPlayerSlide } from "./use-jl-sports";
import { GameBackdrop } from "./game-backdrop";

const ADVANCE_MS = 9000;
const LEADER_SLIDES = 3;

type Slide =
  | { kind: "game"; item: JlHubGame; place: number }
  | { kind: "player"; slide: JlPlayerSlide }
  | { kind: "leader"; leader: InsightLeader; item: JlHubGame; team: string };

/** Top 10 games, your players, then the top game's leading players, in one rotating hero. */
export function JlSportsHero({
  top,
  playerSlides,
  actions,
  onOpenGame,
}: {
  top: JlHubGame[];
  playerSlides: JlPlayerSlide[];
  actions: JlSportsActions;
  onOpenGame: (game: SportsGame) => void;
}) {
  const t = useT();
  const leaders = useTopGameLeaders(top[0] ?? null);
  const slides = useMemo<Slide[]>(
    () => [
      ...top.map((item, i) => ({ kind: "game" as const, item, place: i + 1 })),
      ...playerSlides.map((slide) => ({ kind: "player" as const, slide })),
      ...leaders,
    ],
    [top, playerSlides, leaders],
  );
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;
  // Following or unfollowing changes the slide count; stay on a valid slide.
  const position = count ? index % count : 0;
  const current = slides[position];

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || paused || count < 2) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [paused, count]);

  if (!current) return null;
  const go = (delta: number) => setIndex((position + delta + count) % count);

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t("Top games and players")}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="relative mx-[9px] overflow-hidden rounded-2xl border border-edge-soft/60 bg-gradient-to-br from-elevated via-canvas to-canvas"
    >
      {current.kind === "game" && <GameBackdrop key={`art-${position}`} game={current.item.game} />}
      <div key={position} className="animate-fade-in relative flex min-h-[260px] flex-col justify-between gap-5 p-6 md:p-8">
        {current.kind === "game" && (
          <GameSlide item={current.item} place={current.place} actions={actions} onOpenGame={onOpenGame} />
        )}
        {current.kind === "player" && <PlayerSlide slide={current.slide} actions={actions} />}
        {current.kind === "leader" && (
          <LeaderSlide leader={current.leader} team={current.team} item={current.item} actions={actions} />
        )}
      </div>
      {count > 1 && (
        <div className="absolute bottom-4 end-4 flex items-center gap-2">
          <button
            onClick={() => go(-1)}
            aria-label={t("Previous")}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-elevated/80 text-ink hover:bg-raised"
          >
            <ChevronLeft size={16} className="dir-icon" />
          </button>
          <span className="text-[11.5px] tabular-nums text-ink-subtle">
            {position + 1} / {count}
          </span>
          <button
            onClick={() => go(1)}
            aria-label={t("Next")}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-elevated/80 text-ink hover:bg-raised"
          >
            <ChevronRight size={16} className="dir-icon" />
          </button>
        </div>
      )}
    </section>
  );
}

/** The #1 game's leading players, as slides (fetched once per game). */
function useTopGameLeaders(item: JlHubGame | null): Slide[] {
  const [result, setResult] = useState<{ key: string; slides: Slide[] }>({ key: "", slides: [] });
  const gameKey = item ? `${item.game.league}:${item.game.id}` : "";
  useEffect(() => {
    if (!item) return;
    const controller = new AbortController();
    fetchPregameInsight(item.game, controller.signal)
      .then((insight) => {
        const out: Slide[] = [];
        for (const side of [insight.away, insight.home]) {
          for (const leader of side?.leaders ?? []) out.push({ kind: "leader", leader, item, team: side?.abbr ?? "" });
        }
        if (!controller.signal.aborted) setResult({ key: gameKey, slides: out.slice(0, LEADER_SLIDES) });
      })
      .catch(() => {});
    return () => controller.abort();
    // The game identity decides the request; live score updates don't refetch leaders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameKey]);
  return result.key === gameKey ? result.slides : [];
}

function GameSlide({
  item,
  place,
  actions,
  onOpenGame,
}: {
  item: JlHubGame;
  place: number;
  actions: JlSportsActions;
  onOpenGame: (game: SportsGame) => void;
}) {
  const t = useT();
  const { game, reasons, mine } = item;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.14em]">
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-accent">{t("Top 10 · #{n}", { n: place })}</span>
        <span className={game.state === "in" ? "text-danger" : "text-ink-subtle"}>{statusText(game, t)}</span>
        <span className="text-ink-subtle">{[game.league, game.network].filter(Boolean).join(" · ")}</span>
      </div>
      <div className="flex items-center gap-6 md:gap-10">
        <HeroTeam side={game.away} showScore={game.state !== "pre"} />
        <span className="text-[13px] font-semibold uppercase text-ink-subtle">{t("at")}</span>
        <HeroTeam side={game.home} showScore={game.state !== "pre"} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {reasons.slice(0, 3).map((r) => (
          <span key={r.label} className="rounded-full bg-elevated/80 px-2.5 py-1 text-[11.5px] text-ink-muted">
            {t(r.label, r.vars)}
          </span>
        ))}
        {game.odds && <span className="text-[11.5px] text-ink-subtle">{game.odds}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2 pe-28">
        <WatchButton item={item} onWatch={actions.watch} />
        {mine && game.state === "pre" && (
          <button
            onClick={() => actions.pregame(item)}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-edge px-3 text-[12.5px] font-semibold text-ink"
          >
            <Sparkles size={13} />
            {t("Pre-game")}
          </button>
        )}
        <button
          onClick={() => onOpenGame(game)}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-edge px-3 text-[12.5px] font-semibold text-ink"
        >
          <Info size={13} />
          {t("Game details")}
        </button>
      </div>
    </>
  );
}

function HeroTeam({ side, showScore }: { side: SportsSide; showScore: boolean }) {
  const [err, setErr] = useState(false);
  return (
    <div className="flex min-w-0 items-center gap-3">
      {side.logo && !err ? (
        <img src={side.logo} alt="" onError={() => setErr(true)} className="h-14 w-14 shrink-0 object-contain md:h-20 md:w-20" />
      ) : (
        <span className="h-14 w-14 shrink-0 rounded-full bg-elevated md:h-20 md:w-20" />
      )}
      <div className="flex min-w-0 flex-col">
        {side.rank ? <span className="text-[12px] font-semibold text-ink-subtle">#{side.rank}</span> : null}
        <span className="truncate font-display text-[22px] font-medium leading-tight text-ink md:text-[30px]">
          {side.location || side.name}
        </span>
        {showScore && <span className="text-[28px] font-bold tabular-nums text-ink">{side.score}</span>}
      </div>
    </div>
  );
}

function PlayerSlide({ slide, actions }: { slide: JlPlayerSlide; actions: JlSportsActions }) {
  const t = useT();
  const { player, next } = slide;
  const [stats, setStats] = useState<Array<{ label: string; value: string }>>([]);
  const playerKey = `${player.league}:${player.id}`;
  useEffect(() => {
    const controller = new AbortController();
    fetchPlayerLine(player, controller.signal)
      .then((line) => {
        if (!controller.signal.aborted) setStats(line?.stats ?? []);
      })
      .catch(() => {});
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerKey]);
  return (
    <PersonLayout
      image={player.headshot ?? espnHeadshot(player.league, player.id)}
      eyebrow={t("Your player")}
      name={player.name}
      subtitle={[player.position, player.teamName, player.league].filter(Boolean).join(" · ")}
      stats={stats}
      footer={
        next ? (
          <div className="flex flex-wrap items-center gap-3 pe-28">
            <span className="text-[12.5px] text-ink-muted">
              {t("Next: {away} at {home}", {
                away: next.game.away.abbr || next.game.away.name,
                home: next.game.home.abbr || next.game.home.name,
              })}{" "}
              · {statusText(next.game, t)}
            </span>
            <WatchButton item={next} onWatch={actions.watch} />
          </div>
        ) : (
          <span className="text-[12.5px] text-ink-subtle">{t("No game this week")}</span>
        )
      }
    />
  );
}

function LeaderSlide({
  leader,
  team,
  item,
  actions,
}: {
  leader: InsightLeader;
  team: string;
  item: JlHubGame;
  actions: JlSportsActions;
}) {
  const t = useT();
  return (
    <PersonLayout
      image={leader.athleteId ? espnHeadshot(item.game.league, leader.athleteId) : null}
      eyebrow={t("Top player · #1 game")}
      name={leader.athlete}
      subtitle={[team, item.game.league].filter(Boolean).join(" · ")}
      stats={[{ label: leader.category, value: leader.value }]}
      footer={
        <div className="flex items-center gap-3 pe-28">
          <WatchButton item={item} onWatch={actions.watch} />
        </div>
      }
    />
  );
}

function PersonLayout({
  image,
  eyebrow,
  name,
  subtitle,
  stats,
  footer,
}: {
  image: string | null;
  eyebrow: string;
  name: string;
  subtitle: string;
  stats: Array<{ label: string; value: string }>;
  footer: React.ReactNode;
}) {
  const [err, setErr] = useState(false);
  return (
    <>
      <span className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-accent">{eyebrow}</span>
      <div className="flex items-center gap-5">
        {image && !err ? (
          <img
            src={image}
            alt=""
            onError={() => setErr(true)}
            className="h-24 w-24 shrink-0 rounded-full bg-elevated object-cover md:h-28 md:w-28"
          />
        ) : (
          <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-elevated md:h-28 md:w-28">
            <User size={32} className="text-ink-subtle" />
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate font-display text-[26px] font-medium leading-tight text-ink md:text-[34px]">{name}</span>
          <span className="truncate text-[13px] text-ink-muted">{subtitle}</span>
          {stats.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
              {stats.map((s) => (
                <span key={s.label} className="text-[12.5px] text-ink-muted">
                  <span className="text-ink-subtle">{s.label}</span> <span className="font-semibold text-ink">{s.value}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {footer}
    </>
  );
}
