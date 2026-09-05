import { useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n";
import type { SportsGame, SportsSide } from "@/lib/sports/espn";
import { fmtClock } from "@/views/live/live-home/now-format";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

function relLabel(startMs: number, nowMs: number, t: Translate): string | null {
  const diff = startMs - nowMs;
  if (diff <= 0) return null;
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return t("in {m}m", { m: Math.max(1, mins) });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("in {h}h", { h: hours });
  return t("in {d}d", { d: Math.round(hours / 24) });
}

export function FixtureRow({
  game,
  nowMs,
  first,
  channels,
  onOpen,
}: {
  game: SportsGame;
  nowMs: number;
  first: boolean;
  channels?: ReactNode;
  onOpen: (game: SportsGame) => void;
}) {
  const t = useT();
  const live = game.state === "in";
  const done = game.state === "post";

  return (
    <div
      className={`px-4 py-3.5 transition-colors duration-150 hover:bg-raised/60 ${
        first ? "" : "border-t border-edge-soft"
      }`}
    >
      <button
        type="button"
        onClick={() => onOpen(game)}
        className="flex w-full items-start gap-3 text-start"
      >
        <span className="flex w-[72px] shrink-0 flex-col gap-0.5">
          {live ? (
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-danger" />
              <span className="truncate text-[13px] font-bold tabular-nums text-ink">
                {game.detail || t("Live")}
              </span>
            </span>
          ) : done ? (
            <span className="truncate text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">
              {game.detail || t("FT")}
            </span>
          ) : (
            <>
              <span className="text-[13px] font-semibold tabular-nums text-ink">
                {game.startMs ? fmtClock(game.startMs) : t("TBD")}
              </span>
              {game.startMs ? (
                <span className="truncate text-[10.5px] uppercase tracking-[0.08em] text-ink-subtle">
                  {relLabel(game.startMs, nowMs, t) ?? game.detail}
                </span>
              ) : null}
            </>
          )}
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <TeamLine side={game.away} dim={done && !game.away.winner} showScore={live || done} />
          <TeamLine side={game.home} dim={done && !game.home.winner} showScore={live || done} />
        </span>
      </button>

      {channels ? <div className="mt-2 ps-[84px]">{channels}</div> : null}
    </div>
  );
}

function TeamLine({
  side,
  dim,
  showScore,
}: {
  side: SportsSide;
  dim: boolean;
  showScore: boolean;
}) {
  const [err, setErr] = useState(false);

  return (
    <span className="flex min-w-0 items-center gap-2.5">
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
        className={`min-w-0 flex-1 truncate text-[13.5px] font-semibold ${
          dim ? "text-ink-subtle" : "text-ink"
        }`}
      >
        {side.name || side.abbr}
      </span>
      {showScore && (
        <span
          className={`w-7 shrink-0 text-end text-[15px] font-bold tabular-nums ${
            dim ? "text-ink-subtle" : "text-ink"
          }`}
        >
          {side.score}
        </span>
      )}
    </span>
  );
}

function CompactFixture({
  game,
  onOpen,
}: {
  game: SportsGame;
  onOpen: (game: SportsGame) => void;
}) {
  const t = useT();
  const done = game.state === "post";
  const live = game.state === "in";

  return (
    <button
      type="button"
      onClick={() => onOpen(game)}
      className="flex w-full flex-col gap-1 rounded-md px-2 py-2 text-start transition-colors duration-150 hover:bg-surface"
    >
      <CompactSide side={game.away} dim={done && !game.away.winner} />
      <CompactSide side={game.home} dim={done && !game.home.winner} />
      <span className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.06em] text-ink-subtle">
        {live && <span className="h-1 w-1 shrink-0 animate-pulse rounded-full bg-danger" />}
        <span className="truncate">
          {live
            ? game.detail || t("Live")
            : game.startMs
              ? fmtClock(game.startMs)
              : game.detail}
        </span>
      </span>
    </button>
  );
}

function CompactSide({ side, dim }: { side: SportsSide; dim: boolean }) {
  return (
    <span className="flex items-baseline justify-between gap-2">
      <span
        className={`truncate text-[12px] font-semibold ${dim ? "text-ink-subtle" : "text-ink"}`}
      >
        {side.abbr || side.name}
      </span>
      {side.score ? (
        <span className="shrink-0 text-[12px] font-bold tabular-nums text-ink">{side.score}</span>
      ) : null}
    </span>
  );
}

export function FixtureRailPanel({
  title,
  games,
  action,
  onOpen,
}: {
  title: string;
  games: SportsGame[];
  action?: ReactNode;
  onOpen: (game: SportsGame) => void;
}) {
  return (
    <div className="rounded-lg bg-elevated p-3 ring-1 ring-edge-soft">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
          {title}
        </span>
        {action}
      </div>
      <div className="flex flex-col gap-0.5">
        {games.map((game) => (
          <CompactFixture key={game.id} game={game} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}
