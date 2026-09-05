import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import {
  fetchStandings,
  findStandingsRow,
  rowStat,
  type StandingsGroup,
  type StandingsRow,
  type StandingsTable,
} from "@/lib/sports/standings";

type Translate = (key: string) => string;

type Column = {
  key: string;
  names: readonly string[];
  label: string;
  strong?: boolean;
  wide?: boolean;
};

function atoms(t: Translate) {
  return {
    P: { key: "played", names: ["gamesPlayed"], label: t("P") },
    GP: { key: "played", names: ["gamesPlayed"], label: t("GP") },
    M: { key: "played", names: ["matchesPlayed"], label: t("M") },
    W: { key: "wins", names: ["wins", "gamesWon", "matchesWon"], label: t("W") },
    D: { key: "draws", names: ["ties", "gamesDrawn", "tiegames"], label: t("D") },
    T: { key: "draws", names: ["ties"], label: t("T") },
    L: { key: "losses", names: ["losses", "gamesLost", "matchesLost"], label: t("L") },
    OTL: { key: "otl", names: ["otLosses", "overtimeLosses", "OTLosses"], label: t("OTL") },
    NR: { key: "nr", names: ["noresult"], label: t("NR") },
    GD: { key: "diff", names: ["pointDifferential"], label: t("GD") },
    PD: { key: "diff", names: ["pointsDifference", "pointDifferential"], label: t("PD") },
    PCT: { key: "pct", names: ["winPercent"], label: t("PCT"), wide: true },
    PER: { key: "pct", names: ["percentage"], label: t("%"), wide: true },
    NRR: { key: "nrr", names: ["netrr"], label: t("NRR"), wide: true },
    GB: { key: "gb", names: ["gamesBehind"], label: t("GB") },
    PTS: {
      key: "points",
      names: ["points", "matchPoints", "championshipPts"],
      label: t("PTS"),
      strong: true,
    },
  };
}

function headerSet(t: Translate, sport: string): Column[] {
  const c = atoms(t);
  switch (sport) {
    case "basketball":
    case "baseball":
      return [c.W, c.L, c.PCT, c.GB];
    case "football":
      return [c.W, c.L, c.T, c.PCT];
    case "hockey":
      return [c.GP, c.W, c.L, c.OTL, c.PTS];
    case "lacrosse":
      return [c.W, c.L, c.PCT];
    case "aussie":
      return [c.P, c.W, c.L, c.D, c.PER, c.PTS];
    case "rugby":
      return [c.P, c.W, c.D, c.L, c.PD, c.PTS];
    case "cricket":
      return [c.M, c.W, c.L, c.NR, c.NRR, c.PTS];
    case "motorsport":
      return [c.PTS];
    default:
      return [c.P, c.W, c.D, c.L, c.GD, c.PTS];
  }
}

function usedColumns(columns: Column[], rows: StandingsRow[]) {
  return columns.filter((col) => rows.some((row) => rowStat(row, col.names) !== ""));
}

function Crest({ logo }: { logo: string }) {
  const [failed, setFailed] = useState(false);
  if (!logo || failed) return <span className="h-5 w-5 shrink-0 rounded-full bg-canvas/60" />;
  return (
    <img
      src={logo}
      alt=""
      draggable={false}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-5 w-5 shrink-0 object-contain"
    />
  );
}

function GroupTabs({
  groups,
  selected,
  onSelect,
}: {
  groups: StandingsGroup[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {groups.map((group) => (
        <button
          key={group.id}
          type="button"
          onClick={() => onSelect(group.id)}
          className={`flex h-8 shrink-0 items-center rounded-full border px-3 text-[12px] font-medium transition-colors ${
            group.id === selected
              ? "border-transparent bg-ink text-canvas"
              : "border-edge-soft/60 bg-elevated text-ink-muted hover:border-edge hover:text-ink"
          }`}
        >
          {group.name}
        </button>
      ))}
    </div>
  );
}

function Table({
  group,
  columns,
  highlight,
}: {
  group: StandingsGroup;
  columns: Column[];
  highlight: Set<string>;
}) {
  const t = useT();
  const shown = usedColumns(columns, group.rows);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = box.current;
    const marked = host?.querySelector<HTMLElement>("[data-standings-mark]");
    if (!host || !marked) return;
    host.scrollTop = Math.max(0, marked.offsetTop - host.clientHeight / 2 + marked.offsetHeight / 2);
  }, [group]);

  return (
    <div
      ref={box}
      className="relative max-h-[420px] overflow-y-auto rounded-lg bg-canvas/50 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex items-center gap-2 border-b border-edge-soft px-3 py-2">
        <span className="w-6 shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-subtle">
          {t("#")}
        </span>
        <span className="min-w-0 flex-1" />
        {shown.map((col) => (
          <span
            key={col.key}
            className={`${col.wide ? "w-12" : "w-8"} shrink-0 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-subtle`}
          >
            {col.label}
          </span>
        ))}
      </div>
      {group.rows.map((row) => {
        const marked = highlight.has(row.teamId);
        return (
          <div
            key={row.teamId || `${row.rank}-${row.name}`}
            data-standings-mark={marked ? "" : undefined}
            className={`flex items-center gap-2 border-t border-edge-soft/60 px-3 py-2 first:border-t-0 ${
              marked ? "bg-surface" : ""
            }`}
          >
            <span
              className={`w-6 shrink-0 text-[12px] font-semibold tabular-nums ${
                marked ? "text-ink" : "text-ink-subtle"
              }`}
            >
              {row.rank}
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-2.5">
              <Crest logo={row.logo} />
              <span
                className={`truncate text-[12.5px] ${
                  marked ? "font-semibold text-ink" : "text-ink-muted"
                }`}
              >
                {row.shortName || row.name}
              </span>
            </span>
            {shown.map((col) => (
              <span
                key={col.key}
                dir="ltr"
                className={`${col.wide ? "w-12" : "w-8"} shrink-0 text-right text-[12px] tabular-nums ${
                  col.strong ? "font-bold text-ink" : marked ? "text-ink" : "text-ink-muted"
                }`}
              >
                {rowStat(row, col.names) || "-"}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function StandingsPanel({
  leagueTag,
  highlight = [],
  title,
}: {
  leagueTag: string;
  highlight?: string[];
  title?: string;
}) {
  const t = useT();
  const [table, setTable] = useState<StandingsTable | null>(null);
  const [groupId, setGroupId] = useState("");

  useEffect(() => {
    let alive = true;
    setTable(null);
    setGroupId("");
    fetchStandings(leagueTag)
      .then((next) => {
        if (alive) setTable(next);
      })
      .catch(() => {
        if (alive) setTable(null);
      });
    return () => {
      alive = false;
    };
  }, [leagueTag]);

  const marks = useMemo(() => new Set(highlight.filter(Boolean)), [highlight.join(",")]);

  const group = useMemo(() => {
    if (!table) return null;
    if (groupId) return table.groups.find((g) => g.id === groupId) ?? table.groups[0];
    for (const id of marks) {
      const found = findStandingsRow(table, id);
      if (found) return found.group;
    }
    return table.groups[0];
  }, [table, groupId, marks]);

  if (!table || !group) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-edge-soft" />
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
          {title ?? t("Standings")}
        </span>
        <span className="h-px flex-1 bg-edge-soft" />
      </div>
      {table.groups.length > 1 && (
        <GroupTabs groups={table.groups} selected={group.id} onSelect={setGroupId} />
      )}
      <Table group={group} columns={headerSet(t, table.sport)} highlight={marks} />
    </section>
  );
}
