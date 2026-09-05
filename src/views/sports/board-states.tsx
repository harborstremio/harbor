import { CalendarDays, KeyRound } from "lucide-react";
import { useT } from "@/lib/i18n";
import { getLeagueLabel, type LeagueDef, type SportsGame } from "@/lib/sports/espn";
import { FixtureRailPanel } from "./fixture-row";

export function SideRail({
  games,
  onOpen,
}: {
  games: SportsGame[];
  onOpen: (game: SportsGame) => void;
}) {
  const t = useT();
  const live = games.filter((g) => g.state === "in").slice(0, 8);
  const soon = games.filter((g) => g.state === "pre" && g.startMs > 0).slice(0, 6);
  if (live.length === 0 && soon.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {live.length > 0 && (
        <FixtureRailPanel title={t("Live now")} games={live} onOpen={onOpen} />
      )}
      {soon.length > 0 && (
        <FixtureRailPanel title={t("Starting soon")} games={soon} onOpen={onOpen} />
      )}
    </div>
  );
}

export function SectionDivider({ label }: { label: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="h-px flex-1 bg-edge-soft" />
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
        {label}
      </span>
      <span className="h-px flex-1 bg-edge-soft" />
    </div>
  );
}

export function EmptyDay({ showToday, onToday }: { showToday: boolean; onToday: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg bg-elevated px-6 py-14 ring-1 ring-edge-soft">
      <CalendarDays size={22} strokeWidth={1.8} className="text-ink-subtle" />
      <span className="text-[13px] text-ink-muted">{t("No fixtures on this day.")}</span>
      {showToday && (
        <button
          type="button"
          onClick={onToday}
          className="inline-flex h-10 items-center rounded-lg bg-raised px-4 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink"
        >
          {t("Jump to today")}
        </button>
      )}
    </div>
  );
}

export function LockedLeaguesNote({
  leagues,
  onConnect,
}: {
  leagues: LeagueDef[];
  onConnect: () => void;
}) {
  const t = useT();
  if (leagues.length === 0) return null;
  const names = leagues.map(getLeagueLabel).join(" · ");
  return (
    <div className="animate-item-in mt-5 flex items-center gap-3 rounded-lg bg-elevated px-4 py-3 ring-1 ring-edge-soft">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-canvas text-ink-subtle">
        <KeyRound size={14} strokeWidth={2} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[12.5px] font-medium text-ink">{names}</span>
        <span className="text-[11.5px] leading-snug text-ink-subtle">
          {t("Needs an API-Sports key. The free plan covers it.")}
        </span>
      </span>
      <button
        type="button"
        onClick={onConnect}
        className="inline-flex h-9 shrink-0 items-center rounded-lg bg-ink px-3.5 text-[12.5px] font-medium text-canvas transition-transform hover:scale-[1.01] active:scale-[0.98]"
      >
        {t("Add key")}
      </button>
    </div>
  );
}
