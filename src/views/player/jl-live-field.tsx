import { ArrowLeftRight, Crosshair, Eye, EyeOff, Flag, LayoutGrid, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import type { InsightSide, PregameInsight } from "@/lib/jl/sports/insight";
import {
  activeLineup,
  fieldX,
  pitchRows,
  yardsFromOwnGoal,
  type FootballSituation,
  type PitchPlayer,
} from "@/lib/jl/sports/live-field";
import { useWatchingGame } from "@/lib/jl/sports/now-watching";
import { visibleScore } from "@/lib/jl/sports/presentation";
import { fetchFootballLive } from "@/lib/jl/sports/people";
import { fetchSoccerLive } from "@/lib/jl/sports/soccer-fetch";
import type {
  SoccerEvent,
  SoccerEventKind,
  SoccerLive,
  SoccerPair,
} from "@/lib/jl/sports/soccer-live";
import { LEAGUES, type SportsGame } from "@/lib/sports/espn";

// Polled often so the delayed view below moves in small steps.
const POLL_MS = 8_000;
const DELAY_STEP_SEC = 15;
const MAX_DELAY_SEC = 180;
const MODE_KEY = "jl.liveField.mode";

type Mode = "solid" | "clear";
type FieldSport = "football" | "soccer";
type LiveData =
  | {
      kind: "football";
      game: SportsGame;
      situation: FootballSituation | null;
      insight: PregameInsight;
    }
  | { kind: "soccer"; game: SportsGame; live: SoccerLive }
  | { kind: "none" };

/** Which field a game gets, from its league: gridiron for NFL and college, a pitch for soccer. */
function fieldSport(league: string): FieldSport | null {
  const group = LEAGUES.find((l) => l.tag === league || l.key === league)?.group;
  return group === "football" || group === "soccer" ? group : null;
}

function readMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === "clear" ? "clear" : "solid";
  } catch {
    return "solid";
  }
}

/**
 * The live field over a game opened from the Sports Hub. It opens by itself while the game is on,
 * and its see-through mode keeps the broadcast visible underneath and lets clicks reach the player.
 */
