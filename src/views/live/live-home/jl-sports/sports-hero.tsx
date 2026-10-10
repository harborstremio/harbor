import { ChevronLeft, ChevronRight, ImageIcon, Info, Play, Sparkles, Users2 } from "lucide-react";
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { useHeroDock } from "@/lib/hero-dock";
import { useT } from "@/lib/i18n";
import { nativeTvAvailable } from "@/lib/player/native-tv/bridge";
import { artKey, curatedArt, useCuratedArtVersion } from "@/lib/jl/sports/curated-art";
import { stableIndex } from "@/lib/jl/sports/fanart";
import { isFollowing, useJlSportsFavorites } from "@/lib/jl/sports/favorites";
import type { InsightLeader } from "@/lib/jl/sports/insight";
import { setPinnedWallpaper, usePinnedWallpaper } from "@/lib/jl/sports/page-wallpaper";
import { fetchPlayerLine, fetchPregameInsight } from "@/lib/jl/sports/people";
import { espnHeadshot } from "@/lib/jl/sports/search-parse";
import { mixHeroSlides, photoSlides } from "@/lib/jl/sports/hub-sections";
import { teamLook, wordmarkAccent, wordmarkLines } from "@/lib/jl/sports/team-look";
import { brandLook } from "@/lib/jl/sports/vision";
import { isCurrentLiveGame, visibleScore } from "@/lib/jl/sports/presentation";
import { useSettings } from "@/lib/settings";
import { isIndividualCompetition } from "@/lib/sports/competition-metadata";
import type { SportsGame, SportsSide } from "@/lib/sports/espn";
import { getLeagueLabel, leagueByKey } from "@/lib/sports/espn-leagues";
import { hubLeague } from "@/lib/sports/hub-data";
import type { TeamIdentity } from "@/lib/sports/team-profile";
import { useView } from "@/lib/view";
import { sportsSceneryPhoto } from "@/views/sports/sports-hero-scenery";
import { useSportsArtwork } from "@/views/sports/use-artwork";
import "@/views/sports/team-profile.css";
import { GameBackdrop, TeamBackdrop, TeamMark } from "./game-backdrop";
import { statusText } from "./jl-sports-hub";
import type { JlSportsActions } from "./use-jl-sports-dialogs";
import type { JlHubGame, JlPlayerSlide, JlTeamSlide } from "./use-jl-sports";
import { curatedTeamArt, useGameArt, useTeamArt } from "./use-sports-extras";

// Harbor's team page, opened from a followed team's slide.
const TeamProfile = lazy(() =>
  import("@/views/sports/team-profile").then((m) => ({ default: m.TeamProfile })),
);

const ADVANCE_MS = 9000;
const LEADER_SLIDES = 3;
const NO_TEAM_SLIDES: JlTeamSlide[] = [];
const NO_FEATURED: JlHubGame[] = [];

type Slide =
  | { kind: "game"; item: JlHubGame; place: number; photo?: boolean }
  | { kind: "featured"; item: JlHubGame }
  | { kind: "team"; slide: JlTeamSlide }
  | { kind: "player"; slide: JlPlayerSlide }
  | { kind: "leader"; leader: InsightLeader; item: JlHubGame; team: string };

type Translate = ReturnType<typeof useT>;

const slideKey = (s: Slide): string =>
  s.kind === "game"
    ? `g:${s.item.game.league}:${s.item.game.id}`
    : s.kind === "featured"
      ? `f:${s.item.game.league}:${s.item.game.id}`
      : s.kind === "team"
        ? `t:${s.slide.team.league}:${s.slide.team.id}`
        : s.kind === "player"
          ? `p:${s.slide.player.league}:${s.slide.player.id}`
          : `l:${s.item.game.id}:${s.leader.athlete}`;

/** The team a slide is about: the followed side of a game, else its home side. */
type Focus = { league: string; side: SportsSide } | null;

function gameFocus(game: SportsGame, followed: Array<{ league: string; id: string }>): SportsSide {
  if (game.away.id && isFollowing(followed, game.league, game.away.id)) return game.away;
  return game.home;
}

