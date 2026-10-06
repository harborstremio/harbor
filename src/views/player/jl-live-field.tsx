import { Eye, EyeOff, LayoutGrid, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import type { InsightSide, PregameInsight } from "@/lib/jl/sports/insight";
import { activeLineup, pitchRows, type FootballSituation, type PitchPlayer } from "@/lib/jl/sports/live-field";
import { useWatchingGame } from "@/lib/jl/sports/now-watching";
import { fetchFootballLive } from "@/lib/jl/sports/people";
import { fetchMatchSummary, type MatchPlayer, type SportsGame, type SportsMatchDetail } from "@/lib/sports/espn";

const POLL_MS = 20_000;
const MODE_KEY = "jl.liveField.mode";
const FOOTBALL = new Set(["NFL", "NCAAF"]);
const SOCCER_STATS = /possession|shots|on goal|on target|corner|foul/i;

type Mode = "solid" | "clear";
type LiveData =
  | { kind: "football"; game: SportsGame; situation: FootballSituation | null; insight: PregameInsight }
  | { kind: "soccer"; detail: SportsMatchDetail }
  | { kind: "none" };

function readMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === "clear" ? "clear" : "solid";
  } catch {
    return "solid";
  }
}

/**
 * The live field over a game opened from the Sports Hub. It opens by itself while the game is on,
 * and its see-through mode keeps the broadcast visible underneath.
 */
