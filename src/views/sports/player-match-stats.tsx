import { useState } from "react";
import { UserRound } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useDragScroll } from "@/lib/use-drag-scroll";
import type {
  MatchPartnershipTable,
  MatchPlayerStatTable,
  SportsMatchDetail,
} from "@/lib/sports/espn-types";
import { AthleteProfileLink } from "./athlete-profile";
import "./player-match-stats.css";

function PlayerPhoto({ src }: { src?: string }) {
  const [failed, setFailed] = useState("");
  return (
    <span className="sh-player-stat-photo">
      {src && failed !== src ? (
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(src)} />
      ) : (
        <UserRound size={19} aria-hidden="true" />
      )}
    </span>
  );
}

function PlayerTable({
  table,
  detail,
}: {
  table: MatchPlayerStatTable;
  detail: SportsMatchDetail;
}) {
  const t = useT();
  const [open, setOpen] = useState(false),
    [limit, setLimit] = useState(60);
  const drag = useDragScroll<HTMLDivElement>();
  const team = [detail.home, detail.away].find((side) => side.id === table.teamId);
  const title = [
    team?.name,
    table.name ? t(table.name) : t("Players"),
    table.innings ? t("Innings {n}", { n: table.innings }) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <details
      className="sh-player-stat-table"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        {title}
        <span>{table.rows.length}</span>
      </summary>
      {open && (
        <>
          {table.summary && <p>{table.summary}</p>}
          <div
            ref={drag.ref}
            {...drag.handlers}
            className="sh-player-stat-scroll"
            tabIndex={0}
            role="region"
            aria-label={title}
          >
            <table>
              <caption className="sr-only">{title}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("Players")}</th>
                  {table.labels.map((label, index) => (
                    <th scope="col" key={index} title={t(table.descriptions[index] || label)}>
                      {t(label)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.slice(0, limit).map((row) => (
                  <tr key={row.player.id}>
                    <th scope="row">
                      <div>
                        <PlayerPhoto src={row.player.image} />
                        <AthleteProfileLink
                          athlete={row.player}
                          league={detail.league}
                          label={row.player.name}
                        />
                      </div>
                    </th>
                    {row.values.map((value, index) => (
                      <td key={index}>
                        <bdi>{value}</bdi>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {table.rows.length > limit && (
            <button className="sh-button" onClick={() => setLimit((value) => value + 60)}>
              {t("Show more")}
            </button>
          )}
        </>
      )}
    </details>
  );
}

function PartnershipTable({
  table,
  detail,
}: {
  table: MatchPartnershipTable;
  detail: SportsMatchDetail;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const drag = useDragScroll<HTMLDivElement>();
  const team = [detail.home, detail.away].find((side) => side.id === table.teamId);
  const title = [team?.name, t("Partnerships"), t("Innings {n}", { n: table.innings })]
    .filter(Boolean)
    .join(" · ");
  return (
    <details
      className="sh-player-stat-table"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        {title}
        <span>{table.rows.length}</span>
      </summary>
      {open && (
        <div
          ref={drag.ref}
          {...drag.handlers}
          className="sh-player-stat-scroll sh-partnership-scroll"
          tabIndex={0}
          role="region"
          aria-label={title}
        >
          <table>
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr>
                <th scope="col">{t("Players")}</th>
                <th scope="col">{t("Wicket")}</th>
                <th scope="col">{t("Runs")}</th>
                <th scope="col">{t("Overs")}</th>
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, index) => (
                <tr key={index}>
                  <th scope="row">
                    {row.players.map((player, index) => (
                      <span key={index} className="sh-partnership-batter">
                        <bdi>{player.name}</bdi>{" "}
                        <small>
                          · {player.runs} {t("Runs")}
                        </small>
                      </span>
                    ))}
                  </th>
                  <td>
                    <bdi>{row.wicket}</bdi>
                  </td>
                  <td>
                    <bdi>{row.runs}</bdi>
                  </td>
                  <td>
                    <bdi>{row.overs}</bdi>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}

export function PlayerMatchStats({ detail }: { detail: SportsMatchDetail }) {
  const t = useT();
  if (!detail.playerStats?.length && !detail.partnerships?.length) return null;
  return (
    <section className="sh-player-match-stats">
      <h3>{t("Player statistics")}</h3>
      {detail.playerStats?.map((table, index) => (
        <PlayerTable
          key={`${detail.league}:${detail.id}:${table.teamId}:${table.name}:${table.innings}:${index}`}
          table={table}
          detail={detail}
        />
      ))}
      {detail.partnerships?.map((table) => (
        <PartnershipTable
          key={`${detail.league}:${detail.id}:${table.teamId}:${table.innings}`}
          table={table}
          detail={detail}
        />
      ))}
    </section>
  );
}