function slideFocus(slide: Slide, followed: Array<{ league: string; id: string }>): Focus {
  switch (slide.kind) {
    case "game":
    case "featured":
      return { league: slide.item.game.league, side: gameFocus(slide.item.game, followed) };
    case "team":
      return { league: slide.slide.team.league, side: teamSide(slide.slide) };
    case "player": {
      const { player, next } = slide.slide;
      if (next) return { league: next.game.league, side: gameFocus(next.game, followed) };
      return player.teamId
        ? {
            league: player.league,
            side: { ...EMPTY_SIDE, id: player.teamId, name: player.teamName ?? "" },
          }
        : null;
    }
    case "leader":
      return { league: slide.item.game.league, side: gameFocus(slide.item.game, followed) };
  }
}

const EMPTY_SIDE: SportsSide = { id: "", name: "", abbr: "", logo: "", score: "", winner: false };

/**
 * The Sports Hub's full-bleed fan-art hero: the Top 10 games, a slide for each team you follow,
 * your players and the top game's leaders. Each slide stands on the owner's own art for its team
 * (else TheSportsDB's photo, Harbor's sports artwork, then a designed backdrop from ESPN's logos
 * and colours), with the team's wordmark large at the start. On the Sports page the Hub's
 * featured events take turns with them. One slide at a time; text and art change together.
 */
