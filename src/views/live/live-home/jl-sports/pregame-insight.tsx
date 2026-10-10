import { AlertTriangle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import type { JlFavoritePlayer } from "@/lib/jl/sports/favorites";
import { followedInjuries, type InsightSide, type PlayerLine, type PregameInsight } from "@/lib/jl/sports/insight";
import { fetchPlayerLine, fetchPregameInsight } from "@/lib/jl/sports/people";
import type { SportsGame } from "@/lib/sports/espn";

type Loaded = { insight: PregameInsight; lines: PlayerLine[] };

/** Followed players taking part in this game, by their team. */
export function playersInGame(game: SportsGame, players: JlFavoritePlayer[]): JlFavoritePlayer[] {
  const ids = new Set([game.home.id, game.away.id].filter(Boolean));
  return players.filter((p) => p.league === game.league && p.teamId && ids.has(p.teamId));
}

export function PregameInsightView({
  game,
  players,
  compact = false,
}: {
  game: SportsGame;
  players: JlFavoritePlayer[];
  compact?: boolean;
}) {
  const t = useT();
  const mine = playersInGame(game, players);
  const requestKey = `${game.league}:${game.id}:${mine.map((p) => p.id).join(",")}`;
  const [result, setResult] = useState<{ key: string; data: Loaded | null } | null>(null);
  const current = result?.key === requestKey ? result : null;

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetchPregameInsight(game, controller.signal),
      Promise.all(mine.map((p) => fetchPlayerLine(p, controller.signal).catch(() => null))),
    ])
      .then(([insight, lines]) => {
        if (controller.signal.aborted) return;
        setResult({ key: requestKey, data: { insight, lines: lines.filter((l): l is PlayerLine => !!l) } });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ key: requestKey, data: null });
      });
    return () => controller.abort();
    // requestKey captures the game and the followed players in it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const data = current?.data ?? null;
  if (current && !data) {
    return <p className="text-[12.5px] text-ink-subtle">{t("Pre-game insight is unavailable right now.")}</p>;
  }
  if (!data) return <Loader2 size={16} className="animate-spin text-ink-subtle" />;

  const injuries = followedInjuries(data.insight, mine);
  const sides = [data.insight.away, data.insight.home].filter((s): s is InsightSide => !!s);
  return (
    <div className="flex flex-col gap-3">
      {injuries.map((i) => (
        <p key={i.athlete} className="flex items-center gap-1.5 text-[12.5px] text-amber-300">
          <AlertTriangle size={13} />
          {t("{player}: {status}", { player: i.athlete, status: i.status })}
        </p>
      ))}
      <div className={`grid gap-3 ${compact ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
        {sides.map((s) => (
          <div key={s.teamId} className="flex flex-col gap-1 rounded-xl bg-canvas/50 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] font-bold text-ink">{s.abbr}</span>
              <span className="text-[11.5px] text-ink-subtle">
                {[s.record, s.winChance != null ? t("{n}% to win", { n: s.winChance }) : null].filter(Boolean).join(" · ")}
              </span>
            </div>
            {s.leaders.slice(0, compact ? 2 : 3).map((l) => (
              <span key={l.category} className="truncate text-[12px] text-ink-muted">
                <span className="text-ink-subtle">{l.category}:</span> {l.athlete} · {l.value}
              </span>
            ))}
          </div>
        ))}
      </div>
      {data.lines.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">{t("Your players")}</h4>
          {data.lines.map((line) => (
            <span key={line.name} className="text-[12.5px] text-ink-muted">
              <span className="font-semibold text-ink">{line.name}</span>
              {line.stats.length > 0 ? ` · ${line.stats.map((s) => `${s.label} ${s.value}`).join(" · ")}` : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
