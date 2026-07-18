import { useState } from "react";
import { useT, useUiLanguage } from "@/lib/i18n";
import type { SportsGame, SportsSide } from "@/lib/sports/espn";
import { fmtClock } from "../now-format";

function startLabel(
  ms: number,
  locale: string,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  if (!ms || isNaN(ms)) return t("TBD");
  const d = new Date(ms);
  const now = new Date();
  const time = fmtClock(ms);
  if (d.toDateString() === now.toDateString()) return time;
  const dateStr = d.toLocaleDateString(locale, { month: "short", day: "numeric" });
  return `${dateStr} ${time}`;
}

import { SportsHoverPreview } from "./sports-hover-preview";

export function SportsCard({
  game,
  onSelect,
}: {
  game: SportsGame;
  onSelect: (g: SportsGame) => void;
}) {
  const finalGame = game.state === "post";
  const live = game.state === "in";
  const hasScores =
    (game.home.score && game.home.score !== "0") || (game.away.score && game.away.score !== "0");
  const showWinIndicator = finalGame && !hasScores && (game.home.winner || game.away.winner);

  return (
    <SportsHoverPreview game={game} onSelect={() => onSelect(game)}>
      <button
        type="button"
        className="flex h-24 w-[260px] shrink-0 flex-col justify-between rounded-xl border border-edge-soft/55 bg-elevated p-3 text-start transition-colors duration-150 hover:border-edge"
      >
        <div className="flex items-center justify-between">
          <Status game={game} />
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-subtle">
            {game.league}
          </span>
        </div>
        <SideRow
          side={game.away}
          active={live || finalGame}
          dim={finalGame && !game.away.winner}
          showWinner={showWinIndicator}
        />
        <SideRow
          side={game.home}
          active={live || finalGame}
          dim={finalGame && !game.home.winner}
          showWinner={showWinIndicator}
        />
      </button>
    </SportsHoverPreview>
  );
}

function SideRow({
  side,
  active,
  dim,
  showWinner,
}: {
  side: SportsSide;
  active: boolean;
  dim: boolean;
  showWinner?: boolean;
}) {
  const t = useT();
  const [err, setErr] = useState(false);
  const hasScore = side.score && side.score !== "" && side.score !== "0";
  const isPositionScore = hasScore && /^\d+(st|nd|rd|th)$/.test(side.score);

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
      <span
        className={`flex-1 truncate text-[13px] font-bold uppercase tracking-[0.02em] ${dim ? "text-ink-subtle" : "text-ink"}`}
      >
        {side.abbr || side.name}
      </span>
      {showWinner && side.winner && !hasScore ? (
        <span className="flex h-5 items-center rounded bg-success/20 px-2 text-[10px] font-bold uppercase tracking-wider text-success">
          {t("WIN")}
        </span>
      ) : (
        <span
          className={`${isPositionScore ? "w-auto px-1" : "w-9"} shrink-0 text-end text-[${isPositionScore ? "13" : "20"}px] font-bold ${isPositionScore ? "tracking-tight" : "tabular-nums"} ${
            active ? (dim ? "text-ink-muted" : "text-ink") : "text-ink-subtle"
          }`}
        >
          {side.score}
        </span>
      )}
    </div>
  );
}

function Status({ game }: { game: SportsGame }) {
  const t = useT();
  const lang = useUiLanguage();
  const locale = lang === "ar" ? "ar-SA" : "en-US";

  if (game.state === "in") {
    return (
      <span className="flex h-[18px] items-center gap-1 rounded bg-danger px-1.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-white">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
        {game.detail || t("Live")}
      </span>
    );
  }

  if (game.state === "post") {
    return (
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
        {game.detail || t("Final")}
      </span>
    );
  }

  const label = game.startMs ? startLabel(game.startMs, locale, t) : game.detail || t("Upcoming");

  return (
    <span className="flex h-[18px] items-center gap-1.5 rounded border border-edge-soft/60 px-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">
      <span className="h-1.5 w-1.5 rounded-full bg-ink-subtle/60" />
      {label}
    </span>
  );
}
