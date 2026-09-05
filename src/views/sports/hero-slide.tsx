import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Play } from "lucide-react";
import { useT } from "@/lib/i18n";
import { getLeagueLabel, type SportsGame, type SportsSide } from "@/lib/sports/espn";
import { sportsLeagueByTag } from "@/lib/sports/provider";
import { fmtClock } from "@/views/live/live-home/now-format";
import { LiveBadge } from "./live-badge";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

function kickoffLabel(ms: number, lang: string): string {
  if (!ms || Number.isNaN(ms)) return "";
  const d = new Date(ms);
  const time = fmtClock(ms);
  if (d.toDateString() === new Date().toDateString()) return time;
  return `${d.toLocaleDateString(lang, { weekday: "short" })} ${time}`;
}

function fmtCountdown(ms: number, t: Translate): string {
  if (ms <= 0) return t("Starting soon");
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return t("in {n}s", { n: secs });
  const mins = Math.floor(secs / 60);
  if (mins < 60) return t("in {n}m", { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    const rest = mins % 60;
    return rest ? t("in {h}h {m}m", { h: hours, m: rest }) : t("in {h}h", { h: hours });
  }
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  return rest ? t("in {d}d {h}h", { d: days, h: rest }) : t("in {d}d", { d: days });
}

function useCountdown(targetMs: number, enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const step = () => (targetMs - Date.now() < 3_600_000 ? 1000 : 30_000);
    let id = 0;
    const tick = () => {
      setNow(Date.now());
      id = window.setTimeout(tick, step());
    };
    id = window.setTimeout(tick, step());
    return () => window.clearTimeout(id);
  }, [enabled, targetMs]);
  return targetMs - now;
}

export function HeroSlide({
  game,
  lang,
  ticking,
  onOpen,
  onWatch,
}: {
  game: SportsGame;
  lang: string;
  ticking: boolean;
  onOpen: (game: SportsGame) => void;
  onWatch?: (game: SportsGame) => void;
}) {
  const t = useT();
  const def = useMemo(() => sportsLeagueByTag(game.league), [game.league]);
  const live = game.state === "in";
  const done = game.state === "post";
  const decided = done && (game.home.winner || game.away.winner);
  const competition = game.context?.name || (def ? getLeagueLabel(def) : game.league);
  const heading = [competition, game.context?.round].filter(Boolean).join(" · ");
  const venue = game.context?.venue || "";

  return (
    <>
      <Ghost src={game.away.logo} side="away" />
      <Ghost src={game.home.logo} side="home" />
      <div className="sports-hero-content">
        <div className="sports-hero-eyebrow flex min-w-0 items-center gap-2 font-semibold uppercase tracking-[0.14em] text-ink-subtle">
          <Crest src={def?.logo ?? ""} blank={false} className="h-4 w-4 shrink-0 object-contain" />
          <span className="truncate">{heading}</span>
        </div>

        <div className="sports-hero-sides">
          <Side side={game.away} showScore={live || done} dim={decided && !game.away.winner} />
          <Side side={game.home} showScore={live || done} dim={decided && !game.home.winner} />
        </div>

        <Status game={game} lang={lang} ticking={ticking} />

        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => (live && onWatch ? onWatch(game) : onOpen(game))}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-ink px-4 text-[13px] font-medium text-canvas transition-transform hover:scale-[1.01] active:scale-[0.98]"
          >
            {live && <Play size={13} fill="currentColor" />}
            {live ? t("Watch now") : done ? t("Match report") : t("Match preview")}
          </button>
          {venue && (
            <span className="flex min-w-0 items-center gap-1.5 text-[11.5px] text-ink-subtle">
              <MapPin size={12} className="shrink-0" />
              <span className="truncate">{venue}</span>
            </span>
          )}
        </div>
      </div>
    </>
  );
}

function Status({ game, lang, ticking }: { game: SportsGame; lang: string; ticking: boolean }) {
  const t = useT();
  const pre = game.state === "pre";
  const left = useCountdown(game.startMs, pre && ticking && game.startMs > 0);

  if (game.state === "in") {
    return (
      <div className="flex min-w-0 items-center gap-2.5">
        <LiveBadge />
        {game.detail && (
          <span className="truncate text-[13px] font-bold tabular-nums text-ink">{game.detail}</span>
        )}
      </div>
    );
  }

  if (game.state === "post") {
    return (
      <div className="flex min-w-0 items-center">
        <span className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-subtle">
          {game.detail || t("Final")}
        </span>
      </div>
    );
  }

  const kickoff = kickoffLabel(game.startMs, lang);
  return (
    <div className="flex min-w-0 items-baseline gap-2.5">
      {kickoff && (
        <span className="shrink-0 text-[13px] font-semibold tabular-nums text-ink-muted">{kickoff}</span>
      )}
      {game.startMs > 0 ? (
        <span className="truncate text-[15px] font-bold tabular-nums text-ink">{fmtCountdown(left, t)}</span>
      ) : (
        <span className="truncate text-[13px] font-semibold text-ink-muted">
          {game.detail || t("Upcoming")}
        </span>
      )}
    </div>
  );
}

function Side({ side, showScore, dim }: { side: SportsSide; showScore: boolean; dim: boolean }) {
  return (
    <div className="sports-hero-side">
      <Crest src={side.logo} className="sports-hero-crest" />
      <span className={`sports-hero-team truncate ${dim ? "text-ink-subtle" : "text-ink"}`}>
        {side.name || side.abbr}
      </span>
      {showScore && <Score value={side.score} dim={dim} />}
    </div>
  );
}

function Score({ value, dim }: { value: string; dim: boolean }) {
  const prev = useRef(value);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    setBump((b) => b + 1);
  }, [value]);

  return (
    <span
      key={bump}
      className={`sports-hero-score ${bump > 0 ? "sports-hero-pop" : ""} ${
        dim ? "text-ink-muted" : "text-ink"
      }`}
    >
      {value || "0"}
    </span>
  );
}

function Crest({ src, className, blank = true }: { src: string; className: string; blank?: boolean }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return blank ? <span className={`${className} shrink-0 rounded-full bg-canvas/60`} /> : null;
  }
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      loading="lazy"
      onError={() => setErr(true)}
      className={className}
    />
  );
}

function Ghost({ src, side }: { src: string; side: "away" | "home" }) {
  const [err, setErr] = useState(false);
  if (!src || err) return null;
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      loading="lazy"
      onError={() => setErr(true)}
      className={`sports-hero-ghost sports-hero-ghost-${side}`}
    />
  );
}
