import { useState } from "react";
import { useT } from "@/lib/i18n";
import type { SportsSide } from "@/lib/sports/espn-types";
import { hubLeague } from "@/lib/sports/hub-data";
import { isIndividualCompetition } from "@/lib/sports/competition-metadata";
import { CompetitionAthletes } from "./competition-athletes";
import "./event-field.css";

const SHOWN = 10;

/**
 * A race or leaderboard has no home and away. Showing the leading pair as a
 * fixture hides everyone else, so the whole field is listed in finishing order.
 */
export function EventField({
  field,
  state,
  league,
}: {
  field: SportsSide[];
  state: string;
  league: string;
}) {
  const t = useT();
  const [all, setAll] = useState(false);
  if (field.length < 3) return null;
  const rows = all ? field : field.slice(0, SHOWN);
  const hidden = field.length - rows.length;
  const group = hubLeague(league)?.group ?? "";
  const individual = isIndividualCompetition(group);

  return (
    <section className="sh-field-board" aria-label={t("Full field")}>
      <header>
        <h3>{state === "pre" ? t("Starting field") : t("Leaderboard")}</h3>
        <span>{t("{count} competing", { count: field.length })}</span>
      </header>
      <ol>
        {rows.map((side, index) => (
          <li key={`${side.id || side.name}-${index}`} data-podium={index < 3 || undefined}>
            <span className="sh-field-place">{index + 1}</span>
            {!individual && (side.logo ? (
              <img src={side.logo} alt="" loading="lazy" />
            ) : (
              <span className="sh-field-blank" aria-hidden="true" />
            ))}
            <span className="sh-field-name">
              <CompetitionAthletes
                name={side.name}
                league={league}
                group={group}
                athletes={
                  side.athleteSource
                    ? [{
                        id: side.athleteId ?? "",
                        name: side.name,
                        source: side.athleteSource,
                        image: side.athleteImage,
                      }]
                    : undefined
                }
              />
            </span>
            {side.score && <span className="sh-field-score">{side.score}</span>}
          </li>
        ))}
      </ol>
      {hidden > 0 && (
        <button type="button" onClick={() => setAll(true)}>
          {t("Show all {count}", { count: field.length })}
        </button>
      )}
    </section>
  );
}