export function JlSportsHero({
  top,
  teamSlides = NO_TEAM_SLIDES,
  playerSlides,
  featured = NO_FEATURED,
  actions,
  onOpenGame,
  bleed = false,
  flush = false,
}: {
  top: JlHubGame[];
  teamSlides?: JlTeamSlide[];
  playerSlides: JlPlayerSlide[];
  /** Featured events from the Sports page's own selection, shown between JL's slides. */
  featured?: JlHubGame[];
  actions: JlSportsActions;
  onOpenGame: (game: SportsGame) => void;
  /** Edge to edge under the top bar (the Sports view); otherwise a rounded panel (Live TV). */
  bleed?: boolean;
  /** With `bleed`: the parent has no padding to reach past (the Sports page's own scroller). */
  flush?: boolean;
}) {
  const t = useT();
  const root = useRef<HTMLElement>(null);
  const followed = useJlSportsFavorites();
  const leaders = useTopGameLeaders(top[0] ?? null);
  const slides = useMemo<Slide[]>(() => {
    const games = top.map((item, i) => ({ kind: "game" as const, item, place: i + 1 }));
    const teams = teamSlides.map((slide) => ({ kind: "team" as const, slide }));
    // A game of yours on now leads; then every team you follow, then the rest of the Top 10.
    const liveMine = games.filter((g) => g.item.mine && g.item.game.state === "in");
    const own: Slide[] = [
      ...liveMine,
      ...teams,
      ...games.filter((g) => !liveMine.includes(g)),
      ...playerSlides.map((slide) => ({ kind: "player" as const, slide })),
      ...leaders,
    ];
    const mixed = mixHeroSlides<Slide>(
      own,
      featured.map((item) => ({ kind: "featured" as const, item })),
    );
    const photo = photoSlides(
      mixed.map((s) =>
        s.kind === "featured" ? "photo" : s.kind === "game" ? "either" : "designed",
      ),
    );
    return mixed.map((s, i) => (s.kind === "game" ? { ...s, photo: photo[i] } : s));
  }, [top, teamSlides, playerSlides, featured, leaders]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const awake = useHeroAwake(root);
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
  const focus = slideFocus(current, followed);

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
          ? `${flush ? "" : "jl-sports-bleed "}h-[clamp(520px,68vh,900px)]`
          : "mx-[9px] h-[clamp(420px,60vh,720px)] rounded-[28px] border border-edge-soft/60"
      }`}
    >
      <div key={`art-${key}`} className="animate-fade-in absolute inset-0">
        <SlideArt slide={current} focusId={focus?.side.id || null} />
      </div>
      <div
        key={key}
        aria-live="polite"
        className={`animate-fade-in relative z-10 flex h-full max-w-[min(64rem,62%)] flex-col justify-end gap-4 2xl:gap-6 ${
          bleed ? "px-12 pb-20 pt-32" : "px-8 pb-16 pt-10"
        }`}
      >
        {current.kind === "game" && (
          <GameSlide
            item={current.item}
            place={current.place}
            actions={actions}
            onOpenGame={onOpenGame}
            focus={focus}
          />
        )}
        {current.kind === "featured" && (
          <FeaturedSlide
            item={current.item}
            actions={actions}
            onOpenGame={onOpenGame}
            focus={focus}
          />
        )}
        {current.kind === "team" && (
          <TeamSlide slide={current.slide} actions={actions} onOpenGame={onOpenGame} />
        )}
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
      <PinWallpaperButton focus={focus} bleed={bleed} awake={awake} />
      {count > 1 && (
        <div
          className={`absolute z-20 flex items-center gap-2 ${bleed ? "bottom-7 end-12" : "bottom-6 end-8"}`}
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

/**
 * "Pin to wallpaper": with a game playing in the hero dock it moves the video behind the page
 * (Harbor's wallpaper dock mode); otherwise it pins this slide's art as the page's wallpaper.
 * Pressed again, it unpins.
 */
function PinWallpaperButton({
  focus,
  bleed,
  awake,
}: {
  focus: Focus;
  bleed: boolean;
  /** Shown only while the hero is in use, so it never sits on top of the art. */
  awake: boolean;
}) {
  const t = useT();
  const dock = useHeroDock();
  const { settings, update } = useSettings();
  const pinned = usePinnedWallpaper();
  const art = useTeamArt(focus?.league ?? "", focus?.side ?? null);
  useCuratedArtVersion();
  const videoMode = !!dock && !nativeTvAvailable();
  const key = focus?.side.id ? artKey.team(focus.league, focus.side.id) : null;
  const fallback =
    (art?.fanart.length
      ? art.fanart[stableIndex(focus?.side.id || focus?.side.name || "", art.fanart.length)]
      : (art?.stadium ?? art?.banner ?? null)) ??
    (focus ? sportsSceneryPhoto(hubLeague(focus.league)?.group, focus.league) : null);
  const target =
    key && curatedArt(key, "wallpaper") ? { key, url: fallback } : { key: null, url: fallback };
  const label = focus?.side.name || focus?.side.location || "";
  const pressed = videoMode
    ? settings.heroDockMode === "wallpaper"
    : !!pinned && pinned.key === target.key && (target.key !== null || pinned.url === target.url);
  if (!videoMode && !target.url && !target.key) return null;
  const onClick = () => {
    if (videoMode) update({ heroDockMode: pressed ? "hero" : "wallpaper" });
    else setPinnedWallpaper(pressed ? null : { ...target, label });
  };
  const text = pressed ? t("Unpin wallpaper") : t("Pin to wallpaper");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      title={videoMode ? t("Wallpaper mode — video continues while you browse") : undefined}
      className={`absolute z-20 flex h-11 items-center gap-2 rounded-xl border px-4 text-[14px] font-semibold backdrop-blur-md transition-[color,background-color,border-color,opacity] duration-300 ${
        bleed ? "end-12 top-24" : "end-6 top-6"
      } ${awake ? "opacity-100" : "pointer-events-none opacity-0"} ${
        pressed
          ? "border-accent/60 bg-accent/20 text-ink"
          : "border-white/15 bg-canvas/55 text-ink hover:border-white/35 hover:bg-canvas/75"
      }`}
    >
      <ImageIcon size={17} />
      {text}
    </button>
  );
}

function SlideArt({ slide, focusId }: { slide: Slide; focusId: string | null }) {
  if (slide.kind === "game")
    return slide.photo ? (
      <FeaturedArt game={slide.item.game} focusId={focusId} />
    ) : (
      <GameBackdrop game={slide.item.game} variant="hero" focusId={focusId} />
    );
  if (slide.kind === "featured") return <FeaturedArt game={slide.item.game} focusId={focusId} />;
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
        <GameBackdrop game={game} variant="hero" marks={false} focusId={focusId} />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(110%_90%_at_80%_40%,var(--color-accent-soft),transparent_70%)]" />
      )}
      {image && <Headshot src={image} />}
    </>
  );
}

/**
 * A photo slide's art (featured events and every other Top 10 game): Harbor's sports artwork
 * (a picture of the event, else the league's photo, else Harbor's photo of the sport) around
 * the teams' own photos, over the designed backdrop. A fight's portraits stand at the far side
 * like a player's.
 */
function FeaturedArt({ game, focusId }: { game: SportsGame; focusId: string | null }) {
  const art = useSportsArtwork(game);
  // Harbor's bundled venue photo for the sport keeps every featured slide a picture.
  const scenery = sportsSceneryPhoto(hubLeague(game.league)?.group, game.league);
  const portrait = art.home || art.away;
  return (
    <>
      <GameBackdrop
        game={game}
        variant="hero"
        focusId={focusId}
        marks={!portrait}
        eventPhoto={game.artwork || game.poster}
        leaguePhoto={art.backdrop || scenery}
      />
      {portrait && <Headshot src={portrait} />}
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

/**
 * A team's wordmark: the owner's wordmark image when they set one, else the name in heavy
 * condensed type on two lines, the second in the team's brighter colour ("OREGON" / "DUCKS").
 */
function Wordmark({ league, side, name }: { league: string; side: SportsSide; name?: string }) {
  useCuratedArtVersion();
  const image = curatedTeamArt(league, side, "wordmark");
  const [failed, setFailed] = useState<string | null>(null);
  const art = useTeamArt(league, side);
  const full = name || side.name;
  if (image && failed !== image) {
    return (
      <h2 className="m-0">
        <img
          src={image}
          alt={full}
          draggable={false}
          onError={() => setFailed(image)}
          className="max-h-[clamp(120px,22vh,260px)] w-auto max-w-full object-contain object-left drop-shadow-[0_10px_40px_rgba(0,0,0,0.55)] rtl:object-right"
        />
      </h2>
    );
  }
  const [first, second] = wordmarkLines({ ...side, name: full });
  const accent = wordmarkAccent(teamLook(side, art, brandLook(league, side.id)));
  return (
    <h2 className="jl-wordmark m-0 flex flex-col uppercase" aria-label={full}>
      <span className="jl-wordmark-line text-ink">{first}</span>
      {second && (
        <span
          className="jl-wordmark-line jl-wordmark-accent"
          style={{ color: accent ? `#${accent}` : "var(--color-accent)" }}
        >
          {second}
        </span>
      )}
    </h2>
  );
}

