import { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { SportsGame } from "@/lib/sports/espn";
import type { F1Driver, F1Standing } from "@/lib/sports/f1-data";
import { sportsJson } from "@/lib/sports/hub-data";
import { useF1 } from "./use-f1";
import { SportIcon } from "./sport-icon";
import { SportsSelect } from "./sports-select";
import { F1CircuitIcon, F1Track } from "./f1-track";
import { AthleteVideos } from "./athlete-videos";

type Portrait = { name_acronym: string; headshot_url: string; team_colour: string };
let portraitsPromise: Promise<Portrait[]> | undefined;
function usePortraits() {
  const [portraits, setPortraits] = useState<Portrait[]>([]);
  useEffect(() => {
    let active = true;
    portraitsPromise ??= sportsJson(
      "https://api.openf1.org/v1/drivers?session_key=latest",
      AbortSignal.timeout(9000),
    )
      .then((data) => (Array.isArray(data) ? (data as Portrait[]) : []))
      .catch(() => []);
    void portraitsPromise.then((data) => {
      if (active) setPortraits(data);
    });
    return () => {
      active = false;
    };
  }, []);
  return portraits;
}
function DriverPortrait({
  driver,
  portraits,
  large = false,
}: {
  driver: F1Driver;
  portraits: Portrait[];
  large?: boolean;
}) {
  const portrait = portraits.find((item) => item.name_acronym === driver.code);
  const [failed, setFailed] = useState(false);
  return (
    <span className={`sh-driver-portrait ${large ? "large" : ""}`}>
      {portrait?.headshot_url && !failed ? (
        <img src={portrait.headshot_url} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <strong>{driver.code || driver.familyName.slice(0, 3)}</strong>
      )}
    </span>
  );
}
function DriverRecord({
  standing,
  year,
  onBack,
  portraits,
}: {
  standing: F1Standing;
  year: number;
  onBack: () => void;
  portraits: Portrait[];
}) {
  const t = useT();
  const driver = standing.Driver;
  const id = encodeURIComponent(driver.driverId);
  const wins = useF1(`drivers/${id}/results/1/?limit=1`);
  const poles = useF1(`drivers/${id}/qualifying/1/?limit=1`);
  const entries = useF1(`drivers/${id}/results/?limit=1`);
  const season = useF1(`${year}/drivers/${id}/results/?limit=100`);
  const races = season.data?.MRData.RaceTable?.Races ?? [];
  const stats = [
    [t("Career wins"), wins],
    [t("Pole positions"), poles],
    [t("Race entries"), entries],
  ] as const;
  return (
    <div className="sh-driver-record">
      <button className="sh-button" onClick={onBack}>
        <ArrowLeft size={16} />
        {t("Standings")}
      </button>
      <div className="sh-driver-bio">
        <div>
          <span className="sh-eyebrow">
            {driver.nationality} · #{driver.permanentNumber}
          </span>
          <h3>
            {driver.givenName}
            <br />
            {driver.familyName}
          </h3>
          <p>{standing.Constructors.map((item) => item.name).join(" · ")}</p>
          <p>
            {t("Born")} {driver.dateOfBirth}
          </p>
        </div>
        <DriverPortrait key={id} driver={driver} portraits={portraits} large />
      </div>
      <div className="sh-driver-stats">
        {stats.map(([label, resource]) => (
          <div key={label}>
            <strong>{resource.data?.MRData.total ?? (resource.loading ? "…" : "—")}</strong>
            <span>{label}</span>
            {resource.failed && (
              <button className="sh-text-button" onClick={resource.retry}>
                {t("Retry")}
              </button>
            )}
          </div>
        ))}
        <div>
          <strong>{standing.points}</strong>
          <span>
            {year} · {t("Points")}
          </span>
        </div>
      </div>
      <h3 className="sh-field-title">
        {t("Season results")} · {year}
      </h3>
      {season.loading ? (
        <p role="status">{t("Loading results…")}</p>
      ) : races.length ? (
        <div className="sh-f1-results">
          {[...races].reverse().map((race) => {
            const result = race.Results?.[0];
            return (
              <div key={race.round}>
                <span>{race.date}</span>
                <strong>{race.raceName}</strong>
                <span>
                  {t("Grid")} {result?.grid || "—"}
                </span>
                <b>{result?.positionText || "—"}</b>
                <small>
                  {result?.points ?? "—"} {t("pts")}
                </small>
              </div>
            );
          })}
        </div>
      ) : (
        <p>{t("Results are not available yet.")}</p>
      )}
      <AthleteVideos
        name={`${driver.givenName} ${driver.familyName}`}
        league="F1"
        sport="Formula 1"
      />
    </div>
  );
}

export function F1Hub({ game }: { game?: SportsGame }) {
  const t = useT();
  const year = game ? new Date(game.startMs).getFullYear() : new Date().getFullYear();
  const [tab, setTab] = useState("drivers");
  const [driver, setDriver] = useState<F1Standing | null>(null);
  const drivers = useF1(`${year}/driverstandings/?limit=100`);
  const constructors = useF1(`${year}/constructorstandings/?limit=100`);
  const calendar = useF1(`${year}/?limit=100`);
  const portraits = usePortraits();
  const list = drivers.data?.MRData.StandingsTable?.StandingsLists[0];
  const teamList = constructors.data?.MRData.StandingsTable?.StandingsLists[0];
  const races = calendar.data?.MRData.RaceTable?.Races ?? [];
  const race = game
    ? races.find(
        (item) =>
          Math.abs(Date.parse(`${item.date}T${item.time || "12:00:00Z"}`) - game.startMs) <
          36 * 3600_000,
      )
    : races.find((item) => Date.parse(item.date) >= Date.now() - 86400_000);
  const [circuitId, setCircuitId] = useState("");
  const selectedRace = races.find((item) => item.Circuit.circuitId === circuitId) ?? race;
  if (driver)
    return (
      <DriverRecord
        standing={driver}
        year={year}
        onBack={() => setDriver(null)}
        portraits={portraits}
      />
    );
  return (
    <section className="sh-f1-hub">
      <div className="sh-section-head">
        <div>
          <span className="sh-eyebrow">FORMULA 1 · {year}</span>
          <h2>{t("Inside the paddock")}</h2>
          <p>{t("Explore the circuit. Follow the championship. Know every driver.")}</p>
        </div>
      </div>
      {races.length > 0 && (
        <div className="sh-select-label">
          <span>{t("Circuit")}</span>
          <SportsSelect
            ariaLabel={t("Choose circuit")}
            value={selectedRace?.Circuit.circuitId || ""}
            onChange={setCircuitId}
            options={races.map((item) => ({
              value: item.Circuit.circuitId,
              label: item.raceName,
              left: <F1CircuitIcon circuitId={item.Circuit.circuitId} />,
            }))}
          />
        </div>
      )}
      {selectedRace && <F1Track race={selectedRace} />}
      <div className="sh-f1-tabs">
        <button aria-pressed={tab === "drivers"} onClick={() => setTab("drivers")}>
          {t("Drivers")}
        </button>
        <button aria-pressed={tab === "teams"} onClick={() => setTab("teams")}>
          {t("Constructors")}
        </button>
        <span>{list ? t("After round {n}", { n: list.round }) : ""}</span>
      </div>
      {(drivers.failed || constructors.failed || calendar.failed) && (
        <div className="sh-feed-note" role="status">
          {t("Some F1 data is unavailable. Saved results remain visible.")}
          <button
            className="sh-text-button"
            onClick={() => {
              drivers.retry();
              constructors.retry();
              calendar.retry();
            }}
          >
            {t("Retry")}
          </button>
        </div>
      )}
      {tab === "drivers" ? (
        <div className="sh-f1-standings">
          <div className="sh-f1-table-head">
            <span>{t("Pos")}</span>
            <span>{t("Driver")}</span>
            <span className="sh-stat-label">
              <SportIcon name="trophy" size={16} />
              {t("Wins")}
            </span>
            <span>{t("Points")}</span>
          </div>
          {list?.DriverStandings?.map((standing) => (
            <button key={standing.Driver.driverId} onClick={() => setDriver(standing)}>
              <b className="sh-standing-position">
                {standing.position}
                {standing.position === "1" && <SportIcon name="crown" size={17} />}
              </b>
              <span className="sh-f1-driver-name">
                <DriverPortrait driver={standing.Driver} portraits={portraits} />
                <span>
                  <strong>
                    {standing.Driver.givenName} {standing.Driver.familyName}
                  </strong>
                  <small>{standing.Constructors.map((item) => item.name).join(" · ")}</small>
                </span>
              </span>
              <span>{standing.wins}</span>
              <strong>
                {standing.points}
                <ArrowRight size={14} />
              </strong>
            </button>
          ))}
          {drivers.loading && <p role="status">{t("Loading standings…")}</p>}
        </div>
      ) : (
        <div className="sh-f1-standings">
          <div className="sh-f1-table-head">
            <span>{t("Pos")}</span>
            <span>{t("Constructor")}</span>
            <span className="sh-stat-label">
              <SportIcon name="trophy" size={16} />
              {t("Wins")}
            </span>
            <span>{t("Points")}</span>
          </div>
          {teamList?.ConstructorStandings?.map((standing) => (
            <div key={standing.Constructor.constructorId}>
              <b className="sh-standing-position">
                {standing.position}
                {standing.position === "1" && <SportIcon name="crown" size={17} />}
              </b>
              <strong>{standing.Constructor.name}</strong>
              <span>{standing.wins}</span>
              <strong>{standing.points}</strong>
            </div>
          ))}
          {constructors.loading && <p role="status">{t("Loading standings…")}</p>}
        </div>
      )}
      <p className="sh-f1-credit">
        {t(
          "Results: Jolpica. Driver images: OpenF1 / Formula 1. Circuit outlines: Tomislav Bacinger (MIT).",
        )}
      </p>
    </section>
  );
}
