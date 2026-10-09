import { ExternalLink } from "lucide-react";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import type { SportsGame } from "@/lib/sports/espn-types";
import { boxingRecord } from "@/lib/sports/boxing-record";
import { officialBoxingUrl } from "@/lib/sports/providers/boxing-schedule";
import { CompetitionAthletePortrait } from "./competition-athlete-portrait";
import "./competition-athletes.css";
import "./boxing-event-details.css";

export function BoxingEventDetails({ game }: { game: SportsGame }) {
  const t = useT();
  const url = officialBoxingUrl(game);
  return (
    <section className="sh-boxing-details" aria-label={t("Fight card")}>
      <header>
        <div>
          <h3>{t("Fight card")}</h3>
          <p>{[game.context?.draw, game.context?.venue].filter(Boolean).join(" · ")}</p>
        </div>
        {url && (
          <button type="button" className="sh-button" onClick={() => openUrl(url)}>
            {t("Official fight card")}
            <ExternalLink size={15} aria-hidden="true" />
          </button>
        )}
      </header>
      <div className="sh-boxing-fighters">
        {[game.home, game.away].map((side, index) => {
          const stats = boxingRecord(side.record);
          return (
            <article className="sh-boxing-fighter" key={`${index}:${side.name}`}>
              {side.name && (
                <CompetitionAthletePortrait
                  name={side.name}
                  league={game.league}
                  group="boxing"
                  publishedImage={game.source === "official-boxing" ? side.logo : undefined}
                />
              )}
              <div className="sh-boxing-fighter-copy">
                <h4>{side.name || t("sports.boxing.tba")}</h4>
                {stats ? (
                  <dl className="sh-boxing-record">
                    {stats.map(({ label, value }) => (
                      <div key={label}>
                        <dt>{t(label)}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : side.record ? (
                  <p className="sh-boxing-record-text">{side.record}</p>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
