import { useState } from "react";
import type { StandingsGroup, StandingsRow } from "@/lib/sports/standings";
import { useBpT } from "../bp-i18n";
import {
  BP_SPORTS_CELL,
  BP_SPORTS_LABEL,
  BP_SPORTS_MICRO,
  BP_SPORTS_NAME,
  BP_SPORTS_PAIRS,
  BP_SPORTS_ROWCOL,
  BP_SPORTS_STATCOL,
  BP_SPORTS_VALUE,
  BpSportsPanelCell,
  BpSportsPanelRow,
} from "./bp-sports-extra-kit";
import type { BpSportsEventData } from "./use-bp-sports-event";

const SHOWN = 6;

function windowRows(rows: StandingsRow[], highlight: string[]): StandingsRow[] {
  const hits = rows
    .map((row, i) => (highlight.includes(row.teamId) ? i : -1))
    .filter((i) => i >= 0);
  if (hits.length === 0) return rows.slice(0, SHOWN);
  const first = Math.min(...hits);
  const last = Math.max(...hits);
  const start = Math.max(0, Math.min(first - 1, rows.length - SHOWN));
  return rows.slice(start, Math.max(start + SHOWN, last + 1));
}

type StandingsRail = { group: StandingsGroup | null; highlight: string[] };

export function BpSportsStandingsRow({ group, highlight }: StandingsRail) {
  const t = useBpT();
  const [expanded, setExpanded] = useState(false);
  const rows = group?.rows ?? [];
  if (rows.length === 0) return null;
  const shown = expanded ? rows : windowRows(rows, highlight);
  const rest = rows.length - shown.length;
  const heading = group?.name || t("Standings");
  const drawn = rows.some((row) => row.draws !== null);
  const heads = [t("Played"), t("Won"), ...(drawn ? [t("Drawn")] : []), t("Lost"), t("Points")];
  const cells = (row: StandingsRow) =>
    [row.played, row.wins, ...(drawn ? [row.draws] : []), row.losses, row.points].map((value) =>
      value === null ? "-" : String(value),
    );

  return (
    <BpSportsPanelRow rowKey="sports-standings" reserve="440px" title={heading}>
      <BpSportsPanelCell
        restoreKey="sports-standings"
        expanded={expanded}
        onPress={() => setExpanded(!expanded)}
        foot={rest > 0 ? t("Show all {n}", { n: rows.length }) : expanded ? t("Show less") : ""}
      >
        <span className="flex w-full items-baseline gap-[clamp(10px,1vw,22px)]">
          <span className={BP_SPORTS_ROWCOL} />
          <span className="min-w-0 flex-[3]" />
          {heads.map((head) => (
            <span key={head} className={`${BP_SPORTS_LABEL} ${BP_SPORTS_STATCOL} truncate`}>
              {head}
            </span>
          ))}
        </span>
        {shown.map((row) => {
          const on = highlight.includes(row.teamId);
          return (
            <span
              key={row.teamId}
              className={`flex w-full items-baseline gap-[clamp(10px,1vw,22px)] ${
                on ? "font-bold text-ink" : "font-semibold text-ink-muted"
              }`}
            >
              <span className={`${BP_SPORTS_MICRO} ${BP_SPORTS_ROWCOL}`}>{row.rank}</span>
              <span className={`${BP_SPORTS_NAME} min-w-0 flex-[3] truncate`}>
                {row.shortName || row.name}
              </span>
              {cells(row).map((value, i) => (
                <span key={heads[i]} className={`${BP_SPORTS_CELL} ${BP_SPORTS_STATCOL}`}>
                  {value}
                </span>
              ))}
            </span>
          );
        })}
      </BpSportsPanelCell>
    </BpSportsPanelRow>
  );
}

export function BpSportsFactsRow({ data }: { data: BpSportsEventData }) {
  const t = useBpT();
  const [expanded, setExpanded] = useState(false);
  const { game } = data;
  const facts: Array<[string, string]> = [
    [t("Competition"), game.context?.name || data.leagueLabel],
    [t("Round"), game.context?.round ?? ""],
    [t("Draw"), game.context?.draw ?? ""],
    [t("Court"), game.context?.court ?? ""],
    [t("Venue"), game.context?.venue ?? ""],
    [t("Start"), data.when],
    [t("Broadcast"), (game.broadcasts ?? []).join(", ")],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  if (facts.length === 0) return null;
  const shown = expanded ? facts : facts.slice(0, SHOWN);
  const rest = facts.length - shown.length;

  return (
    <BpSportsPanelRow rowKey="sports-facts" reserve="320px" title={t("Event details")}>
      <BpSportsPanelCell
        restoreKey="sports-facts"
        expanded={expanded}
        onPress={() => setExpanded(!expanded)}
        foot={rest > 0 ? t("Show all {n}", { n: facts.length }) : expanded ? t("Show less") : ""}
      >
        <span className={BP_SPORTS_PAIRS}>
          {shown.map(([label, value]) => (
            <span key={label} className="flex w-full items-baseline gap-[clamp(12px,1.4vw,28px)]">
              <span className={`${BP_SPORTS_LABEL} w-[clamp(118px,12vw,220px)] shrink-0`}>
                {label}
              </span>
              <span className={`${BP_SPORTS_VALUE} min-w-0 flex-1 truncate`}>{value}</span>
            </span>
          ))}
        </span>
      </BpSportsPanelCell>
    </BpSportsPanelRow>
  );
}
