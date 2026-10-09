import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { SportsGame, SportsMatchDetail } from "@/lib/sports/espn-types";
import { scoreMetric, hasUsefulScoreBreakdown } from "@/lib/sports/score-detail";
import "./score-breakdown.css";

export function ScoreMetric({ sport, game }: { sport: string; game: SportsGame }) {
  const t = useT();
  if (
    game.state === "pre" ||
    ![
      "tennis",
      "volleyball",
      "badminton",
      "tabletennis",
      "pickleball",
      "snooker",
      "cricket",
    ].includes(sport)
  )
    return null;
  const metric =
    sport === "cricket" && ![game.home.score, game.away.score].some((value) => value.includes("/"))
      ? "Runs"
      : scoreMetric(sport);
  return <span className="sh-score-unit">{t(metric)}</span>;
}

export function ScoreBreakdown({ game, sport }: { game: SportsGame; sport: string }) {
  const t = useT();
  if (!hasUsefulScoreBreakdown(game, sport)) return null;
  const showTotal = ["motorsport", "golf"].includes(sport);
  const rows = showTotal && game.field?.length ? game.field : [game.home, game.away];
  const periods = [
    ...new Set(rows.flatMap((side) => (side.periods || []).map((row) => row.period))),
  ].sort((a, b) => a - b);
  const hasPoints =
    sport === "tennis" &&
    game.state === "in" &&
    (game.home.currentPoint !== undefined || game.away.currentPoint !== undefined);
  const innings =
    sport === "cricket"
      ? ((game as SportsMatchDetail).playerStats || []).filter(
          (row) => row.summary && row.innings && /bat/i.test(row.name),
        )
      : [];
  if (innings.length)
    return (
      <ScoreDisclosure>
        <div className="sh-score-breakdown sh-score-innings">
          {innings.map((row) => (
            <div key={`${row.teamId}:${row.innings}`}>
              <strong>{row.teamId === game.home.id ? game.home.name : game.away.name}</strong>
              <span>
                {t("Innings")} {row.innings}
              </span>
              <b>{row.summary}</b>
            </div>
          ))}
        </div>
      </ScoreDisclosure>
    );
  if (!periods.length && !hasPoints && !["motorsport", "golf"].includes(sport)) return null;
  const heading = (n: number) => {
    if (["tennis", "volleyball"].includes(sport)) return t("Set {n}", { n });
    if (sport === "basketball" && ["NCAA", "NCAAB"].includes(game.league))
      return t("Period {n}", { n });
    if (["basketball", "football"].includes(sport))
      return n <= 4 ? t("Quarter {n}", { n }) : `${t("Overtime")} ${n - 4}`;
    if (sport === "hockey" && n > 3) return `${t("Overtime")} ${n - 3}`;
    if (["baseball", "softball", "cricket"].includes(sport)) return `${t("Innings")} ${n}`;
    return t("Period {n}", { n });
  };
  return (
    <ScoreDisclosure>
      <div className="sh-score-breakdown" tabIndex={0} role="region" aria-label={t("Match score")}>
        <table>
          <thead>
            <tr>
              <th scope="col">{t("Match score")}</th>
              {periods.map((n) => (
                <th scope="col" key={n}>
                  {heading(n)}
                </th>
              ))}
              {hasPoints && <th scope="col">{t("Current points")}</th>}
              {showTotal && <th scope="col">{t(scoreMetric(sport))}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((side, i) => (
              <tr key={i}>
                <th scope="row">
                  <span>{side.name}</span>
                  {sport === "tennis" && game.state === "in" && side.serving && (
                    <i className="sh-serving-dot" title={t("Serving")} aria-label={t("Serving")} />
                  )}
                </th>
                {periods.map((n) => {
                  const line = side.periods?.find((row) => row.period === n);
                  return (
                    <td key={n} className={line?.winner ? "is-won" : ""}>
                      {line?.value ?? "—"}
                      {line?.tiebreak !== undefined && <sup>{line.tiebreak}</sup>}
                    </td>
                  );
                })}
                {hasPoints && <td className="is-current">{side.currentPoint ?? "—"}</td>}
                {showTotal && <td className="is-total">{side.score || "—"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ScoreDisclosure>
  );
}

function ScoreDisclosure({ children }: { children: ReactNode }) {
  const t = useT();
  return (
    <details className="sh-full-score">
      <summary>
        <strong>{t("Full score")}</strong>
        <ChevronDown size={19} aria-hidden="true" />
      </summary>
      {children}
    </details>
  );
}