/** "UCLA at Oregon" with both logos, and the score once the game is on. */
function Matchup({ game }: { game: SportsGame }) {
  const t = useT();
  const art = useGameArt(game);
  const scored = game.state !== "pre";
  const team = (side: SportsSide, look: ReturnType<typeof teamLook>) => (
    <span className="flex min-w-0 items-center gap-2.5">
      <TeamMark
        look={look}
        className="h-[clamp(30px,2.6vw,46px)] w-[clamp(30px,2.6vw,46px)] shrink-0"
        textClass="text-[13px]"
      />
      {side.rank ? <span className="text-[0.7em] font-bold text-accent">#{side.rank}</span> : null}
      <span className="truncate">{side.location || side.name}</span>
      {scored && (
        <span className="font-[family-name:var(--font-rank)] text-[1.15em] font-bold tabular-nums">
          {visibleScore(game, side)}
        </span>
      )}
    </span>
  );
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[clamp(17px,1.45vw,26px)] font-semibold text-ink drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
      {team(game.away, teamLook(game.away, art.away, brandLook(game.league, game.away.id)))}
      <span className="text-[0.75em] font-medium text-ink-muted">
        {game.state === "pre" ? t("at") : t("vs")}
      </span>
      {team(game.home, teamLook(game.home, art.home, brandLook(game.league, game.home.id)))}
    </p>
  );
}

/** The game's status line: live state, league, network, the line and why it ranks. */
function GameMeta({ item }: { item: JlHubGame }) {
  const t = useT();
  const { game, reasons } = item;
  const live = isCurrentLiveGame(game);
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[14px] font-medium text-ink/90 drop-shadow 2xl:text-[16px]">
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
  );
}

/** The accent "Watch game" pill: opens the chooser of the viewer's channels for the game. */
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
      className="flex h-12 items-center gap-2.5 rounded-full bg-accent px-6 text-[16px] font-bold text-canvas shadow-[0_12px_34px_-10px_var(--color-accent)] transition-transform duration-150 hover:scale-[1.03] active:scale-95 2xl:h-14 2xl:px-7 2xl:text-[18px]"
    >
      <Play size={18} fill="currentColor" strokeWidth={0} className="dir-icon" />
      {label}
    </button>
  );
}