export function JlLiveField({
  channelId,
  chromeVisible,
}: {
  channelId: string | null;
  chromeVisible: boolean;
}) {
  const t = useT();
  const watching = useWatchingGame(channelId);
  const sport = watching ? fieldSport(watching.league) : null;
  const game = sport ? watching : null;
  const gameKey = game ? `${game.league}:${game.id}` : "";
  const [closedFor, setClosedFor] = useState<string | null>(null);
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(readMode);
  const { settings, update } = useSettings();
  // Streams run behind live; the field waits this long so its plays line up with the picture.
  const delaySec = Math.min(MAX_DELAY_SEC, Math.max(0, Math.round(settings.sportsFieldDelaySec)));
  const setDelay = (sec: number) =>
    update({ sportsFieldDelaySec: Math.min(MAX_DELAY_SEC, Math.max(0, sec)) });
  const feed = useLiveData(game, sport, !!game && closedFor !== gameKey, delaySec * 1000);
  const live = feed.data;

  if (!game) return null;
  // The game as it was when Watch was pressed, refreshed by the live data.
  const now = live.kind === "none" ? game : live.game;
  const open = openedFor === gameKey || (now.state === "in" && closedFor !== gameKey);
  const colors =
    live.kind === "soccer"
      ? { home: live.live.home.color, away: live.live.away.color }
      : live.kind === "football" && live.situation
        ? live.situation.offenseIsHome
          ? { home: live.situation.offenseColor, away: live.situation.defenseColor }
          : { home: live.situation.defenseColor, away: live.situation.offenseColor }
        : null;

  const toggleMode = () => {
    const next: Mode = mode === "solid" ? "clear" : "solid";
    setMode(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      /* the choice lasts for this session */
    }
  };

  if (!open) {
    if (!chromeVisible) return null;
    return (
      <button
        onClick={() => {
          setOpenedFor(gameKey);
          setClosedFor(null);
        }}
        className="pointer-events-auto absolute end-6 top-20 z-40 flex h-9 items-center gap-1.5 rounded-full bg-black/60 px-3.5 text-[12.5px] font-semibold text-white backdrop-blur hover:bg-black/75"
      >
        <LayoutGrid size={14} />
        {t("Live field")}
      </button>
    );
  }

  const clear = mode === "clear";
  return (
    <div
      className={`absolute bottom-28 end-6 z-40 flex max-h-[calc(100%-15rem)] w-[min(92vw,400px)] flex-col gap-3 overflow-y-auto rounded-2xl p-3.5 text-white ${
        clear
          ? "pointer-events-none bg-transparent [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]"
          : "pointer-events-auto border border-white/10 bg-black/80 backdrop-blur-md"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="flex flex-1 items-center gap-1.5 truncate text-[13px] font-semibold">
          {colors && <TeamDot color={colors.away} />}
          {now.away.abbr || now.away.name} {visibleScore(now, now.away)}
          <span className="text-white/50">·</span>
          {colors && <TeamDot color={colors.home} />}
          {now.home.abbr || now.home.name} {visibleScore(now, now.home)}
          <span className="ms-1 truncate text-[11.5px] font-medium text-white/70">
            {now.detail}
          </span>
        </span>
        <span
          className="pointer-events-auto flex h-7 items-center rounded-full bg-white/15 text-[11px] font-semibold"
          title={t("Delay the field to match your stream")}
        >
          <button
            onClick={() => setDelay(delaySec - DELAY_STEP_SEC)}
            disabled={delaySec === 0}
            aria-label={t("Less delay")}
            className="flex h-7 w-6 items-center justify-center rounded-s-full hover:bg-white/25 disabled:opacity-40"
          >
            −
          </button>
          <span className="px-1 tabular-nums">{t("Delay {n}s", { n: delaySec })}</span>
          <button
            onClick={() => setDelay(delaySec + DELAY_STEP_SEC)}
            disabled={delaySec >= MAX_DELAY_SEC}
            aria-label={t("More delay")}
            className="flex h-7 w-6 items-center justify-center rounded-e-full hover:bg-white/25 disabled:opacity-40"
          >
            +
          </button>
        </span>
        <button
          onClick={toggleMode}
          aria-pressed={clear}
          title={clear ? t("Solid") : t("See-through")}
          className="pointer-events-auto flex h-7 items-center gap-1 rounded-full bg-white/15 px-2.5 text-[11px] font-semibold hover:bg-white/25"
        >
          {clear ? <EyeOff size={12} /> : <Eye size={12} />}
          {clear ? t("Solid") : t("See-through")}
        </button>
        <button
          onClick={() => {
            setClosedFor(gameKey);
            setOpenedFor(null);
          }}
          aria-label={t("Close")}
          className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
        >
          <X size={13} />
        </button>
      </div>
      {feed.failed && (
        <p role="status" className="text-[12px] text-white/80">
          {t("Live updates are unavailable. Retrying.")}
          {feed.at > 0 &&
            ` ${t("Last update")} ${new Date(feed.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
        </p>
      )}
      {live.kind === "football" && (
        <>
          <FootballField situation={live.situation} clear={clear} />
          <LeadersRow insight={live.insight} />
        </>
      )}
      {live.kind === "soccer" && <SoccerLiveView live={live.live} clear={clear} />}
      {live.kind === "none" && !feed.failed && (
        <p className="text-[12px] text-white/70">
          {feed.syncing ? t("Lining up with your stream…") : t("Waiting for live data…")}
        </p>
      )}
    </div>
  );
}

type LiveFeed = {
  data: LiveData;
  at: number;
  failed: boolean;
  /** Data has arrived but is still being held back to match the stream delay. */
  syncing?: boolean;
};

/**
 * The live data, held back by `delayMs` so it lines up with a stream running behind live: every
 * answer is queued with its arrival time and shown once it is `delayMs` old. Failures show at
 * once; only the data waits.
 */
function useLiveData(
  game: SportsGame | null,
  sport: FieldSport | null,
  active: boolean,
  delayMs: number,
): LiveFeed {
  const latest = useLatestLiveData(game, sport, active);
  const key = game ? `${game.league}:${game.id}` : "";
  const [queue, setQueue] = useState<{ key: string; items: LiveFeed[] }>({ key: "", items: [] });
  const [, setTick] = useState(0);

  useEffect(() => {
    if (latest.at === 0 || latest.failed) return;
    setQueue((q) => {
      const items = q.key === key ? q.items : [];
      if (items[items.length - 1]?.at === latest.at) return q;
      // Enough history for the longest delay.
      const keepFrom = latest.at - MAX_DELAY_SEC * 1000 - POLL_MS;
      return { key, items: [...items.filter((i) => i.at >= keepFrom), latest] };
    });
  }, [key, latest]);

  useEffect(() => {
    if (!active || delayMs === 0) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [active, delayMs]);

  if (latest.failed) return latest;
  if (delayMs === 0) return latest;
  const items = queue.key === key ? queue.items : [];
  const due = Date.now() - delayMs;
  let shown: LiveFeed | null = null;
  for (const item of items) if (item.at <= due) shown = item;
  if (shown) return shown;
  return { data: { kind: "none" }, at: 0, failed: false, syncing: items.length > 0 };
}

function useLatestLiveData(
  game: SportsGame | null,
  sport: FieldSport | null,
  active: boolean,
): LiveFeed {
  const [result, setResult] = useState<(LiveFeed & { key: string }) | null>(null);
  const key = game ? `${game.league}:${game.id}` : "";

  useEffect(() => {
    if (!game || !sport || !active) return;
    let controller = new AbortController();
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      controller.abort();
      controller = new AbortController();
      const signal = controller.signal;
      try {
        let data: LiveData = { kind: "none" };
        if (sport === "football") {
          data = { kind: "football", ...(await fetchFootballLive(game, signal)) };
        } else {
          const live = await fetchSoccerLive(game, signal);
          if (live) data = { kind: "soccer", game: soccerGame(game, live), live };
        }
        if (!signal.aborted) setResult({ key, data, at: Date.now(), failed: data.kind === "none" });
      } catch {
        if (!signal.aborted)
          setResult((previous) => ({
            key,
            data: previous?.key === key ? previous.data : { kind: "none" },
            at: previous?.key === key ? previous.at : 0,
            failed: true,
          }));
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => {
      window.clearInterval(timer);
      controller.abort();
    };
    // The game identity decides what is polled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, sport, active]);

  return result?.key === key ? result : { data: { kind: "none" }, at: 0, failed: false };
}

function soccerGame(game: SportsGame, live: SoccerLive): SportsGame {
  return {
    ...game,
    savedAt: undefined,
    state: live.state,
    detail: live.clock || game.detail,
    home: { ...game.home, score: live.home.score || game.home.score },
    away: { ...game.away, score: live.away.score || game.away.score },
  };
}

function TeamDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/40"
      style={{ backgroundColor: color }}
    />
  );
}

/** Percent across a 120-yard drawing: the away end zone, 100 yards, the home end zone. */
const gx = (displayYard: number) => `${((displayYard + 10) / 120) * 100}%`;

function FootballField({
  situation,
  clear,
}: {
  situation: FootballSituation | null;
  clear: boolean;
}) {
  const t = useT();
  if (!situation) {
    return (
      <p className="text-[12px] text-white/70">
        {t("Between plays: the ball spot appears with the next snap.")}
      </p>
    );
  }
  const s = situation;
  const homeAbbr = s.offenseIsHome ? s.offense : s.defense;
  const awayAbbr = s.offenseIsHome ? s.defense : s.offense;
  const homeColor = s.offenseIsHome ? s.offenseColor : s.defenseColor;
  const awayColor = s.offenseIsHome ? s.defenseColor : s.offenseColor;
  const ball = fieldX(s.ballYard, s.offenseIsHome);
  const firstDown = s.firstDownYard != null ? fieldX(s.firstDownYard, s.offenseIsHome) : null;
  const redZone = [fieldX(80, s.offenseIsHome), fieldX(100, s.offenseIsHome)].sort((a, b) => a - b);
  const startYard = s.driveStart ? yardsFromOwnGoal(s.driveStart, s.offense, s.defense) : null;
  const driveFrom =
    startYard != null && startYard <= s.ballYard ? fieldX(startYard, s.offenseIsHome) : null;
  const toRight = !s.offenseIsHome;
  return (
    <div className="flex flex-col gap-2">
      <div
        className={`relative h-24 overflow-hidden rounded-lg ${
          clear ? "bg-emerald-900/35 ring-1 ring-white/30" : "bg-emerald-800"
        }`}
      >
        <EndZone side="start" abbr={awayAbbr} color={awayColor} />
        <EndZone side="end" abbr={homeAbbr} color={homeColor} />
        {s.redZone && (
          <div
            className="absolute inset-y-0 bg-red-500/20"
            style={{ left: gx(redZone[0]), width: `${((redZone[1] - redZone[0]) / 120) * 100}%` }}
          />
        )}
        {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((yd) => (
          <div key={yd} className="absolute inset-y-0 w-px bg-white/25" style={{ left: gx(yd) }}>
            <span className="absolute bottom-0.5 -translate-x-1/2 text-[8.5px] text-white/60">
              {yd > 50 ? 100 - yd : yd}
            </span>
          </div>
        ))}
        {driveFrom != null && driveFrom !== ball && (
          <div
            className="absolute top-[42%] h-[16%] rounded-sm opacity-45"
            style={{
              left: gx(Math.min(driveFrom, ball)),
              width: `${(Math.abs(ball - driveFrom) / 120) * 100}%`,
              backgroundColor: s.offenseColor,
            }}
          />
        )}
        <div className="absolute inset-y-0 w-0.5 bg-sky-400" style={{ left: gx(ball) }} />
        {firstDown != null && (
          <div className="absolute inset-y-0 w-0.5 bg-yellow-300" style={{ left: gx(firstDown) }} />
        )}
        <div
          className="absolute top-1/2 h-3 w-5 -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-amber-700 ring-1 ring-white/70"
          style={{ left: gx(ball) }}
        />
        {/* Possession arrow: points the way the offense is driving. */}
        <div
          className="absolute top-[22%] -translate-x-1/2 -translate-y-1/2 text-[13px] leading-none"
          style={{ left: `calc(${gx(ball)} ${toRight ? "+" : "-"} 14px)`, color: s.offenseColor }}
        >
          {toRight ? "▶" : "◀"}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold"
          style={{ boxShadow: `inset 3px 0 0 ${s.offenseColor}` }}
        >
          {s.offense} {t("ball")}
        </span>
        {s.downText && <span className="text-[13px] font-semibold">{s.downText}</span>}
        {s.redZone && (
          <span className="rounded-full bg-red-500/80 px-2 py-0.5 text-[10.5px] font-bold uppercase">
            {t("Red zone")}
          </span>
        )}
      </div>
      {(s.drive || s.previousDrive) && (
        <span className="text-[11.5px] text-white/75">
          {s.drive
            ? `${t("Drive")}: ${s.drive}${s.driveStart ? ` · ${t("from {spot}", { spot: s.driveStart })}` : ""}`
            : `${t("Last drive")}: ${s.previousDrive}`}
        </span>
      )}
      {s.lastPlay && <span className="text-[12px] leading-snug text-white/80">{s.lastPlay}</span>}
      {s.timeouts && (
        <span className="text-[11px] text-white/60">
          {t("Timeouts")}: {awayAbbr} {s.timeouts.away} · {homeAbbr} {s.timeouts.home}
        </span>
      )}
    </div>
  );
}

function EndZone({ side, abbr, color }: { side: "start" | "end"; abbr: string; color: string }) {
  return (
    <div
      className={`absolute inset-y-0 ${side === "start" ? "left-0" : "right-0"} flex w-[8.333%] items-center justify-center text-[10px] font-bold [writing-mode:vertical-rl]`}
      style={{ backgroundColor: `${color}59` }}
    >
      {abbr}
    </div>
  );
}

function LeadersRow({ insight }: { insight: PregameInsight }) {
  const sides = [insight.away, insight.home].filter(
    (s): s is InsightSide => !!s && s.leaders.length > 0,
  );
  if (sides.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      {sides.map((s) => (
        <div key={s.teamId} className="flex flex-col gap-0.5">
          <span className="text-[11px] font-bold">{s.abbr}</span>
          {s.leaders.slice(0, 3).map((l) => (
            <span key={l.category} className="truncate text-[11px] text-white/80">
              {l.athlete} · {l.value}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

const KIND_LABEL: Record<SoccerEventKind, string> = {
  goal: "Goal",
  own_goal: "Own goal",
  penalty_goal: "Penalty goal",
  yellow: "Yellow card",
  red: "Red card",
  sub: "Substitution",
  corner: "Corner",
  shot_on_target: "Shot on target",
  shot: "Shot",
  foul: "Foul",
  offside: "Offside",
  period: "",
  other: "",
};

function SoccerLiveView({ live, clear }: { live: SoccerLive; clear: boolean }) {
  const t = useT();
  const [tab, setTab] = useState<"pitch" | "lineups">("pitch");
  const hasLineups = live.homeRoster.length > 0 || live.awayRoster.length > 0;
  const view = hasLineups ? tab : "pitch";
  const feed = live.events.filter((e) => KIND_LABEL[e.kind] && e !== live.lastKey).slice(0, 4);
  return (
    <div className="flex flex-col gap-2.5">
      {hasLineups && (
        <div className="pointer-events-auto flex gap-1 self-start rounded-full bg-white/10 p-0.5">
          {(["pitch", "lineups"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setTab(v)}
              aria-pressed={view === v}
              className={`h-6 rounded-full px-2.5 text-[11px] font-semibold ${
                view === v ? "bg-white/25" : "hover:bg-white/15"
              }`}
            >
              {v === "pitch" ? t("Pitch") : t("Lineups")}
            </button>
          ))}
        </div>
      )}
      {view === "lineups" ? (
        <SoccerLineups live={live} clear={clear} />
      ) : (
        <>
          <SoccerPitch live={live} clear={clear} />
          {live.possession && (
            <ShareBar
              label={t("Possession")}
              pair={live.possession}
              live={live}
              format={(n) => `${Math.round(n)}%`}
            />
          )}
          {live.momentum != null && <MomentumBar live={live} value={live.momentum} />}
          <div className="flex flex-col gap-0.5">
            <StatRow label={t("Shots")} pair={live.shots} />
            <StatRow label={t("On target")} pair={live.shotsOnTarget} />
            <StatRow label={t("Corners")} pair={live.corners} />
          </div>
          {live.lastKey && <EventCard event={live.lastKey} live={live} highlight />}
          <Scorers live={live} />
          {feed.length > 0 && (
            <div className="flex flex-col gap-1">
              {feed.map((e) => (
                <EventCard key={e.id} event={e} live={live} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// FIFA pitch proportions in metres.
const PL = 105;
const PW = 68;

function SoccerPitch({ live, clear }: { live: SoccerLive; clear: boolean }) {
  const t = useT();
  const e = live.lastSpot;
  const color = e?.side ? live[e.side].color : "#ffffff";
  const line = { fill: "none", stroke: "rgba(255,255,255,0.5)", strokeWidth: 0.4 } as const;
  const box = (x: number, w: number, h: number) => (
    <rect x={x} y={(PW - h) / 2} width={w} height={h} {...line} />
  );
  return (
    <div className="flex flex-col gap-1">
      <svg
        viewBox={`-2 -2 ${PL + 4} ${PW + 4}`}
        className={`w-full rounded-lg ${clear ? "bg-emerald-900/30 ring-1 ring-white/30" : "bg-[#2b4c30]"}`}
        role="img"
        aria-label={t("Pitch")}
      >
        {!clear &&
          Array.from({ length: 7 }, (_, i) => (
            <rect
              key={i}
              x={(i * PL) / 7}
              y={0}
              width={PL / 7}
              height={PW}
              fill={i % 2 ? "rgba(255,255,255,0.03)" : "transparent"}
            />
          ))}
        <rect x={0} y={0} width={PL} height={PW} {...line} />
        <line x1={PL / 2} y1={0} x2={PL / 2} y2={PW} {...line} />
        <circle cx={PL / 2} cy={PW / 2} r={9.15} {...line} />
        <circle cx={PL / 2} cy={PW / 2} r={0.5} fill="rgba(255,255,255,0.6)" />
        {box(0, 16.5, 40.32)}
        {box(PL - 16.5, 16.5, 40.32)}
        {box(0, 5.5, 18.32)}
        {box(PL - 5.5, 5.5, 18.32)}
        {box(-1.6, 1.6, 7.32)}
        {box(PL, 1.6, 7.32)}
        <circle cx={11} cy={PW / 2} r={0.4} fill="rgba(255,255,255,0.6)" />
        <circle cx={PL - 11} cy={PW / 2} r={0.4} fill="rgba(255,255,255,0.6)" />
        {e?.spot && (
          <g>
            {e.end && (
              <line
                x1={e.spot.x * PL}
                y1={e.spot.y * PW}
                x2={e.end.x * PL}
                y2={e.end.y * PW}
                stroke={color}
                strokeWidth={0.6}
                strokeDasharray="1.5 1"
              />
            )}
            <circle
              cx={e.spot.x * PL}
              cy={e.spot.y * PW}
              r={2}
              fill="none"
              stroke={color}
              strokeWidth={0.5}
            >
              <animate attributeName="r" values="2;5;2" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0;1" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle
              cx={e.spot.x * PL}
              cy={e.spot.y * PW}
              r={1.8}
              fill={color}
              stroke="rgba(0,0,0,0.6)"
              strokeWidth={0.4}
            />
          </g>
        )}
      </svg>
      {/* Schematic orientation: ESPN does not say which end each team defends on the broadcast. */}
      <div className="flex items-center justify-between text-[10.5px] font-semibold text-white/75">
        <span className="flex items-center gap-1">
          <TeamDot color={live.home.color} />
          {live.home.abbr} →
        </span>
        {e?.spot && (
          <span className="truncate px-2 text-white/60">
            {e.minute} {t(KIND_LABEL[e.kind] || "Latest")}
          </span>
        )}
        <span className="flex items-center gap-1">
          ← {live.away.abbr}
          <TeamDot color={live.away.color} />
        </span>
      </div>
    </div>
  );
}

function ShareBar({
  label,
  pair,
  live,
  format,
}: {
  label: string;
  pair: SoccerPair;
  live: SoccerLive;
  format: (n: number) => string;
}) {
  const total = pair.home + pair.away;
  const home = total > 0 ? (pair.home / total) * 100 : 50;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[11px]">
        <span className="font-semibold tabular-nums">{format(pair.home)}</span>
        <span className="text-white/70">{label}</span>
        <span className="font-semibold tabular-nums">{format(pair.away)}</span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-white/10">
        <div style={{ width: `${home}%`, backgroundColor: live.home.color }} />
        <div className="flex-1" style={{ backgroundColor: live.away.color }} />
      </div>
    </div>
  );
}

function MomentumBar({ live, value }: { live: SoccerLive; value: number }) {
  const t = useT();
  const width = Math.abs(value) * 50;
  const color = value >= 0 ? live.home.color : live.away.color;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-center text-[11px] text-white/70">{t("Momentum (last 15 min)")}</span>
      <div className="relative h-1.5 rounded-full bg-white/10">
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/40" />
        <div
          className="absolute inset-y-0 rounded-full"
          style={{
            backgroundColor: color,
            width: `${width}%`,
            left: value >= 0 ? `${50 - width}%` : "50%",
          }}
        />
      </div>
    </div>
  );
}

function StatRow({ label, pair }: { label: string; pair: SoccerPair | null }) {
  if (!pair) return null;
  return (
    <div className="flex items-center justify-between text-[11.5px]">
      <span className="w-10 font-semibold tabular-nums">{pair.home}</span>
      <span className="flex-1 truncate text-center text-white/70">{label}</span>
      <span className="w-10 text-end font-semibold tabular-nums">{pair.away}</span>
    </div>
  );
}

function EventGlyph({ kind }: { kind: SoccerEventKind }) {
  if (kind === "goal" || kind === "own_goal" || kind === "penalty_goal")
    return <span className="text-[12px] leading-none">⚽</span>;
  if (kind === "yellow" || kind === "red")
    return (
      <span
        className={`inline-block h-3 w-2 rounded-[1px] ${kind === "yellow" ? "bg-yellow-300" : "bg-red-500"}`}
      />
    );
  if (kind === "sub") return <ArrowLeftRight size={12} />;
  if (kind === "corner") return <Flag size={12} />;
  if (kind === "shot" || kind === "shot_on_target") return <Crosshair size={12} />;
  return <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/60" />;
}

function EventCard({
  event,
  live,
  highlight = false,
}: {
  event: SoccerEvent;
  live: SoccerLive;
  highlight?: boolean;
}) {
  const t = useT();
  const team = event.side ? live[event.side] : null;
  return (
    <div
      className={`flex items-start gap-2 rounded-md px-2 py-1 ${highlight ? "bg-white/10" : ""}`}
      style={{ boxShadow: team ? `inset 3px 0 0 ${team.color}` : undefined }}
    >
      <span className="w-9 shrink-0 text-[11px] font-semibold tabular-nums text-white/70">
        {event.minute}
      </span>
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        <EventGlyph kind={event.kind} />
      </span>
      <span
        className={`min-w-0 flex-1 leading-snug ${highlight ? "text-[12px]" : "text-[11px] text-white/80"}`}
      >
        <span className="font-semibold">
          {t(KIND_LABEL[event.kind] || "Latest")}
          {team ? ` · ${team.abbr}` : ""}
        </span>
        {(event.player || event.text) && (
          <span className={`block ${highlight ? "" : "truncate"} text-white/75`}>
            {event.player ?? event.text}
          </span>
        )}
      </span>
    </div>
  );
}

function Scorers({ live }: { live: SoccerLive }) {
  const t = useT();
  if (live.scorers.length === 0) return null;
  const column = (side: "home" | "away") =>
    live.scorers
      .filter((s) => s.side === side)
      .map((s, i) => (
        <span key={`${side}${i}`} className="truncate text-[11px] text-white/85">
          {s.player.split(" ").pop()} {s.minute}
          {s.penalty ? ` (${t("pen")})` : ""}
          {s.ownGoal ? ` (${t("OG")})` : ""}
        </span>
      ));
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
      <div className="flex flex-col gap-0.5">{column("home")}</div>
      <div className="flex flex-col items-end gap-0.5">{column("away")}</div>
    </div>
  );
}

function toLineup(roster: PitchPlayer[], formation: string | null) {
  return pitchRows(activeLineup(roster), formation ?? "");
}

function SoccerLineups({ live, clear }: { live: SoccerLive; clear: boolean }) {
  const home = toLineup(live.homeRoster, live.homeFormation);
  const away = toLineup(live.awayRoster, live.awayFormation);
  return (
    // One pitch, home attacking up from the bottom, away attacking down from the top.
    <div
      className={`relative flex aspect-[3/4] max-h-[360px] flex-col justify-between overflow-hidden rounded-lg py-2 ${
        clear ? "bg-emerald-900/30 ring-1 ring-white/30" : "bg-[#2b4c30]"
      }`}
    >
      <div className="pointer-events-none absolute inset-x-2 top-1/2 h-px bg-white/30" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30" />
      {away.map((row, i) => (
        <PitchRow key={`a${i}`} players={row} color={live.away.color} />
      ))}
      {[...home].reverse().map((row, i) => (
        <PitchRow key={`h${i}`} players={row} color={live.home.color} />
      ))}
    </div>
  );
}

function PitchRow({ players, color }: { players: PitchPlayer[]; color: string }) {
  return (
    <div className="relative z-10 flex justify-around px-2">
      {players.map((p) => (
        <div key={p.id} className="flex flex-col items-center gap-0.5" title={p.name}>
          <span
            className="relative flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white ring-1 ring-black/40 [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]"
            style={{ backgroundColor: color }}
          >
            {p.jersey || "·"}
            {p.goals > 0 && (
              <span className="absolute -end-1.5 -top-1.5 rounded-full bg-black px-1 text-[8.5px] leading-[14px] text-white">
                ⚽{p.goals > 1 ? p.goals : ""}
              </span>
            )}
            {p.yellowCards > 0 && (
              <span className="absolute -start-1 -top-1 h-2.5 w-2 rounded-[1px] bg-yellow-300" />
            )}
          </span>
          <span className="max-w-[56px] truncate text-[9px] font-semibold">
            {p.name.split(" ").pop()}
          </span>
        </div>
      ))}
    </div>
  );
}
