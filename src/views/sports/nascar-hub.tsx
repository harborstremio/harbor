import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowUpRight, LoaderCircle, UserRound } from "lucide-react";
import { ModalShell } from "@/components/modal-shell";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import type { SportsGame } from "@/lib/sports/espn-types";
import {
  loadNascarRace,
  loadNascarStandings,
  loadNascarDriver,
  nascarSeriesForLeague,
  type NascarDriver,
  type NascarDriverProfile,
  type NascarRaceData,
  type NascarStandings,
} from "@/lib/sports/nascar-data";
import { useEventDate } from "./hub-cards";
import "./nascar-hub.css";
import { AthleteVideos } from "./athlete-videos";

const value = (number: number | undefined) => (number == null ? "—" : number.toLocaleString());
function Portrait({ driver, large = false }: { driver: NascarDriver; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const image = large ? driver.firesuitImage || driver.image : driver.image || driver.firesuitImage;
  return (
    <span className={`sh-racing-portrait${large ? " large" : ""}`}>
      {image && !failed ? (
        <img src={image} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : (
        <UserRound size={large ? 64 : 24} aria-hidden="true" />
      )}
    </span>
  );
}
function DriverProfile({
  driver,
  race,
  onClose,
}: {
  driver: NascarDriver;
  race: NascarRaceData;
  onClose: () => void;
}) {
  const t = useT();
  const [data, setData] = useState<NascarDriverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const backButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    backButton.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void loadNascarDriver(driver.id, race.season, race.series, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [driver.id, race.season, race.series]);
  const person = data?.driver || driver;
  const standing = data?.standing;
  return (
    <ModalShell closing={false} onDismiss={onClose} width={1000} labelledBy="nascar-driver-title">
      <article className="sh-setup-body sh-nascar">
        <button ref={backButton} className="sh-button" onClick={onClose}>
          <ArrowLeft size={16} />
          {t("Back")}
        </button>
        <div className="sh-nascar-driver-hero">
          <div>
            <span className="sh-eyebrow">NASCAR · {race.season}</span>
            <h3 id="nascar-driver-title">
              {person.carNumber && <span className="sh-nascar-number">{person.carNumber}</span>}
              {person.name}
            </h3>
            {[person.team, person.manufacturer, person.hometown].filter(Boolean).map((item) => (
              <p key={item}>{item}</p>
            ))}
            {person.crewChief && (
              <p>
                {t("Crew chief")}: {person.crewChief}
              </p>
            )}
          </div>
          <Portrait driver={person} large />
        </div>
        {loading && (
          <div className="sh-nascar-loading" role="status">
            <LoaderCircle size={18} className="animate-spin" />
            {t("Loading athlete profile…")}
          </div>
        )}
        {standing && (
          <>
            <h3>
              {race.season} · {t("Season statistics")}
            </h3>
            <div className="sh-nascar-summary">
              {[
                ["Position", standing.position],
                ["Points", standing.points],
                ["Wins", standing.wins],
                ["Starts", standing.starts],
                ["Top 5", standing.top5],
                ["Top 10", standing.top10],
                ["Poles", standing.poles],
                ["Laps led", standing.lapsLed],
              ].map(([label, number]) => (
                <div key={label}>
                  <strong>{value(number as number | undefined)}</strong>
                  <small>{t(label as string)}</small>
                </div>
              ))}
            </div>
          </>
        )}
        <section className="sh-nascar-section">
          <h3>{t("Career statistics")}</h3>
          {data?.partial && !data.career?.some((row) => row.season < race.season) && (
            <p className="text-xs text-ink-muted">
              {t(
                "Only the available season is shown. Visit the official driver profile for the full career record.",
              )}
            </p>
          )}
          {data?.career?.length ? (
            <div
              className="sh-nascar-table-scroll"
              role="region"
              tabIndex={0}
              aria-label={t("Career statistics")}
            >
              <table className="sh-nascar-table">
                <thead>
                  <tr>
                    {[
                      "Season",
                      "Racing series",
                      "Starts",
                      "Wins",
                      "Top 5",
                      "Top 10",
                      "Poles",
                      "Laps led",
                    ].map((label) => (
                      <th key={label}>{t(label)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.career.map((row) => (
                    <tr key={`${row.season}:${row.series}`}>
                      <th>{row.season}</th>
                      <td>{row.series === 1 ? "Cup" : row.series === 2 ? "Xfinity" : "Trucks"}</td>
                      {[row.starts, row.wins, row.top5, row.top10, row.poles, row.lapsLed].map(
                        (number, index) => (
                          <td key={index}>{value(number)}</td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            !loading && (
              <p className="text-sm text-ink-muted">
                {t("Career statistics are not available from this feed.")}
              </p>
            )
          )}
        </section>
        <AthleteVideos name={person.name} league="NASCAR" sport="NASCAR" />
        <footer className="sh-nascar-credit">
          <span>{t("Data and portraits supplied by NASCAR.")}</span>
          {person.url && (
            <button className="sh-button" onClick={() => openUrl(person.url!)}>
              {t("Official driver profile")}
              <ArrowUpRight size={15} />
            </button>
          )}
        </footer>
      </article>
    </ModalShell>
  );
}

export function NascarHub({
  game,
  fallback,
  venue,
}: {
  game: SportsGame;
  fallback: ReactNode;
  venue?: (race: NascarRaceData) => ReactNode;
}) {
  const t = useT();
  const date = useEventDate();
  const [race, setRace] = useState<NascarRaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [tab, setTab] = useState("Results");
  const [standings, setStandings] = useState<NascarStandings | null>(null);
  const [standingsState, setStandingsState] = useState("idle");
  const [driver, setDriver] = useState<NascarDriver | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const series = nascarSeriesForLeague(game.league);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void loadNascarRace(game, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setRace(result);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [game.id, game.startMs, game.state, series, retry]);
  useEffect(() => {
    if (game.state !== "in") return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setRetry((n) => n + 1);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [game.state]);
  useEffect(() => {
    if (tab !== "Standings" || !race) return;
    const controller = new AbortController();
    setStandingsState("loading");
    void loadNascarStandings(race.season, race.series, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setStandings(result);
          setStandingsState("ready");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setStandingsState("error");
      });
    return () => controller.abort();
  }, [tab, race?.season, race?.series, retry]);
  const choose = (person: NascarDriver, element: HTMLElement) => {
    trigger.current = element;
    setDriver(person);
  };
  if (!race)
    return loading ? (
      <div className="sh-nascar-loading" role="status">
        <LoaderCircle size={18} className="animate-spin" />
        {t("Loading race details…")}
      </div>
    ) : (
      <>
        {fallback}
        <button className="sh-text-button" onClick={() => setRetry((n) => n + 1)}>
          {t("Retry NASCAR data")}
        </button>
      </>
    );
  const headers =
    tab === "Standings"
      ? ["Position", "Driver", "Points", "Wins", "Top 5", "Top 10", "Starts"]
      : ["Position", "Driver", "Starting grid", "Laps", "Laps led", "Gap", "Points", "Status"];
  const winner = race.results.find((row) => row.position === 1);
  return (
    <section className="sh-nascar">
      {venue?.(race)}
      <div className="sh-nascar-summary">
        {[
          ["Scheduled laps", race.scheduledLaps],
          ["Completed laps", race.completedLaps],
          ["Distance (mi)", race.distanceMiles],
          ["Drivers", race.results.length || undefined],
        ].map(([label, number]) => (
          <div key={label}>
            <strong>{value(number as number | undefined)}</strong>
            <small>{t(label as string)}</small>
          </div>
        ))}

        {winner?.time && (
          <div>
            <strong>{winner.time}</strong>
            <small>{t("Race time")}</small>
          </div>
        )}

        {winner?.speed !== undefined && (
          <div>
            <strong>{winner.speed}</strong>
            <small>{t("Average speed (mph)")}</small>
          </div>
        )}
      </div>
      <div className="sh-nascar-toolbar">
        <div className="sh-nascar-tabs">
          {["Results", "Standings", "Event schedule"].map((label) => (
            <button key={label} aria-pressed={tab === label} onClick={() => setTab(label)}>
              {t(label === "Results" && race.state === "pre" ? "The field" : label)}
            </button>
          ))}
        </div>
        <span className="sh-nascar-count">{race.season}</span>
      </div>
      {tab === "Event schedule" ? (
        <div className="sh-nascar-sessions">
          {race.sessions.map((session) => (
            <div key={session.id}>
              <strong>{session.name}</strong>
              <span>{date(session.startMs)}</span>
            </div>
          ))}
        </div>
      ) : (
        <>
          {tab === "Standings" && standingsState === "loading" && !standings && (
            <div className="sh-nascar-loading" role="status">
              <LoaderCircle size={18} className="animate-spin" />
              {t("Loading standings…")}
            </div>
          )}
          {tab === "Standings" && standingsState === "error" && (
            <div className="sh-feed-note">
              {t("Standings are unavailable.")}
              <button className="sh-text-button" onClick={() => setRetry((n) => n + 1)}>
                {t("Retry")}
              </button>
            </div>
          )}
          <div className="sh-nascar-table-scroll" role="region" tabIndex={0} aria-label={t(tab)}>
            <table className="sh-nascar-table">
              <thead>
                <tr>
                  {headers.map((label) => (
                    <th key={label}>{t(label)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(tab === "Standings" ? standings?.standings || [] : race.results).map((row) => {
                  const metrics =
                    "grid" in row || tab !== "Standings"
                      ? (() => {
                          const result = row as NascarRaceData["results"][number];
                          return [
                            value(result.grid),
                            value(result.laps),
                            value(result.lapsLed),
                            result.delta || (result.position === 1 ? t("Leader") : "—"),
                            value(result.points),
                            result.status || "—",
                          ];
                        })()
                      : (() => {
                          const result = row as NascarStandings["standings"][number];
                          return [
                            value(result.points),
                            value(result.wins),
                            value(result.top5),
                            value(result.top10),
                            value(result.starts),
                          ];
                        })();
                  return (
                    <tr key={row.driver.id}>
                      <td>{value(row.position)}</td>
                      <td>
                        <button
                          onClick={(event) => choose(row.driver, event.currentTarget)}
                          aria-label={`${t("Career profile")}: ${row.driver.name}`}
                        >
                          <Portrait driver={row.driver} />
                          <span>
                            <strong>
                              {row.driver.carNumber && (
                                <span className="sh-nascar-number">{row.driver.carNumber}</span>
                              )}
                              {row.driver.name}
                            </strong>
                            <small>{row.driver.team || row.driver.manufacturer}</small>
                          </span>
                          <ArrowUpRight size={14} aria-hidden="true" />
                        </button>
                      </td>
                      {metrics.map((metric, index) => (
                        <td key={index}>{metric}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {tab === "Results" && !race.results.length && (
            <p className="text-sm text-ink-muted">
              {t("Entrants and starting positions appear when the feed publishes them.")}
            </p>
          )}
        </>
      )}
      <footer className="sh-nascar-credit">
        <span>
          {t("Data and portraits supplied by NASCAR.")} ·{" "}
          {new Date(race.fetchedAt).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
        <button
          className="sh-text-button"
          onClick={() => openUrl("https://www.nascar.com/results/racecenter/")}
        >
          {t("Official race center")}
          <ArrowUpRight size={13} />
        </button>
      </footer>
      {driver && (
        <DriverProfile
          key={driver.id}
          driver={driver}
          race={race}
          onClose={() => {
            setDriver(null);
            requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
          }}
        />
      )}
    </section>
  );
}
