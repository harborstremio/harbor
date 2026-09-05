import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowLeftRight, Goal } from "lucide-react";
import { useT, useUiLanguage } from "@/lib/i18n";
import type {
  MatchEvent,
  MatchTeamStatRow,
  SportsGame,
  SportsMatchDetail,
  SportsSide,
} from "@/lib/sports/espn";
import { fetchHeadToHead, type HeadToHead as H2HResult } from "@/lib/sports/h2h";
import { fetchGameSummary } from "@/lib/sports/provider";
import { LiveBadge } from "./live-badge";
import { matchPlayerByName } from "./pitch/pitch-formation";
import { PitchView } from "./pitch/pitch-view";
import { StandingsPanel } from "./standings-panel";

function toNumber(value: string): number {
  const parsed = parseFloat((value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
}

function statLabel(t: ReturnType<typeof useT>, raw: string): string {
  switch (raw.trim().toLowerCase()) {
    case "possession":
      return t("Possession");
    case "shots":
    case "total shots":
      return t("Shots");
    case "shots on target":
    case "shots on goal":
      return t("Shots on target");
    case "corners":
    case "corner kicks":
      return t("Corners");
    case "fouls":
    case "fouls committed":
      return t("Fouls");
    case "yellow cards":
      return t("Yellow cards");
    case "red cards":
      return t("Red cards");
    case "saves":
      return t("Saves");
    case "offsides":
      return t("Offsides");
    default:
      return raw;
  }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-edge-soft" />
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
          {title}
        </span>
        <span className="h-px flex-1 bg-edge-soft" />
      </div>
      {children}
    </section>
  );
}

function ScoreSide({ side, align }: { side: SportsSide; align: "start" | "end" }) {
  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-3 ${align === "end" ? "flex-row-reverse text-end" : ""}`}
    >
      {side.logo ? (
        <img src={side.logo} alt="" className="h-9 w-9 shrink-0 object-contain" />
      ) : (
        <span className="h-9 w-9 shrink-0 rounded-full bg-canvas/60" />
      )}
      <div className="min-w-0">
        <div className={`truncate text-[15px] font-semibold ${side.winner ? "text-ink" : "text-ink-muted"}`}>
          {side.name}
        </div>
        {side.abbr && (
          <div className="text-[11px] uppercase tracking-[0.1em] text-ink-subtle">{side.abbr}</div>
        )}
      </div>
    </div>
  );
}

function Scoreboard({ detail }: { detail: SportsMatchDetail }) {
  const t = useT();
  const live = detail.state === "in";
  const scored = detail.state !== "pre";
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-elevated p-4 ring-1 ring-edge-soft">
      <div className="flex items-center gap-4">
        <ScoreSide side={detail.home} align="start" />
        <div className="flex shrink-0 items-center gap-2 text-[30px] font-bold tabular-nums text-ink">
          {scored ? (
            <>
              <span>{detail.home.score || "0"}</span>
              <span className="text-[20px] text-ink-subtle">-</span>
              <span>{detail.away.score || "0"}</span>
            </>
          ) : (
            <span className="text-[15px] font-semibold text-ink-subtle">{t("vs")}</span>
          )}
        </div>
        <ScoreSide side={detail.away} align="end" />
      </div>
      <div className="flex items-center justify-center gap-2">
        {live && <LiveBadge />}
        <span className="text-[12px] font-medium text-ink-muted">
          {detail.detail || (detail.state === "post" ? t("Full time") : t("Upcoming"))}
        </span>
      </div>
    </div>
  );
}

function StatBar({ row }: { row: MatchTeamStatRow }) {
  const t = useT();
  const home = toNumber(row.homeValue);
  const away = toNumber(row.awayValue);
  const total = home + away;
  const share = total > 0 ? (home / total) * 100 : 50;
  const homeLeads = home > away;
  const awayLeads = away > home;
  return (
    <div className="grid grid-cols-[3rem_1fr_3rem] items-center gap-3">
      <span
        className={`text-end text-[13px] font-semibold tabular-nums ${homeLeads ? "text-ink" : "text-ink-subtle"}`}
      >
        {row.homeValue || "0"}
      </span>
      <div className="flex flex-col gap-1">
        <span className="text-center text-[10.5px] uppercase tracking-[0.1em] text-ink-subtle">
          {statLabel(t, row.label)}
        </span>
        <div className="flex h-1.5 gap-px overflow-hidden rounded-full bg-canvas">
          <div
            className={`pitch-bar-grow ${homeLeads ? "bg-ink" : "bg-ink-subtle"}`}
            style={{ width: `${share}%`, "--pitch-bar-origin": "left center" } as CSSProperties}
          />
          <div
            className={`pitch-bar-grow ${awayLeads ? "bg-ink" : "bg-ink-subtle"}`}
            style={{ width: `${100 - share}%`, "--pitch-bar-origin": "right center" } as CSSProperties}
          />
        </div>
      </div>
      <span className={`text-[13px] font-semibold tabular-nums ${awayLeads ? "text-ink" : "text-ink-subtle"}`}>
        {row.awayValue || "0"}
      </span>
    </div>
  );
}

function EventIcon({ type }: { type: MatchEvent["type"] }) {
  if (type === "goal") return <Goal size={13} className="shrink-0 text-ink" />;
  if (type === "yellow_card") return <span className="pitch-card h-[13px] w-[9px] bg-yellow-400" />;
  if (type === "red_card") return <span className="pitch-card h-[13px] w-[9px] bg-danger" />;
  if (type === "substitution")
    return <ArrowLeftRight size={12} className="shrink-0 text-ink-muted" />;
  return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink-subtle" />;
}

function EventCard({ event, mirrored }: { event: MatchEvent; mirrored: boolean }) {
  return (
    <div
      className={`flex max-w-[260px] items-center gap-2 rounded-lg bg-elevated px-2.5 py-1.5 ${mirrored ? "flex-row-reverse text-end" : ""}`}
    >
      <EventIcon type={event.type} />
      <div className="min-w-0">
        <div className="truncate text-[12px] font-medium text-ink">
          {event.participantName || event.text}
        </div>
        {event.participantName && event.text && (
          <div className="truncate text-[11px] text-ink-subtle">{event.text}</div>
        )}
      </div>
    </div>
  );
}

function Timeline({ detail }: { detail: SportsMatchDetail }) {
  const sides = useMemo(
    () =>
      detail.events.map((event) => {
        const needle = `${event.participantName || ""} ${event.text || ""}`;
        if (matchPlayerByName(needle, detail.homeRoster)) return "home" as const;
        if (matchPlayerByName(needle, detail.awayRoster)) return "away" as const;
        return null;
      }),
    [detail.events, detail.homeRoster, detail.awayRoster],
  );

  return (
    <div className="relative flex flex-col gap-2 py-1">
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-edge-soft" />
      {detail.events.map((event, index) => {
        const side = sides[index];
        const minute = (
          <span className="relative z-10 flex h-[22px] min-w-[34px] items-center justify-center rounded-full bg-canvas px-1.5 text-[11px] font-semibold tabular-nums text-ink-muted ring-1 ring-inset ring-edge-soft">
            {event.time || "-"}
          </span>
        );
        if (!side) {
          return (
            <div key={`${event.id}-${index}`} className="flex flex-col items-center gap-1">
              {minute}
              <span className="text-center text-[11.5px] text-ink-subtle">{event.text}</span>
            </div>
          );
        }
        return (
          <div
            key={`${event.id}-${index}`}
            className="grid grid-cols-[1fr_auto_1fr] items-center gap-3"
          >
            <div className="flex justify-end">
              {side === "home" && <EventCard event={event} mirrored />}
            </div>
            {minute}
            <div className="flex justify-start">
              {side === "away" && <EventCard event={event} mirrored={false} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HeadToHead({ result, locale }: { result: H2HResult; locale: string }) {
  const t = useT();
  const rows: Array<{ label: string; value: string }> = [
    { label: t("Meetings"), value: String(result.played) },
    { label: result.teamA.abbr || result.teamA.name, value: String(result.aWins) },
    { label: t("Draws"), value: String(result.draws) },
    { label: result.teamB.abbr || result.teamB.name, value: String(result.bWins) },
    { label: t("Goals"), value: `${result.aScored} - ${result.bScored}` },
  ];
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-canvas/50 p-3.5">
      <div className="flex items-center gap-2 pb-1">
        {rows.map((row, index) => (
          <div key={`${row.label}-${index}`} className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
            <span className="text-[15px] font-bold tabular-nums text-ink">{row.value}</span>
            <span className="w-full truncate text-center text-[10px] uppercase tracking-[0.08em] text-ink-subtle">
              {row.label}
            </span>
          </div>
        ))}
      </div>
      {result.meetings.slice(0, 6).map((meeting) => (
        <div
          key={meeting.id}
          className="flex items-center justify-between gap-3 border-t border-edge-soft px-1 pt-2"
        >
          <span className="min-w-0 truncate text-[12px] text-ink-muted">
            {meeting.startMs > 0
              ? new Date(meeting.startMs).toLocaleDateString(locale, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : meeting.season}
          </span>
          <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-ink">
            {`${meeting.home.abbr || meeting.home.name} ${meeting.home.score} - ${meeting.away.score} ${meeting.away.abbr || meeting.away.name}`}
          </span>
        </div>
      ))}
    </div>
  );
}

export function MatchPanel({ game, detail }: { game: SportsGame; detail?: SportsMatchDetail }) {
  const t = useT();
  const locale = useUiLanguage() === "ar" ? "ar-SA" : "en-US";
  const [loaded, setLoaded] = useState<SportsMatchDetail | null>(detail ?? null);
  const [loading, setLoading] = useState(!detail);
  const [h2h, setH2h] = useState<H2HResult | null>(null);

  useEffect(() => {
    if (detail) {
      setLoaded(detail);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    fetchGameSummary(game)
      .then((result) => {
        if (!alive) return;
        setLoaded(result);
        setLoading(false);
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [game.league, game.id, game.source, detail]);

  useEffect(() => {
    let alive = true;
    setH2h(null);
    fetchHeadToHead(game.league, game.home.id, game.away.id)
      .then((result) => {
        if (alive) setH2h(result && result.played > 0 ? result : null);
      })
      .catch(() => {
        if (alive) setH2h(null);
      });
    return () => {
      alive = false;
    };
  }, [game.league, game.home.id, game.away.id]);

  if (loading) {
    return (
      <div className="flex min-h-[180px] items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-ink-subtle border-t-transparent" />
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="flex min-h-[180px] items-center justify-center text-[13px] text-ink-subtle">
        {t("Match details are not available yet.")}
      </div>
    );
  }

  const hasPitch = [...loaded.homeRoster, ...loaded.awayRoster].some((player) => player.starter);

  return (
    <div className="flex flex-col gap-6">
      <Scoreboard detail={loaded} />

      {hasPitch && (
        <Section title={t("On the pitch")}>
          <PitchView detail={loaded} />
        </Section>
      )}

      {loaded.allStats.length > 0 && (
        <Section title={t("Match stats")}>
          <div className="flex flex-col gap-3 rounded-lg bg-canvas/50 p-3.5">
            {loaded.allStats.map((row, index) => (
              <StatBar key={`${row.label}-${index}`} row={row} />
            ))}
          </div>
        </Section>
      )}

      {loaded.events.length > 0 && (
        <Section title={t("Timeline")}>
          <Timeline detail={loaded} />
        </Section>
      )}

      {h2h && (
        <Section title={t("Head to head")}>
          <HeadToHead result={h2h} locale={locale} />
        </Section>
      )}

      <StandingsPanel
        leagueTag={game.league}
        highlight={[game.home.id, game.away.id]}
        title={t("Standings")}
      />
    </div>
  );
}
