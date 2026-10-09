import { ChevronLeft, ChevronRight, Info, Play, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n";
import type { InsightLeader } from "@/lib/jl/sports/insight";
import { fetchPlayerLine, fetchPregameInsight } from "@/lib/jl/sports/people";
import { espnHeadshot } from "@/lib/jl/sports/search-parse";
import { teamLook } from "@/lib/jl/sports/team-look";
import type { SportsGame, SportsSide } from "@/lib/sports/espn";
import { useView } from "@/lib/view";
import { GameBackdrop, TeamBackdrop, TeamMark } from "./game-backdrop";
import { statusText } from "./jl-sports-hub";
import type { JlSportsActions } from "./use-jl-sports-dialogs";
import type { JlHubGame, JlPlayerSlide, JlTeamSlide } from "./use-jl-sports";
import { useGameArt, useTeamArt } from "./use-sports-extras";

const ADVANCE_MS = 9000;
const LEADER_SLIDES = 3;
const NO_TEAM_SLIDES: JlTeamSlide[] = [];

type Slide =
  | { kind: "game"; item: JlHubGame; place: number }
  | { kind: "team"; slide: JlTeamSlide }
  | { kind: "player"; slide: JlPlayerSlide }
  | { kind: "leader"; leader: InsightLeader; item: JlHubGame; team: string };

type Translate = ReturnType<typeof useT>;

const slideKey = (s: Slide): string =>
  s.kind === "game"
    ? `g:${s.item.game.league}:${s.item.game.id}`
    : s.kind === "team"
      ? `t:${s.slide.team.league}:${s.slide.team.id}`
      : s.kind === "player"
        ? `p:${s.slide.player.league}:${s.slide.player.id}`
        : `l:${s.item.game.id}:${s.leader.athlete}`;

/**
 * The Sports Hub's full-bleed hero: the Top 10 games, a slide for each team you follow, your
 * players and the top game's leaders, each on its team art (TheSportsDB photo, or a designed
 * backdrop from ESPN's logos and colours). One slide at a time; text and art change together.
 */
export function JlSportsHero({
  top,
  teamSlides = NO_TEAM_SLIDES,
  playerSlides,
  actions,
  onOpenGame,
  bleed = false,
}: {
  top: JlHubGame[];
  teamSlides?: JlTeamSlide[];
  playerSlides: JlPlayerSlide[];
  actions: JlSportsActions;
  onOpenGame: (game: SportsGame) => void;
  /** Edge to edge under the top bar (the Sports view); otherwise a rounded panel (Live TV). */
  bleed?: boolean;
}) {
  const t = useT();
  const root = useRef<HTMLElement>(null);
  const leaders = useTopGameLeaders(top[0] ?? null);
  const slides = useMemo<Slide[]>(() => {
    const games = top.map((item, i) => ({ kind: "game" as const, item, place: i + 1 }));
    const teams = teamSlides.map((slide) => ({ kind: "team" as const, slide }));
    return [
      ...games.slice(0, 1),
      ...teams,
      ...games.slice(1),
      ...playerSlides.map((slide) => ({ kind: "player" as const, slide })),
      ...leaders,
    ];
  }, [top, teamSlides, playerSlides, leaders]);
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
  const key = slideKey(current);

  return (
    <section
      ref={root}
      data-tv-hero-zone
      aria-roledescription="carousel"
      aria-label={t("Top games and players")}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!root.current?.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
      className={`relative overflow-hidden bg-canvas ${
        bleed
          ? "jl-sports-bleed h-[clamp(520px,80vh,980px)]"
          : "mx-[9px] h-[clamp(420px,60vh,720px)] rounded-[28px] border border-edge-soft/60"
      }`}
    >
      <div key={`art-${key}`} className="animate-fade-in absolute inset-0">
        <SlideArt slide={current} />
      </div>
      <div
        key={key}
        aria-live="polite"
        className={`animate-fade-in relative z-10 flex h-full max-w-[min(72rem,66%)] flex-col justify-end gap-5 2xl:gap-7 ${
          bleed ? "px-12 pb-24 pt-32" : "px-8 pb-20 pt-10"
        }`}
      >
        {current.kind === "game" && (
          <GameSlide
            item={current.item}
            place={current.place}
            actions={actions}
            onOpenGame={onOpenGame}
          />
        )}
        {current.kind === "team" && <TeamSlide slide={current.slide} actions={actions} />}
        {current.kind === "player" && <PlayerSlide slide={current.slide} actions={actions} />}
        {current.kind === "leader" && (
          <LeaderSlide
            leader={current.leader}
            team={current.team}
            item={current.item}
            actions={actions}
          />
        )}
      </div>
      {count > 1 && (
        <div
          className={`absolute z-20 flex items-center gap-2 ${bleed ? "bottom-8 end-12" : "bottom-6 end-8"}`}
        >
          <button
            onClick={() => go(-1)}
            aria-label={t("Previous")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-canvas/55 text-ink backdrop-blur hover:bg-raised"
          >
            <ChevronLeft size={17} className="dir-icon" />
          </button>
          <span className="mx-1 text-[13px] font-semibold tabular-nums text-ink/80" aria-hidden>
            {position + 1} / {count}
          </span>
          <div role="tablist" aria-label={t("Choose slide")} className="flex items-center gap-1.5">
            {slides.map((s, i) => (
              <button
                key={slideKey(s)}
                role="tab"
                aria-selected={i === position}
                aria-label={t("Slide {n}", { n: i + 1 })}
                onClick={() => setIndex(i)}
                className={`h-2 rounded-full transition-all duration-200 ${
                  i === position
                    ? "w-8 bg-accent shadow-[0_0_12px_var(--color-accent)]"
                    : "w-2 bg-ink/40 hover:bg-ink/70"
                }`}
              />
            ))}
          </div>
          <button
            onClick={() => go(1)}
            aria-label={t("Next")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-canvas/55 text-ink backdrop-blur hover:bg-raised"
          >
            <ChevronRight size={17} className="dir-icon" />
          </button>
        </div>
      )}
    </section>
  );
}

function SlideArt({ slide }: { slide: Slide }) {
  if (slide.kind === "game") return <GameBackdrop game={slide.item.game} variant="hero" />;
  if (slide.kind === "team")
    return <TeamBackdrop league={slide.slide.team.league} side={teamSide(slide.slide)} />;
  const game = slide.kind === "leader" ? slide.item.game : (slide.slide.next?.game ?? null);
  const image =
    slide.kind === "leader"
      ? slide.leader.athleteId
        ? espnHeadshot(slide.item.game.league, slide.leader.athleteId)
        : null
      : (slide.slide.player.headshot ??
        espnHeadshot(slide.slide.player.league, slide.slide.player.id));
  return (
    <>
      {game ? (
        <GameBackdrop game={game} variant="hero" marks={false} />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(110%_90%_at_80%_40%,var(--color-accent-soft),transparent_70%)]" />
      )}
      {image && <Headshot src={image} />}
    </>
  );
}

/** A player standing large at the far side, where a game slide shows the logos. */
function Headshot({ src }: { src: string }) {
  const [err, setErr] = useState(false);
  if (err) return null;
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      onError={() => setErr(true)}
      className="pointer-events-none absolute bottom-0 end-[6%] h-[84%] max-w-[46%] object-contain object-bottom drop-shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
    />
  );
}

/** The followed team as a side: ESPN's listing when a game has it, else its saved name. */
function teamSide(slide: JlTeamSlide): SportsSide {
  return (
    slide.side ?? {
      name: slide.team.name,
      abbr: "",
      logo: "",
      score: "",
      winner: false,
      id: slide.team.id,
    }
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
          for (const leader of side?.leaders ?? [])
            out.push({ kind: "leader", leader, item, team: side?.abbr ?? "" });
        }
        if (!controller.signal.aborted)
          setResult({ key: gameKey, slides: out.slice(0, LEADER_SLIDES) });
      })
      .catch(() => {});
    return () => controller.abort();
    // The game identity decides the request; live score updates don't refetch leaders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameKey]);
  return result.key === gameKey ? result.slides : [];
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="jl-sports-display text-[12px] font-bold uppercase tracking-[0.32em] text-accent drop-shadow 2xl:text-[15px]">
      {children}
    </p>
  );
}

