import { ChevronLeft, ChevronRight, Info, Play, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";
import {
  gameKey,
  storyGames,
  storySlides,
  type StorySlide,
  type StorySummary,
} from "@/lib/jl/sports/game-story";
import { artKey, curatedArtSlot, useCuratedArtVersion } from "@/lib/jl/sports/curated-art";
import { stableIndex } from "@/lib/jl/sports/fanart";
import { isFollowing, useJlSportsFavorites } from "@/lib/jl/sports/favorites";
import { isFavoriteGame, type JlFavoriteTeam } from "@/lib/jl/sports/rank";
import { teamLook } from "@/lib/jl/sports/team-look";
import { brandLook } from "@/lib/jl/sports/vision";
import { isCurrentLiveGame } from "@/lib/jl/sports/presentation";
import { useSportsSessionScope } from "@/lib/jl/sports/session-scope";
import { fetchStorySummary } from "@/lib/jl/sports/story-feed";
import type { SportsGame, SportsSide } from "@/lib/sports/espn";
import type { GameChannel } from "@/lib/jl/sports/channels";
import { TeamMark } from "./game-backdrop";
import { statusText } from "./jl-sports-hub";
import type { JlHubGame } from "./use-jl-sports";
import { useTeamArt } from "./use-sports-extras";

const ADVANCE_MS = 8000;
const LIVE_REFRESH_MS = 20_000;

// Games that were in the Top 10 at any point this session keep their story after the final.
const seenTopKeys = new Set<string>();
let seenTopScope = "";

// Stories opened this session lose their highlight ring, as on a phone's stories row.
const SEEN_KEY = "jl.sports.storiesSeen.v1";
let seenStories: ReadonlySet<string> = (() => {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : null;
    return new Set(Array.isArray(list) ? list.filter((k) => typeof k === "string") : []);
  } catch {
    return new Set<string>();
  }
})();
const seenListeners = new Set<() => void>();
function markStorySeen(key: string): void {
  if (seenStories.has(key)) return;
  seenStories = new Set([...seenStories, key]);
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seenStories].slice(-200)));
  } catch {
    /* the memory copy still works */
  }
  for (const fn of seenListeners) fn();
}
function useSeenStories(): ReadonlySet<string> {
  return useSyncExternalStore(
    (fn) => {
      seenListeners.add(fn);
      return () => {
        seenListeners.delete(fn);
      };
    },
    () => seenStories,
    () => seenStories,
  );
}

/** Story bubbles for the Sports Hub, from the games it already polls. */
export function useGameStories(params: {
  games: SportsGame[];
  top: JlHubGame[];
  favorites: JlFavoriteTeam[];
  channelsFor: (game: SportsGame) => GameChannel[];
  nowMs: number;
}): JlHubGame[] {
  const { games, top, favorites, channelsFor, nowMs } = params;
  const scope = useSportsSessionScope();
  return useMemo(() => {
    if (seenTopScope !== scope) {
      seenTopKeys.clear();
      seenTopScope = scope;
    }
    for (const r of top) seenTopKeys.add(gameKey(r.game));
    return storyGames(games, { favorites, bigKeys: seenTopKeys, now: new Date(nowMs) }).map(
      (game) => ({
        game,
        score: 0,
        reasons: [],
        mine: isFavoriteGame(game, favorites),
        channels: channelsFor(game),
      }),
    );
  }, [games, top, favorites, channelsFor, nowMs, scope]);
}