/** The glass outline pill next to Watch ("Game details", "Team page"). */
function GlassAction({
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
      className="flex h-12 items-center gap-2.5 rounded-full border border-white/25 bg-canvas/45 px-5 text-[15px] font-semibold text-ink backdrop-blur-md transition-colors hover:border-white/50 hover:bg-canvas/70 2xl:h-14 2xl:text-[17px]"
    >
      {children}
      {label}
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
      className="flex h-12 w-12 items-center justify-center rounded-full border border-white/25 bg-canvas/45 text-ink backdrop-blur transition-colors hover:border-white/50 hover:bg-canvas/70 2xl:h-14 2xl:w-14"
    >
      {children}
    </button>
  );
}

function watchLabel(item: JlHubGame, t: Translate): string {
  const n = item.channels.length;
  if (!n) return t("Ways to watch");
  if (isCurrentLiveGame(item.game)) return t("Watch live");
  return t("Watch game");
}

/** Accessible name for Watch: the game and how many of the viewer's channels carry it. */
function watchAria(item: JlHubGame, t: Translate): string {
  const { game, channels } = item;
  const n = channels.length;
  return `${n ? t("Watch · {n} channels", { n }) : t("Ways to watch")}: ${game.away.name} ${t("at")} ${game.home.name}`;
}

