import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useT } from "@/lib/i18n";
import { liveCount, type SportsGame } from "@/lib/sports/espn";
import { FixtureRow } from "./fixture-row";
import { LiveBadge } from "./live-badge";

const HEADER_HEIGHT = 48;
const ROW_HEIGHT = 76;

export function LeagueSection({
  title,
  logo,
  games,
  nowMs,
  collapsed,
  onToggle,
  onOpen,
  renderChannels,
}: {
  title: string;
  logo?: string;
  games: SportsGame[];
  nowMs: number;
  collapsed: boolean;
  onToggle: () => void;
  onOpen: (game: SportsGame) => void;
  renderChannels?: (game: SportsGame) => ReactNode;
}) {
  const t = useT();
  const live = liveCount(games);
  const intrinsic = HEADER_HEIGHT + (collapsed ? 0 : games.length * ROW_HEIGHT);

  return (
    <section
      className="mb-5 overflow-hidden rounded-lg bg-elevated ring-1 ring-edge-soft"
      style={{ contentVisibility: "auto", containIntrinsicSize: `auto ${intrinsic}px` }}
    >
      <button
        type="button"
        aria-expanded={!collapsed}
        onClick={onToggle}
        className="group flex h-12 w-full items-center gap-2.5 bg-raised px-4 text-start text-[13.5px] font-semibold text-ink"
      >
        <LeagueCrest logo={logo} />
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {live > 0 && <LiveBadge label={t("{n} LIVE", { n: live })} />}
        <span className="shrink-0 text-[11.5px] tabular-nums text-ink-subtle transition-colors duration-150 group-hover:text-ink-muted">
          {games.length}
        </span>
        <span className="shrink-0 text-ink-subtle transition-colors duration-150 group-hover:text-ink">
          <ChevronDown
            size={14}
            strokeWidth={2.2}
            className={`transition-transform duration-150 ${collapsed ? "" : "rotate-180"}`}
          />
        </span>
      </button>

      {!collapsed &&
        games.map((game, i) => (
          <FixtureRow
            key={game.id}
            game={game}
            nowMs={nowMs}
            first={i === 0}
            channels={renderChannels?.(game)}
            onOpen={onOpen}
          />
        ))}
    </section>
  );
}

function LeagueCrest({ logo }: { logo?: string }) {
  const [err, setErr] = useState(false);
  if (!logo || err) return <span className="h-5 w-5 shrink-0 rounded-full bg-canvas/60" />;
  return (
    <img
      src={logo}
      alt=""
      draggable={false}
      loading="lazy"
      onError={() => setErr(true)}
      className="h-5 w-5 shrink-0 object-contain"
    />
  );
}