export function GameStoriesRow({
  stories,
  onWatch,
  onOpenGame,
  aside,
}: {
  stories: JlHubGame[];
  onWatch: (item: JlHubGame) => void;
  onOpenGame: (game: SportsGame) => void;
  /** Shown at the end of the heading row (the Sports page's shortcuts). */
  aside?: ReactNode;
}) {
  const t = useT();
  const scope = useSportsSessionScope();
  const seen = useSeenStories();
  const [selection, setSelection] = useState<{ scope: string; key: string } | null>(null);
  const openKey = selection?.scope === scope ? selection.key : null;
  const opener = useRef<HTMLElement | null>(null);
  const index = openKey ? stories.findIndex((s) => gameKey(s.game) === openKey) : -1;

  useEffect(() => {
    if (openKey && index >= 0) markStorySeen(openKey);
  }, [openKey, index]);

  const close = useCallback(() => {
    setSelection(null);
    // Back on the bubble the story was opened from, for remotes.
    const el = opener.current;
    window.requestAnimationFrame(() => el?.isConnected && el.focus());
  }, []);

  if (!stories.length && !aside) return null;
  return (
    <section aria-label={t("Game Stories")} className="flex flex-col gap-3 ps-[9px]">
      <div className="flex flex-wrap items-center gap-3 pe-[9px]">
        {stories.length > 0 && (
          <h2 className="text-[20px] font-bold text-ink 2xl:text-[24px]">{t("Game Stories")}</h2>
        )}
        {aside && <div className="ms-auto flex flex-wrap items-center gap-2">{aside}</div>}
      </div>
      {stories.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-1 pe-[9px] pt-1 2xl:gap-6">
          {stories.map((item) => (
            <StoryBubble
              key={gameKey(item.game)}
              item={item}
              seen={seen.has(gameKey(item.game))}
              onOpen={(el) => {
                opener.current = el;
                setSelection({ scope, key: gameKey(item.game) });
              }}
            />
          ))}
        </div>
      )}
      {index >= 0 &&
        createPortal(
          <StoryViewer
            stories={stories}
            index={index}
            onIndex={(i) => setSelection({ scope, key: gameKey(stories[i].game) })}
            onClose={close}
            onWatch={(item) => {
              close();
              onWatch(item);
            }}
            onOpenGame={(game) => {
              close();
              onOpenGame(game);
            }}
          />,
          document.body,
        )}
    </section>
  );
}

/**
 * A story as a round photo of the team it's about (the followed side, else home): the owner's
 * story art (or a crop of their hero), else the team's TheSportsDB photo, else its logo. The
 * ring is lit until the story is opened; red while the game is live.
 */
function StoryBubble({
  item,
  seen,
  onOpen,
}: {
  item: JlHubGame;
  seen: boolean;
  onOpen: (el: HTMLElement) => void;
}) {
  const t = useT();
  const followed = useJlSportsFavorites();
  useCuratedArtVersion();
  const { game } = item;
  const side =
    game.away.id && isFollowing(followed, game.league, game.away.id) ? game.away : game.home;
  const art = useTeamArt(game.league, side);
  const live = isCurrentLiveGame(game);
  const owner = side.id ? curatedArtSlot(artKey.team(game.league, side.id), "story") : null;
  const photos = [
    owner?.url,
    art?.fanart.length ? art.fanart[stableIndex(side.id || side.name, art.fanart.length)] : null,
  ].filter((u): u is string => !!u);
  const [failed, setFailed] = useState<string[]>([]);
  const photo = photos.find((u) => !failed.includes(u));
  const status =
    game.savedAt !== undefined || game.state !== "post"
      ? statusText(game, t)
      : t("Final {away}–{home}", { away: game.away.score, home: game.home.score });
  const ring = live
    ? "bg-danger"
    : seen
      ? "bg-ink/20"
      : "bg-[conic-gradient(from_200deg,var(--color-accent),#ffd23f,var(--color-accent))]";
  return (
    <button
      onClick={(e) => onOpen(e.currentTarget)}
      aria-label={`${game.away.name} ${t("at")} ${game.home.name}: ${status}`}
      className="group flex w-[clamp(96px,7.4vw,140px)] shrink-0 flex-col items-center gap-2 rounded-2xl p-1 text-center"
    >
      <span
        className={`relative flex aspect-square w-full items-center justify-center rounded-full p-[4px] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.8)] transition-transform group-hover:scale-105 group-focus-visible:scale-105 ${ring}`}
      >
        <span className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full border-[3px] border-canvas bg-elevated">
          {photo ? (
            <img
              key={photo}
              src={photo}
              alt=""
              draggable={false}
              loading="lazy"
              onError={() => setFailed((f) => [...f, photo])}
              className={`h-full w-full object-cover ${
                photo === owner?.url && owner.borrowed ? "object-[74%_35%]" : "object-center"
              }`}
            />
          ) : (
            <TeamMark
              look={teamLook(side, art, brandLook(game.league, side.id))}
              className="h-[62%] w-[62%]"
              textClass="text-[22px]"
            />
          )}
        </span>
        {live && (
          <span className="absolute -bottom-1 start-1/2 -translate-x-1/2 rounded bg-danger px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em] text-white rtl:translate-x-1/2">
            {t("Live")}
          </span>
        )}
      </span>
      <span className="w-full truncate text-[14px] font-semibold text-ink 2xl:text-[16px]">
        {side.location || side.name}
      </span>
    </button>
  );
}