/** The big round play button with its label, as one control. */
function PlayAction({
  label,
  onClick,
  ariaLabel,
}: {
  label: string;
  onClick: () => void;
  ariaLabel?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className="group flex items-center gap-4 rounded-full pe-4"
    >
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-canvas shadow-[0_10px_34px_-8px_var(--color-accent)] transition-transform duration-150 group-hover:scale-105 group-active:scale-95 2xl:h-20 2xl:w-20">
        <Play size={28} fill="currentColor" strokeWidth={0} className="dir-icon ms-1" />
      </span>
      <span className="jl-sports-display text-[13px] font-bold uppercase tracking-[0.2em] text-ink drop-shadow 2xl:text-[16px]">
        {label}
      </span>
    </button>
  );
}

function RoundAction({
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
      className="flex h-12 w-12 items-center justify-center rounded-full border border-ink/25 bg-canvas/45 text-ink backdrop-blur transition-colors hover:border-ink/60 hover:bg-canvas/70 2xl:h-14 2xl:w-14"
    >
      {children}
    </button>
  );
}

function watchLabel(item: JlHubGame, t: Translate): string {
  const n = item.channels.length;
  if (!n) return t("Ways to watch");
  if (item.game.state === "in") return t("Watch live · {n} channels", { n });
  return t("Watch · {n} channels", { n });
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
  const art = useGameArt(game);
  const live = game.state === "in";
  const atHome = game.state === "pre" ? t("at") : t("vs");
  return (
    <>
      <Eyebrow>
        {[
          t("Top 10 · #{n}", { n: place }),
          reasons[0] ? t(reasons[0].label, reasons[0].vars) : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </Eyebrow>
      <div className="flex flex-col gap-2">
        <HeroTeam
          side={game.away}
          look={teamLook(game.away, art.away)}
          showScore={game.state !== "pre"}
        />
        <span className="jl-sports-display ps-1 text-[13px] font-bold uppercase tracking-[0.3em] text-ink-muted">
          {atHome}
        </span>
        <HeroTeam
          side={game.home}
          look={teamLook(game.home, art.home)}
          showScore={game.state !== "pre"}
        />
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[14px] font-medium text-ink/90 drop-shadow 2xl:text-[17px]">
        <span className={`flex items-center gap-1.5 font-semibold ${live ? "text-danger" : ""}`}>
          {live && <span className="h-2 w-2 animate-pulse rounded-full bg-danger" />}
          {statusText(game, t)}
        </span>
        {[game.league, game.network].filter(Boolean).map((m) => (
          <span key={m}>{m}</span>
        ))}
        {game.odds && <span className="text-ink-muted">{game.odds}</span>}
        {reasons.slice(1, 3).map((r) => (
          <span
            key={r.label}
            className="rounded-full bg-canvas/55 px-2.5 py-0.5 text-[12px] text-ink-muted backdrop-blur"
          >
            {t(r.label, r.vars)}
          </span>
        ))}
      </p>
      <div className="flex flex-wrap items-center gap-4 pt-1">
        <PlayAction label={watchLabel(item, t)} onClick={() => actions.watch(item)} />
        {mine && game.state === "pre" && (
          <RoundAction label={t("Pre-game")} onClick={() => actions.pregame(item)}>
            <Sparkles size={19} />
          </RoundAction>
        )}
        <RoundAction label={t("Game details")} onClick={() => onOpenGame(game)}>
          <Info size={20} />
        </RoundAction>
      </div>
    </>
  );
}

function HeroTeam({
  side,
  look,
  showScore,
}: {
  side: SportsSide;
  look: ReturnType<typeof teamLook>;
  showScore: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-4">
      <TeamMark
        look={look}
        className="h-[clamp(44px,4.4vw,88px)] w-[clamp(44px,4.4vw,88px)] shrink-0"
        textClass="text-[clamp(14px,1.4vw,28px)]"
      />
      {side.rank ? (
        <span className="jl-sports-display text-[clamp(14px,1.3vw,24px)] font-bold text-accent">
          #{side.rank}
        </span>
      ) : null}
      <span className="jl-sports-display min-w-0 truncate text-[clamp(28px,3.4vw,64px)] font-black uppercase leading-[1.02] tracking-wide text-ink drop-shadow-[0_4px_24px_rgba(0,0,0,0.55)]">
        {side.location || side.name}
      </span>
      {showScore && (
        <span className="jl-sports-display ms-2 shrink-0 text-[clamp(28px,3.2vw,60px)] font-black tabular-nums text-ink">
          {side.score}
        </span>
      )}
    </div>
  );
}

function TeamSlide({ slide, actions }: { slide: JlTeamSlide; actions: JlSportsActions }) {
  const t = useT();
  const { openSportsPage } = useView();
  const { team, next } = slide;
  const side = teamSide(slide);
  const art = useTeamArt(team.league, side);
  const openTeam = () =>
    openSportsPage({ kind: "team", league: team.league, teamId: team.id, name: team.name });
  const game = next?.game ?? null;
  const live = game?.state === "in";
  let status = t("No game scheduled");
  if (game) {
    const home = game.home.id === team.id;
    const opponent = home ? game.away : game.home;
    status = live
      ? `${t("Live")} · ${[game.detail, `${game.away.abbr || game.away.name} ${game.away.score} – ${game.home.score} ${game.home.abbr || game.home.name}`].filter(Boolean).join(" · ")}`
      : `${home ? t("Next: vs {team}", { team: opponent.location || opponent.name }) : t("Next: at {team}", { team: opponent.location || opponent.name })} · ${statusText(game, t)}${game.network ? ` · ${game.network}` : ""}`;
  }
  return (
    <>
      <Eyebrow>{t("Your team · {league}", { league: team.league })}</Eyebrow>
      <div className="flex items-center gap-5">
        <TeamMark
          look={teamLook(side, art)}
          className="h-[clamp(56px,5.5vw,110px)] w-[clamp(56px,5.5vw,110px)] shrink-0"
          textClass="text-[clamp(18px,1.8vw,34px)]"
        />
        <h2 className="jl-sports-display line-clamp-2 text-[clamp(36px,5.6vw,104px)] font-black uppercase leading-[0.98] tracking-wide text-ink drop-shadow-[0_6px_30px_rgba(0,0,0,0.6)]">
          {side.name || team.name}
        </h2>
      </div>
      <p
        className={`flex items-center gap-2 text-[15px] font-medium drop-shadow 2xl:text-[19px] ${live ? "text-danger" : "text-ink/90"}`}
      >
        {live && <span className="h-2 w-2 animate-pulse rounded-full bg-danger" />}
        {status}
      </p>
      <div className="flex flex-wrap items-center gap-4 pt-1">
        {next ? (
          <PlayAction label={watchLabel(next, t)} onClick={() => actions.watch(next)} />
        ) : (
          <PlayAction label={t("Team page")} onClick={openTeam} />
        )}
        <RoundAction label={t("Team page")} onClick={openTeam}>
          <Info size={20} />
        </RoundAction>
      </div>
    </>
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
      eyebrow={t("Your player")}
      name={player.name}
      subtitle={[player.position, player.teamName, player.league].filter(Boolean).join(" · ")}
      stats={stats}
      footer={
        next ? (
          <div className="flex flex-col gap-3">
            <span className="text-[14px] text-ink/90">
              {t("Next: {away} at {home}", {
                away: next.game.away.abbr || next.game.away.name,
                home: next.game.home.abbr || next.game.home.name,
              })}{" "}
              · {statusText(next.game, t)}
            </span>
            <PlayAction label={watchLabel(next, t)} onClick={() => actions.watch(next)} />
          </div>
        ) : (
          <span className="text-[14px] text-ink-muted">{t("No game this week")}</span>
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
      eyebrow={t("Top player · #1 game")}
      name={leader.athlete}
      subtitle={[team, item.game.league].filter(Boolean).join(" · ")}
      stats={[{ label: leader.category, value: leader.value }]}
      footer={<PlayAction label={watchLabel(item, t)} onClick={() => actions.watch(item)} />}
    />
  );
}

function PersonLayout({
  eyebrow,
  name,
  subtitle,
  stats,
  footer,
}: {
  eyebrow: string;
  name: string;
  subtitle: string;
  stats: Array<{ label: string; value: string }>;
  footer: ReactNode;
}) {
  return (
    <>
      <Eyebrow>{eyebrow}</Eyebrow>
      <div className="relative flex min-w-0 flex-col gap-2">
        <h2 className="jl-sports-display line-clamp-2 text-[clamp(32px,4.6vw,88px)] font-black uppercase leading-[1] tracking-wide text-ink drop-shadow-[0_6px_30px_rgba(0,0,0,0.6)]">
          {name}
        </h2>
        <span className="text-[15px] text-ink/85 2xl:text-[18px]">{subtitle}</span>
        {stats.length > 0 && (
          <div className="flex flex-wrap gap-x-5 gap-y-1 pt-1">
            {stats.map((s) => (
              <span key={s.label} className="text-[14px] text-ink/85 2xl:text-[17px]">
                <span className="text-ink-muted">{s.label}</span>{" "}
                <span className="font-bold text-ink">{s.value}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="relative">{footer}</div>
    </>
  );
}
