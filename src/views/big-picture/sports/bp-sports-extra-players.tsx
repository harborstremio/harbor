import { useState } from "react";
import { UserRound } from "lucide-react";
import type { MatchPlayerStatTable, SportsMatchDetail } from "@/lib/sports/espn-types";
import { useBpT } from "../bp-i18n";
import {
  BP_SPORTS_CELL,
  BP_SPORTS_LABEL,
  BP_SPORTS_NAME,
  BP_SPORTS_NOTE,
  BP_SPORTS_STATCOL,
  BP_SPORTS_TIP,
  BP_SPORTS_VALUE,
  BpSportsPanelCell,
} from "./bp-sports-extra-kit";

const COLUMNS = 6;

const ROWS = 6;

const TABLES = 8;

const WIDE = "clamp(360px,44vw,900px)";

function Portrait({ src }: { src?: string }) {
  const [broken, setBroken] = useState(false);
  const art = src && !broken ? src : "";
  return (
    <span className="flex h-[clamp(26px,3vh,42px)] w-[clamp(26px,3vh,42px)] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--bp-void)]/70 text-ink-subtle">
      {art ? (
        <img
          src={art}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <UserRound className="h-[60%] w-[60%]" />
      )}
    </span>
  );
}

function BpPlayerStatCell({
  table,
  detail,
}: {
  table: MatchPlayerStatTable;
  detail: SportsMatchDetail;
}) {
  const t = useBpT();
  const [expanded, setExpanded] = useState(false);
  const team = [detail.home, detail.away].find((side) => side.id === table.teamId);
  const heading = [
    team?.name,
    table.name ? t(table.name) : t("Players"),
    table.innings ? t("Innings {n}", { n: table.innings }) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const labels = table.labels.slice(0, COLUMNS);
  const trimmed = table.labels.length - labels.length;
  const shown = expanded ? table.rows : table.rows.slice(0, ROWS);
  const rest = table.rows.length - shown.length;

  return (
    <BpSportsPanelCell
      restoreKey={`sports-player-stats-${table.teamId}-${table.name}-${table.innings ?? 0}`}
      width={WIDE}
      expanded={expanded}
      onPress={() => setExpanded(!expanded)}
      foot={rest > 0 ? t("Show all {n}", { n: table.rows.length }) : expanded ? t("Show less") : ""}
    >
      <span className={`${BP_SPORTS_TIP} truncate`}>{t("Player statistics")}</span>
      <span className={`${BP_SPORTS_VALUE} truncate`}>{heading}</span>
      {table.summary ? (
        <span className={`${BP_SPORTS_NOTE} line-clamp-2`}>{table.summary}</span>
      ) : null}
      <span className="flex w-full items-baseline gap-[clamp(10px,1vw,22px)]">
        <span className="min-w-0 flex-[3]" />
        {labels.map((label, index) => (
          <span
            key={`${label}-${index}`}
            className={`${BP_SPORTS_LABEL} ${BP_SPORTS_STATCOL} truncate`}
          >
            {t(label)}
          </span>
        ))}
      </span>
      {shown.map((row) => (
        <span
          key={row.player.id || row.player.name}
          className="flex w-full items-center gap-[clamp(10px,1vw,22px)]"
        >
          <span className="flex min-w-0 flex-[3] items-center gap-[clamp(8px,0.7vw,14px)]">
            <Portrait src={row.player.image} />
            <span className={`${BP_SPORTS_NAME} min-w-0 flex-1 truncate font-semibold`}>
              {row.player.name}
            </span>
          </span>
          {labels.map((label, index) => (
            <span
              key={`${label}-${index}`}
              className={`${BP_SPORTS_CELL} ${BP_SPORTS_STATCOL} text-ink-muted`}
            >
              {row.values[index] ?? "-"}
            </span>
          ))}
        </span>
      ))}
      {trimmed > 0 ? (
        <span className={BP_SPORTS_NOTE}>
          {t("{n} more columns are on the desktop box score", { n: trimmed })}
        </span>
      ) : null}
    </BpSportsPanelCell>
  );
}

export function bpSportsPlayerStatCells(detail: SportsMatchDetail | null) {
  const tables = (detail?.playerStats ?? []).filter((table) => table.rows.length > 0);
  if (!detail || tables.length === 0) return [];
  return tables
    .slice(0, TABLES)
    .map((table, index) => (
      <BpPlayerStatCell
        key={`${table.teamId}:${table.name}:${table.innings ?? 0}:${index}`}
        table={table}
        detail={detail}
      />
    ));
}