/** The game's ESPN summary, re-read while it is live. Null until (or unless) it arrives. */
function useStorySummary(game: SportsGame): StorySummary | null {
  const key = gameKey(game);
  const [result, setResult] = useState<{ key: string; summary: StorySummary | null }>({
    key: "",
    summary: null,
  });
  const live = isCurrentLiveGame(game);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchStorySummary(game).then((summary) => {
        if (alive) setResult({ key, summary });
      });
    void load();
    const timer = live ? window.setInterval(() => void load(), LIVE_REFRESH_MS) : 0;
    return () => {
      alive = false;
      if (timer) window.clearInterval(timer);
    };
    // The game's identity and phase decide the request; score updates come with the refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, live]);
  return result.key === key ? result.summary : null;
}

/**
 * Full-screen story: slides advance on their own, Left/Right (or a tap on either side) skip,
 * Down reaches the actions, Back closes. The scoreboard stays on screen throughout.
 */
function StoryViewer({
  stories,
  index,
  onIndex,
  onClose,
  onWatch,
  onOpenGame,
}: {
  stories: JlHubGame[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  onWatch: (item: JlHubGame) => void;
  onOpenGame: (game: SportsGame) => void;
}) {
  const t = useT();
  const item = stories[index];
  const { game } = item;
  const summary = useStorySummary(game);
  const slides = useMemo(() => storySlides(game, summary), [game, summary]);
  // The slide belongs to the game it was picked on: a new game starts at its first slide.
  const [picked, setPicked] = useState({ index, slide: 0 });
  const slide = picked.index === index ? picked.slide : 0;
  const [paused, setPaused] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const at = Math.min(slide, slides.length - 1);
  const current = slides[at];

  const next = useCallback(() => {
    if (at < slides.length - 1) setPicked({ index, slide: at + 1 });
    else if (index < stories.length - 1) onIndex(index + 1);
    else onClose();
  }, [at, slides.length, index, stories.length, onIndex, onClose]);
  const prev = useCallback(() => {
    if (at > 0) setPicked({ index, slide: at - 1 });
    else if (index > 0) onIndex(index - 1);
  }, [at, index, onIndex]);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || paused) return;
    const timer = window.setTimeout(next, ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [paused, next, current?.key, index]);

  // Opened: focus the story itself (not a button), and close on Escape even with the mouse in use.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => stageRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey, true);
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey, true);
      root.style.overflow = overflow;
    };
  }, []);

  // The stage is a locally managed control (tablist): arrows here move slides, not focus.
  const onStageKey = (e: ReactKeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      next();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      prev();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      actionsRef.current?.querySelector<HTMLElement>("button")?.focus();
    }
  };

  const away = summary?.colors.away ?? "#1e293b";
  const home = summary?.colors.home ?? "#111827";
  const live = isCurrentLiveGame(game);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("Game story: {away} at {home}", { away: game.away.name, home: game.home.name })}
      data-tv-focus-scope
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="fixed inset-0 z-[80] overflow-hidden bg-canvas text-ink"
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-60"
        style={{
          background: `radial-gradient(90% 90% at 0% 0%, ${away}cc, transparent 62%), radial-gradient(90% 90% at 100% 100%, ${home}cc, transparent 62%)`,
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-canvas/40 via-canvas/20 to-canvas/80"
      />

      <div className="absolute inset-x-0 top-0 z-30 px-6 pt-5 md:px-12">
        <div className="flex gap-1.5">
          {slides.map((s, i) => (
            <span key={s.key} className="h-1 flex-1 overflow-hidden rounded-full bg-ink/20">
              <span
                className={`block h-full bg-ink transition-[width] duration-300 ${i <= at ? "w-full" : "w-0"} ${i === at ? "opacity-70" : ""}`}
              />
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.14em]">
          <span className="rounded bg-elevated/80 px-2 py-1 text-ink-muted">{game.league}</span>
          {live && <span className="rounded bg-danger px-2 py-1 text-white">{t("Live")}</span>}
          {current && <span className="text-ink-muted">{t(current.label)}</span>}
          <span className="ms-auto text-ink-subtle">
            {t("Game {n} of {total}", { n: index + 1, total: stories.length })}
          </span>
          <button
            onClick={onClose}
            data-tv-modal-close
            aria-label={t("Close")}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-elevated/80 text-ink hover:bg-raised"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="relative z-10 grid h-full grid-rows-[auto_minmax(0,1fr)] gap-6 px-6 pb-24 pt-28 md:px-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:grid-rows-1 lg:gap-12">
        <aside className="flex flex-col justify-center gap-6">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <StoryTeam side={game.away} showScore={game.state !== "pre"} />
            <span className="text-[18px] font-bold text-ink-subtle">
              {game.state === "pre" ? t("at") : "–"}
            </span>
            <StoryTeam side={game.home} showScore={game.state !== "pre"} />
          </div>
          <p
            className={`text-center text-[13px] font-semibold uppercase tracking-[0.14em] ${live ? "text-danger" : "text-ink-muted"}`}
          >
            {[statusText(game, t), game.network].filter(Boolean).join(" · ")}
          </p>
          <div ref={actionsRef} className="flex flex-wrap justify-center gap-2">
            {live && (
              <button
                onClick={() => onWatch(item)}
                className="flex h-11 items-center gap-2 rounded-full bg-ink px-6 text-[14px] font-semibold text-canvas hover:opacity-90"
              >
                <Play size={14} fill="currentColor" strokeWidth={0} />
                {item.channels.length > 0 ? t("Watch") : t("Ways to watch")}
              </button>
            )}
            <button
              onClick={() => onOpenGame(game)}
              className="flex h-11 items-center gap-2 rounded-full border border-edge bg-elevated/70 px-5 text-[14px] font-semibold text-ink hover:bg-raised"
            >
              <Info size={14} />
              {t("Game details")}
            </button>
          </div>
        </aside>

        <section className="relative min-h-0">
          <div
            ref={stageRef}
            role="tablist"
            tabIndex={0}
            data-tv-initial-focus
            aria-label={t("Story slides")}
            onKeyDown={onStageKey}
            onFocus={() => setPaused(false)}
            className="relative flex h-full flex-col justify-center rounded-3xl outline-none"
          >
            <button
              type="button"
              tabIndex={-1}
              aria-label={t("Previous")}
              onClick={prev}
              className="absolute inset-y-0 start-0 z-10 w-1/4"
            />
            <button
              type="button"
              tabIndex={-1}
              aria-label={t("Next")}
              onClick={next}
              className="absolute inset-y-0 end-0 z-10 w-3/4"
            />
            {current && (
              <div
                key={`${index}:${current.key}`}
                className="animate-fade-in pointer-events-none relative z-0"
              >
                <SlideBody slide={current} game={game} />
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="absolute inset-x-0 bottom-6 z-30 flex items-center justify-center gap-2">
        <button
          onClick={() => index > 0 && onIndex(index - 1)}
          disabled={index === 0}
          className="rounded-full bg-elevated/80 px-4 py-2 text-[12.5px] font-semibold text-ink-muted hover:text-ink disabled:opacity-40"
        >
          {t("Previous game")}
        </button>
        <button
          onClick={prev}
          aria-label={t("Previous")}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-elevated/80 text-ink hover:bg-raised"
        >
          <ChevronLeft size={18} className="dir-icon" />
        </button>
        <button
          onClick={next}
          aria-label={t("Next")}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-elevated/80 text-ink hover:bg-raised"
        >
          <ChevronRight size={18} className="dir-icon" />
        </button>
        <button
          onClick={() => index < stories.length - 1 && onIndex(index + 1)}
          disabled={index >= stories.length - 1}
          className="rounded-full bg-elevated/80 px-4 py-2 text-[12.5px] font-semibold text-ink-muted hover:text-ink disabled:opacity-40"
        >
          {t("Next game")}
        </button>
      </div>
    </div>
  );
}

function StoryTeam({ side, showScore }: { side: SportsSide; showScore: boolean }) {
  const [err, setErr] = useState(false);
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
      {side.logo && !err ? (
        <img
          src={side.logo}
          alt=""
          draggable={false}
          onError={() => setErr(true)}
          className="h-20 w-20 object-contain drop-shadow-xl lg:h-28 lg:w-28"
        />
      ) : (
        <span className="h-20 w-20 rounded-full bg-elevated lg:h-28 lg:w-28" />
      )}
      <span className="max-w-full truncate text-[15px] font-semibold text-ink lg:text-[18px]">
        {side.rank ? <span className="me-1 text-ink-subtle">#{side.rank}</span> : null}
        {side.location || side.name}
      </span>
      {showScore && (
        <span className="text-[44px] font-bold tabular-nums leading-none text-ink lg:text-[60px]">
          {side.score}
        </span>
      )}
    </div>
  );
}

const CARD = "rounded-3xl border border-edge-soft/50 bg-elevated/70 p-6 backdrop-blur-md lg:p-8";

function SlideBody({ slide, game }: { slide: StorySlide; game: SportsGame }) {
  const t = useT();
  const sideOf = (s: "home" | "away" | null) => (s ? game[s] : null);
  switch (slide.kind) {
    case "story":
      return (
        <article className={CARD}>
          <h3 className="mb-4 font-display text-[28px] font-medium leading-tight text-ink lg:text-[40px]">
            {slide.headline}
          </h3>
          {slide.paragraphs.map((p) => (
            <p key={p} className="mb-3 text-[16px] leading-relaxed text-ink-muted lg:text-[18px]">
              {p}
            </p>
          ))}
        </article>
      );
    case "plays":
      return (
        <div className={CARD}>
          <h3 className="mb-4 text-[20px] font-semibold text-ink">{t(slide.label)}</h3>
          <ol className="flex flex-col gap-2">
            {slide.plays.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-2xl bg-canvas/50 px-4 py-2.5"
              >
                <MiniLogo side={sideOf(p.side)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] text-ink">
                    <span className="font-semibold">{p.kind}</span> · {p.text}
                  </span>
                  <span className="text-[12px] text-ink-subtle">
                    {[p.period, p.clock].filter(Boolean).join(" ")}
                  </span>
                </span>
                {p.away != null && p.home != null && (
                  <span className="text-[18px] font-bold tabular-nums text-ink">
                    {p.away}–{p.home}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      );
    case "leaders":
      return (
        <div className={CARD}>
          <h3 className="mb-4 text-[20px] font-semibold text-ink">{t(slide.label)}</h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {slide.leaders.map((l) => (
              <li
                key={`${l.side}:${l.category}:${l.athlete}`}
                className="flex items-center gap-3 rounded-2xl bg-canvas/50 p-3.5"
              >
                <MiniLogo side={game[l.side]} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-ink">
                    {l.athlete}
                  </span>
                  <span className="block truncate text-[12.5px] text-ink-muted">
                    {l.category} · {l.value}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      );
    case "periods":
    case "stats":
      return (
        <div className={CARD}>
          <h3 className="mb-3 grid grid-cols-[1fr_auto_1fr] text-[16px] font-semibold text-ink">
            <span className="truncate">{game.away.abbr || game.away.name}</span>
            <span className="text-ink-subtle">{t(slide.label)}</span>
            <span className="truncate text-end">{game.home.abbr || game.home.name}</span>
          </h3>
          <dl className="divide-y divide-edge-soft/40">
            {slide.rows.map((r) => (
              <div
                key={r.label}
                className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2 text-[15px]"
              >
                <dd className="font-semibold tabular-nums text-ink">{r.away}</dd>
                <dt className="text-center text-[12.5px] text-ink-subtle">{r.label}</dt>
                <dd className="text-end font-semibold tabular-nums text-ink">{r.home}</dd>
              </div>
            ))}
          </dl>
        </div>
      );
  }
}

function MiniLogo({ side }: { side: SportsSide | null }) {
  const [err, setErr] = useState(false);
  if (!side?.logo || err) return <span className="h-8 w-8 shrink-0 rounded-full bg-canvas/60" />;
  return (
    <img
      src={side.logo}
      alt=""
      draggable={false}
      onError={() => setErr(true)}
      className="h-8 w-8 shrink-0 object-contain"
    />
  );
}