function GameSlide({
  item,
  place,
  eyebrow,
  actions,
  onOpenGame,
  focus,
}: {
  item: JlHubGame;
  place?: number;
  /** Replaces the Top 10 eyebrow (featured events). */
  eyebrow?: string;
  actions: JlSportsActions;
  onOpenGame: (game: SportsGame) => void;
  focus: Focus;
}) {
  const t = useT();
  const { game, reasons, mine } = item;
  // Races, fight cards and tournaments read by the event's name, not the leading pair.
  const eventName = isEventSlide(game) ? game.context?.name : "";
  return (
    <>
      <Eyebrow>
        {eyebrow ??
          [
            place ? t("Top 10 · #{n}", { n: place }) : null,
            reasons[0] ? t(reasons[0].label, reasons[0].vars) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
      </Eyebrow>
      {eventName ? (
        <h2 className="jl-wordmark jl-wordmark-line line-clamp-2 uppercase text-ink">
          {eventName}
        </h2>
      ) : (
        focus && <Wordmark league={focus.league} side={focus.side} />
      )}
      {mine && (
        <p className="text-[clamp(18px,1.6vw,30px)] font-semibold text-ink/95 drop-shadow-[0_2px_14px_rgba(0,0,0,0.6)]">
          {t("Your teams. Your game day.")}
        </p>
      )}
      {!eventName && <Matchup game={game} />}
      <GameMeta item={item} />
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <PlayAction
          label={watchLabel(item, t)}
          ariaLabel={watchAria(item, t)}
          onClick={() => actions.watch(item)}
        />
        <GlassAction label={t("Game details")} onClick={() => onOpenGame(game)}>
          <Info size={18} />
        </GlassAction>
        {mine && game.state === "pre" && (
          <RoundAction label={t("Pre-game")} onClick={() => actions.pregame(item)}>
            <Sparkles size={19} />
          </RoundAction>
        )}
      </div>
    </>
  );
}

function isEventSlide(game: SportsGame): boolean {
  const group = hubLeague(game.league)?.group ?? "";
  return !!game.context?.name && (!!game.field?.length || isIndividualCompetition(group));
}

/** A featured event from the Sports page, laid out like a Top 10 slide. */
function FeaturedSlide({
  item,
  actions,
  onOpenGame,
  focus,
}: {
  item: JlHubGame;
  actions: JlSportsActions;
  onOpenGame: (game: SportsGame) => void;
  focus: Focus;
}) {
  const t = useT();
  const { game } = item;
  const league = hubLeague(game.league);
  const name = league ? getLeagueLabel(league) : game.league;
  const live = isCurrentLiveGame(game);
  return (
    <GameSlide
      item={item}
      eyebrow={`${live ? t("Live now") : t("Featured")} · ${name}`}
      actions={actions}
      onOpenGame={onOpenGame}
      focus={focus}
    />
  );
}

function TeamSlide({
  slide,
  actions,
  onOpenGame,
}: {
  slide: JlTeamSlide;
  actions: JlSportsActions;
  onOpenGame: (game: SportsGame) => void;
}) {
  const t = useT();
  const { openSportsPage } = useView();
  const { team, next } = slide;
  const side = teamSide(slide);
  const [profile, setProfile] = useState<TeamIdentity | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  // Harbor's team page when it covers the league; JL's own team page otherwise.
  const openTeam = () => {
    const identity = harborTeam(team, side);
    if (!identity) {
      openSportsPage({ kind: "team", league: team.league, teamId: team.id, name: team.name });
      return;
    }
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setProfile(identity);
  };
  const game = next?.game ?? null;
  return (
    <>
      <Eyebrow>{t("Your team · {league}", { league: team.league })}</Eyebrow>
      <Wordmark league={team.league} side={side} name={side.name || team.name} />
      <p className="text-[clamp(18px,1.6vw,30px)] font-semibold text-ink/95 drop-shadow-[0_2px_14px_rgba(0,0,0,0.6)]">
        {t("Your teams. Your game day.")}
      </p>
      {game && next ? (
        <>
          <Matchup game={game} />
          <GameMeta item={next} />
        </>
      ) : (
        <p className="text-[15px] font-medium text-ink/85 drop-shadow 2xl:text-[18px]">
          {t("No game scheduled")}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        {next ? (
          <>
            <PlayAction
              label={watchLabel(next, t)}
              ariaLabel={watchAria(next, t)}
              onClick={() => actions.watch(next)}
            />
            <GlassAction label={t("Game details")} onClick={() => onOpenGame(next.game)}>
              <Info size={18} />
            </GlassAction>
            <RoundAction label={t("Team page")} onClick={openTeam}>
              <Users2 size={19} />
            </RoundAction>
          </>
        ) : (
          <GlassAction label={t("Team page")} onClick={openTeam}>
            <Users2 size={18} />
          </GlassAction>
        )}
      </div>
      {profile && (
        <Suspense fallback={null}>
          <TeamProfile
            team={profile}
            onClose={() => {
              setProfile(null);
              const el = opener.current;
              window.requestAnimationFrame(
                () => el?.isConnected && el.focus({ preventScroll: true }),
              );
            }}
          />
        </Suspense>
      )}
    </>
  );
}

/** A followed team as Harbor's team page knows it, when Harbor's Sports Hub has its league. */
function harborTeam(team: JlTeamSlide["team"], side: SportsSide): TeamIdentity | null {
  const tag = leagueByKey(team.league)?.tag ?? team.league;
  if (!hubLeague(tag) || !team.id) return null;
  return { id: team.id, name: side.name || team.name, logo: side.logo || undefined, league: tag };
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

const HERO_IDLE_MS = 2500;

/**
 * Whether the hero is in use: the pointer moved over it, or focus (keyboard, remote, gamepad) is
 * inside it. Goes idle a moment after the pointer stops; focus inside keeps it awake, so the
 * remote can always reach the hero's controls.
 */
function useHeroAwake(root: RefObject<HTMLElement | null>): boolean {
  const [awake, setAwake] = useState(false);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let timer = 0;
    const focused = () => el.contains(document.activeElement);
    const wake = () => {
      setAwake(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setAwake(focused()), HERO_IDLE_MS);
    };
    const leave = () => {
      window.clearTimeout(timer);
      setAwake(focused());
    };
    const blur = (e: FocusEvent) => {
      if (!el.contains(e.relatedTarget as Node | null)) leave();
    };
    const controller = () => {
      if (focused()) wake();
    };
    el.addEventListener("pointermove", wake);
    el.addEventListener("pointerenter", wake);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("focusin", wake);
    el.addEventListener("focusout", blur);
    window.addEventListener("harbor:controller-activity", controller);
    return () => {
      window.clearTimeout(timer);
      el.removeEventListener("pointermove", wake);
      el.removeEventListener("pointerenter", wake);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("focusin", wake);
      el.removeEventListener("focusout", blur);
      window.removeEventListener("harbor:controller-activity", controller);
    };
  }, [root]);
  return awake;
}