export function JlLiveField({ channelId, chromeVisible }: { channelId: string | null; chromeVisible: boolean }) {
  const t = useT();
  const game = useWatchingGame(channelId);
  const gameKey = game ? `${game.league}:${game.id}` : "";
  const [closedFor, setClosedFor] = useState<string | null>(null);
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(readMode);
  const live = useLiveData(game, !!game && closedFor !== gameKey);

  if (!game) return null;
  // The game as it was when Watch was pressed, refreshed by the live data.
  const now = live.kind === "football" ? live.game : live.kind === "soccer" ? live.detail : game;
  const open = openedFor === gameKey || (now.state === "in" && closedFor !== gameKey);

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
      className={`pointer-events-auto absolute bottom-28 end-6 z-40 flex w-[min(92vw,400px)] flex-col gap-3 rounded-2xl p-3.5 ${
        clear ? "bg-transparent text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]" : "border border-white/10 bg-black/80 text-white backdrop-blur-md"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="flex-1 truncate text-[13px] font-semibold">
          {now.away.abbr || now.away.name} {now.away.score} · {now.home.abbr || now.home.name} {now.home.score}
          <span className="ms-2 text-[11.5px] font-medium text-white/70">{now.detail}</span>
        </span>
        <button
          onClick={toggleMode}
          aria-pressed={clear}
          title={clear ? t("Solid") : t("See-through")}
          className="flex h-7 items-center gap-1 rounded-full bg-white/15 px-2.5 text-[11px] font-semibold hover:bg-white/25"
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
          className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
        >
          <X size={13} />
        </button>
      </div>
      {live.kind === "football" && (
        <>
          <FootballField situation={live.situation} clear={clear} />
          <LeadersRow insight={live.insight} />
        </>
      )}
      {live.kind === "soccer" && <SoccerLive detail={live.detail} clear={clear} />}
      {live.kind === "none" && <p className="text-[12px] text-white/70">{t("Waiting for live data…")}</p>}
    </div>
  );
}

function useLiveData(game: SportsGame | null, active: boolean): LiveData {
  const [result, setResult] = useState<{ key: string; data: LiveData } | null>(null);
  const key = game ? `${game.league}:${game.id}` : "";

  useEffect(() => {
    if (!game || !active) return;
    let controller = new AbortController();
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      controller.abort();
      controller = new AbortController();
      const signal = controller.signal;
      try {
        let data: LiveData = { kind: "none" };
        if (FOOTBALL.has(game.league)) {
          data = { kind: "football", ...(await fetchFootballLive(game, signal)) };
        } else {
          const detail = await fetchMatchSummary(game.league, game.id);
          if (detail && (detail.homeRoster.length > 0 || detail.awayRoster.length > 0)) data = { kind: "soccer", detail };
        }
        if (!signal.aborted) setResult({ key, data });
      } catch {
        /* keep the last good data; the next poll retries */
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
  }, [key, active]);

  return result?.key === key ? result.data : { kind: "none" };
}

function FootballField({ situation, clear }: { situation: FootballSituation | null; clear: boolean }) {
  const t = useT();
  if (!situation) {
    return <p className="text-[12px] text-white/70">{t("Between plays: the ball spot appears with the next snap.")}</p>;
  }
  // 100 yards plus two 10-yard end zones, drawn with the offense driving left to right.
  const x = (yard: number) => `${((yard + 10) / 120) * 100}%`;
  return (
    <div className="flex flex-col gap-2">
      <div
        className={`relative h-24 overflow-hidden rounded-lg ${clear ? "bg-emerald-900/35 ring-1 ring-white/30" : "bg-emerald-800"}`}
      >
        <div className="absolute inset-y-0 start-0 flex w-[8.333%] items-center justify-center bg-white/15 text-[10px] font-bold [writing-mode:vertical-rl]">
          {situation.offense}
        </div>
        <div className="absolute inset-y-0 end-0 flex w-[8.333%] items-center justify-center bg-white/15 text-[10px] font-bold [writing-mode:vertical-rl]">
          {situation.defense}
        </div>
        {situation.redZone && <div className="absolute inset-y-0 bg-red-500/20" style={{ left: x(80), width: `${(20 / 120) * 100}%` }} />}
        {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((yd) => (
          <div key={yd} className="absolute inset-y-0 w-px bg-white/25" style={{ left: x(yd) }}>
            <span className="absolute bottom-0.5 -translate-x-1/2 text-[8.5px] text-white/60">{yd > 50 ? 100 - yd : yd}</span>
          </div>
        ))}
        <div className="absolute inset-y-0 w-0.5 bg-sky-400" style={{ left: x(situation.ballYard) }} />
        {situation.firstDownYard != null && (
          <div className="absolute inset-y-0 w-0.5 bg-yellow-300" style={{ left: x(situation.firstDownYard) }} />
        )}
        <div
          className="absolute top-1/2 h-3 w-5 -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-amber-700 ring-1 ring-white/70"
          style={{ left: x(situation.ballYard) }}
        />
      </div>
      {situation.downText && <span className="text-[13px] font-semibold">{situation.downText}</span>}
      {situation.lastPlay && <span className="text-[12px] leading-snug text-white/80">{situation.lastPlay}</span>}
    </div>
  );
}

function LeadersRow({ insight }: { insight: PregameInsight }) {
  const sides = [insight.away, insight.home].filter((s): s is InsightSide => !!s && s.leaders.length > 0);
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

function toPitch(p: MatchPlayer): PitchPlayer {
  return {
    id: p.id,
    name: p.name,
    jersey: p.jersey,
    position: p.position,
    starter: p.starter,
    substitutedIn: p.substitutedIn ?? false,
    substitutedOut: p.substitutedOut ?? false,
    goals: p.goals,
    yellowCards: p.yellowCards,
    redCards: p.redCards,
  };
}

function SoccerLive({ detail, clear }: { detail: SportsMatchDetail; clear: boolean }) {
  const home = pitchRows(activeLineup(detail.homeRoster.map(toPitch)), detail.homeFormation ?? "");
  const away = pitchRows(activeLineup(detail.awayRoster.map(toPitch)), detail.awayFormation ?? "");
  const stats = detail.allStats.filter((s) => SOCCER_STATS.test(s.label)).slice(0, 4);
  return (
    <div className="flex flex-col gap-2">
      {/* One pitch, home attacking up from the bottom, away attacking down from the top. */}
      <div
        className={`relative flex aspect-[3/4] max-h-[360px] flex-col justify-between overflow-hidden rounded-lg py-2 ${
          clear ? "bg-emerald-900/30 ring-1 ring-white/30" : "bg-[#2b4c30]"
        }`}
      >
        <div className="pointer-events-none absolute inset-x-2 top-1/2 h-px bg-white/30" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30" />
        {away.map((row, i) => (
          <PitchRow key={`a${i}`} players={row} home={false} />
        ))}
        {[...home].reverse().map((row, i) => (
          <PitchRow key={`h${i}`} players={row} home />
        ))}
      </div>
      {stats.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center justify-between text-[11.5px]">
              <span className="w-10 font-semibold tabular-nums">{s.homeValue}</span>
              <span className="flex-1 truncate text-center text-white/70">{s.label}</span>
              <span className="w-10 text-end font-semibold tabular-nums">{s.awayValue}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PitchRow({ players, home }: { players: PitchPlayer[]; home: boolean }) {
  return (
    <div className="relative z-10 flex justify-around px-2">
      {players.map((p) => (
        <div key={p.id} className="flex flex-col items-center gap-0.5" title={p.name}>
          <span
            className={`relative flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ring-1 ring-black/40 ${
              home ? "bg-sky-500 text-white" : "bg-white text-black"
            }`}
          >
            {p.jersey || "·"}
            {p.goals > 0 && (
              <span className="absolute -end-1.5 -top-1.5 rounded-full bg-black px-1 text-[8.5px] leading-[14px] text-white">
                ⚽{p.goals > 1 ? p.goals : ""}
              </span>
            )}
            {p.yellowCards > 0 && <span className="absolute -start-1 -top-1 h-2.5 w-2 rounded-[1px] bg-yellow-300" />}
          </span>
          <span className="max-w-[56px] truncate text-[9px] font-semibold">{p.name.split(" ").pop()}</span>
        </div>
      ))}
    </div>
  );
}
