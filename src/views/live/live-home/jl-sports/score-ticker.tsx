import { Play, Star, Trophy, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { tickerExtras, tickerStatus, tickerTeamName } from "@/lib/jl/sports/ticker";
import { visibleScore } from "@/lib/jl/sports/presentation";
import { fmtClock } from "../now-format";
import {
  setTickerDismissed,
  useScoreTicker,
  useTickerDismissed,
  useTickerOn,
  type ScoreTickerItem,
} from "./score-ticker-store";
import { useTickerScroll } from "./use-ticker-scroll";

type Translate = ReturnType<typeof useT>;

/**
 * Tickarr: the live-score crawl pinned to the very top of the window on the hubs. It is on for
 * five minutes and off for three (by the wall clock), and stays up while a live channel plays or
 * while you are hovering or focused on it. Space for it is reserved through `--harbor-top-inset`,
 * which the shell and the fixed top chrome follow, so it never covers the header.
 */
export function ScoreTickerBar() {
  const t = useT();
  const ticker = useScoreTicker();
  const dismissed = useTickerDismissed();
  const on = useTickerOn();
  const [held, setHeld] = useState(false);
  const items = ticker?.items ?? [];
  const shown = !!ticker?.bar && !dismissed && items.length > 0;
  const up = shown && (on || held || !!ticker?.watchingLive);
  const mode = up ? "bar" : ticker?.bar && dismissed ? "tab" : null;

  useEffect(() => {
    const root = document.documentElement;
    if (mode) root.dataset.scoreTicker = mode;
    else delete root.dataset.scoreTicker;
  }, [mode]);
  useEffect(() => () => void delete document.documentElement.dataset.scoreTicker, []);

  if (!ticker || (!shown && mode !== "tab")) return null;
  return (
    <div
      data-score-ticker
      className="fixed inset-x-0 top-0 z-[110] h-(--harbor-top-inset) overflow-hidden"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld(false);
      }}
    >
      {mode === "tab" ? (
        <div
          data-tauri-drag-region
          className="absolute inset-x-0 bottom-0 flex h-5 items-center justify-center"
        >
          <button
            type="button"
            onClick={() => setTickerDismissed(false)}
            aria-label={t("Show the score ticker")}
            className="flex h-4 items-center gap-1 rounded-full border border-edge-soft bg-canvas/80 px-2 text-[10px] font-semibold text-ink-muted backdrop-blur-md transition-colors hover:border-edge hover:text-ink"
          >
            <Trophy size={10} className="text-accent" />
            {t("Scores")}
          </button>
        </div>
      ) : (
        <div
          data-tauri-drag-region
          role="region"
          aria-label={t("Scores")}
          aria-hidden={!up || undefined}
          inert={!up}
          className="absolute inset-x-0 bottom-0 flex h-10 items-center gap-2 border-b border-edge-soft bg-canvas/80 ps-3 pe-1.5 backdrop-blur-md"
        >
          <span
            data-tauri-drag-region
            className="hidden shrink-0 items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent sm:flex"
          >
            <Trophy size={13} />
            {t("Scores")}
          </span>
          <TickerTrack items={items} running={up} interactive />
          <button
            type="button"
            onClick={() => setTickerDismissed(true)}
            aria-label={t("Turn off the score ticker")}
            title={t("Turn off the score ticker")}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-ink/10 hover:text-ink"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The same crawl along the top edge of a live channel playing full screen. Player shells lay out
 * their own top bar, so the crawl steps aside whenever the player's controls are showing; it is
 * display-only (selecting a game belongs to the bar on the hubs).
 */
export function ScoreTickerOverlay({ chromeVisible }: { chromeVisible: boolean }) {
  const ticker = useScoreTicker();
  const dismissed = useTickerDismissed();
  const items = ticker?.items ?? [];
  if (!ticker?.overlay || dismissed || items.length === 0) return null;
  const up = !chromeVisible;
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-x-0 top-0 z-30 flex h-10 items-center bg-black/55 px-2 text-white backdrop-blur-md transition-[transform,opacity] duration-500 motion-reduce:transition-none ${
        up ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
      }`}
    >
      <TickerTrack items={items} running={up} interactive={false} />
    </div>
  );
}

function TickerTrack({
  items,
  running,
  interactive,
}: {
  items: ScoreTickerItem[];
  running: boolean;
  interactive: boolean;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const firstSet = useRef<HTMLDivElement>(null);
  const [loop, setLoop] = useState(false);

  // Only a list wider than the window loops; a short one just sits still.
  useEffect(() => {
    const view = viewport.current;
    const set = firstSet.current;
    if (!view || !set) return;
    const measure = () => setLoop(set.offsetWidth > view.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(view);
    ro.observe(set);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (!loop && track.current) track.current.style.transform = "";
  }, [loop]);
  useTickerScroll(viewport, track, running && loop);

  const set = (copy: boolean) =>
    items.map((item) => (
      <TickerCell
        key={`${item.game.league}:${item.game.id}`}
        item={item}
        copy={copy}
        interactive={interactive}
      />
    ));
  return (
    // Laid out left to right in every language so the crawl's maths stays simple; names keep dir="auto".
    <div
      ref={viewport}
      dir="ltr"
      className={`relative min-w-0 flex-1 overflow-clip [touch-action:pan-y] ${interactive ? "cursor-grab" : ""}`}
    >
      <div ref={track} className="flex w-max will-change-transform">
        <div ref={firstSet} className="flex gap-2 pe-2">
          {set(false)}
        </div>
        {loop && <div className="flex gap-2 pe-2">{set(true)}</div>}
      </div>
      {loop && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-canvas/90 to-transparent"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-canvas/90 to-transparent"
          />
        </>
      )}
    </div>
  );
}

function TickerCell({
  item,
  copy,
  interactive,
}: {
  item: ScoreTickerItem;
  copy: boolean;
  interactive: boolean;
}) {
  const t = useT();
  const ticker = useScoreTicker();
  const { game, channels, mine } = item;
  const onNow =
    !!ticker?.playingChannelId && channels.some((c) => c.channel.id === ticker.playingChannelId);
  const body = <CellBody item={item} showOdds={!!ticker?.showOdds} t={t} />;
  const look = `flex h-7 shrink-0 items-center gap-2 rounded-full border px-3 text-[12px] ${
    onNow
      ? "border-accent/60 bg-accent-soft"
      : mine
        ? "border-accent/30 bg-canvas/40"
        : "border-edge-soft bg-canvas/40"
  }`;
  if (!interactive) {
    return (
      <span data-ticker-cell className={look}>
        {body}
      </span>
    );
  }
  const away = tickerTeamName(game.away, game.league);
  const home = tickerTeamName(game.home, game.league);
  const label = `${away} ${t("at")} ${home}`;
  return (
    <button
      type="button"
      data-ticker-cell
      tabIndex={copy ? -1 : undefined}
      aria-hidden={copy || undefined}
      aria-current={onNow || undefined}
      aria-label={
        channels.length ? t("Watch {game}", { game: label }) : `${t("Game details")}: ${label}`
      }
      draggable={false}
      onClick={() => ticker?.select(item)}
      className={`${look} text-ink transition-colors hover:border-edge hover:bg-ink/10`}
    >
      {body}
    </button>
  );
}

function CellBody({
  item,
  showOdds,
  t,
}: {
  item: ScoreTickerItem;
  showOdds: boolean;
  t: Translate;
}) {
  const { game, channels, mine } = item;
  const status = tickerStatus(game);
  const statusText =
    status.kind === "live"
      ? [t("Live"), status.detail].filter(Boolean).join(" ")
      : status.kind === "final"
        ? status.detail || t("Final")
        : fmtClock(status.startMs);
  return (
    <>
      {mine && (
        <Star size={10} fill="currentColor" strokeWidth={0} className="shrink-0 text-accent" />
      )}
      <span
        className={`flex shrink-0 items-center gap-1 text-[10.5px] font-bold uppercase tracking-[0.06em] ${
          status.kind === "live" ? "text-danger" : "text-ink-subtle"
        }`}
      >
        {status.kind === "live" && (
          <span className="h-1.5 w-1.5 rounded-full bg-danger motion-safe:animate-pulse" />
        )}
        {statusText}
      </span>
      {[game.away, game.home].map((side, i) => (
        <span key={i} className="flex shrink-0 items-center gap-1">
          {i === 1 && <span className="text-ink-subtle">·</span>}
          {side.logo && (
            <img
              src={side.logo}
              alt=""
              draggable={false}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
              className="h-4 w-4 object-contain"
            />
          )}
          {side.rank ? (
            <span className="text-[10.5px] font-bold text-accent">#{side.rank}</span>
          ) : null}
          <span dir="auto" className="font-medium">
            {tickerTeamName(side, game.league)}
          </span>
          {visibleScore(game, side) && (
            <span className="font-bold tabular-nums">{visibleScore(game, side)}</span>
          )}
        </span>
      ))}
      {tickerExtras(game, showOdds).map((extra) => (
        <span key={extra} className="shrink-0 text-ink-subtle">
          {extra}
        </span>
      ))}
      {channels.length > 0 && (
        <Play size={10} fill="currentColor" strokeWidth={0} className="shrink-0 text-accent" />
      )}
    </>
  );
}
