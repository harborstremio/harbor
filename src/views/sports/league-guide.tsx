import { TeamProfileLink } from "./team-profile-link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, LoaderCircle, Search, X } from "lucide-react";
import { ModalShell } from "@/components/modal-shell";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { getLeagueLabel, type LeagueDef } from "@/lib/sports/espn";
import {
  leagueMetadataSeed,
  loadLeagueMetadata,
  readLeagueMetadata,
  type LeagueMetadata,
} from "@/lib/sports/league-metadata";
import { LeagueLogo } from "./league-logo";
import { normalizeSportsSearch } from "@/lib/sports/search-text";
import { SportIcon } from "./sport-icon";
import { isIndividualCompetition } from "@/lib/sports/competition-metadata";
import { LeagueGuideAthlete, LeagueGuideAthletes } from "./league-guide-athletes";
import "./league-guide.css";

function Artwork({
  src,
  className = "",
  sport,
}: {
  src?: string;
  className?: string;
  sport?: string;
}) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? (
    <img
      src={src}
      alt=""
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  ) : sport ? (
    <SportIcon name={sport} size={30} />
  ) : null;
}
export function LeagueGuide({ league, onClose }: { league: LeagueDef; onClose: () => void }) {
  const t = useT();
  const [data, setData] = useState<LeagueMetadata>(
    () => readLeagueMetadata(league) || leagueMetadataSeed(league),
  );
  const [status, setStatus] = useState("loading");
  const [retry, setRetry] = useState(0);
  const [tab, setTab] = useState("Overview");
  const [group, setGroup] = useState("");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(60);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    void loadLeagueMetadata(league, controller.signal, retry > 0)
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
          setStatus(result.partial ? "partial" : "ready");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      });
    return () => controller.abort();
  }, [league.key, retry]);
  const teams = data.teams.filter((team) =>
    normalizeSportsSearch(`${team.name} ${team.shortName || ""} ${team.abbr || ""}`).includes(
      normalizeSportsSearch(query),
    ),
  );
  const table = data.standings;
  const individual = isIndividualCompetition(league.group);
  const people = data.athletes ?? [];
  const athletes = people.filter((person) =>
    normalizeSportsSearch(person.name).includes(normalizeSportsSearch(query)),
  );
  const sections = [
    "Overview",
    ...(individual || people.length ? ["Athletes"] : []),
    ...(!individual || data.teams.length ? ["Teams"] : []),
    "Standings",
  ];
  const selectedGroup = table?.groups.find((item) => item.id === group) || table?.groups[0];
  const columns =
    table?.columns.filter((column) => !["rank", "playoffSeed"].includes(column.name)) || [];
  return (
    <ModalShell
      closing={false}
      onDismiss={onClose}
      width={1080}
      labelledBy="league-guide-title"
    >
      <article className="sh-league-guide">
        <header className="sh-league-guide-head">
          <span className="sh-eyebrow">{t("League guide")}</span>
          <button ref={close} className="sh-icon" aria-label={t("Close")} onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <div className="sh-league-guide-body">
          {data.banner && (
            <div className="sh-league-guide-banner">
              <Artwork key={data.banner} src={data.banner} />
            </div>
          )}
          <div className="sh-league-guide-identity">
            <LeagueLogo league={{ ...league, logo: data.logo || league.logo }} size={96} />
            <div>
              <span className="sh-eyebrow">{t("Competition")}</span>
              <h2 id="league-guide-title">{getLeagueLabel(league)}</h2>
              <div className="sh-league-guide-facts">
                {data.country && <span>{data.country}</span>}
                {data.season && (
                  <span>
                    {t("Season")} {data.season}
                  </span>
                )}
                {data.founded && (
                  <span>
                    {t("Founded")} {data.founded}
                  </span>
                )}
                {!!data.teams.length && <span>{t("{n} teams", { n: data.teams.length })}</span>}
                {!!people.length && (
                  <span>{t("sports.guide.athleteCount", { n: people.length })}</span>
                )}
              </div>
            </div>
          </div>
          <div className="sh-league-guide-tabs" role="group" aria-label={t("League sections")}>
            {sections.map((label) => (
              <button key={label} aria-pressed={tab === label} onClick={() => setTab(label)}>
                {t(label === "Athletes" ? "sports.guide.athletes" : label)}
              </button>
            ))}
          </div>
          {status === "loading" && (
            <div className="sh-league-guide-state" role="status">
              <LoaderCircle size={18} className="animate-spin" />
              {t("Loading league details…")}
            </div>
          )}
          {(status === "error" || status === "partial") && (
            <div className="sh-feed-note">
              <span>
                {t(
                  status === "partial"
                    ? "Some league details are unavailable right now."
                    : "League details are unavailable right now.",
                )}
              </span>
              <button className="sh-text-button" onClick={() => setRetry((n) => n + 1)}>
                {t("Retry")}
              </button>
            </div>
          )}
          {tab === "Overview" && (
            <>
              {data.description ? (
                <div className="sh-league-guide-description">
                  {data.description.length > 1100 ? (
                    <>
                      <p>
                        {data.description.slice(0, data.description.lastIndexOf(" ", 1100))}…
                      </p>
                      <details>
                        <summary className="cursor-pointer py-3 font-semibold">
                          {t("Read more")}
                        </summary>
                        <p>
                          {data.description
                            .slice(data.description.lastIndexOf(" ", 1100))
                            .trim()}
                        </p>
                      </details>
                    </>
                  ) : (
                    <p>{data.description}</p>
                  )}
                </div>
              ) : (
                status !== "loading" && (
                  <p className="sh-league-guide-description">
                    {t(
                      individual
                        ? "sports.guide.athleteIntro"
                        : "Browse the published teams and standings, or visit the competition’s official website.",
                    )}
                  </p>
                )
              )}
              {!!people.length && (
                <>
                  <h3 className="mt-6 mb-4">{t("sports.guide.athletes")}</h3>
                  <LeagueGuideAthletes athletes={people.slice(0, 6)} league={league} />
                  {people.length > 6 && (
                    <button className="sh-button mt-4" onClick={() => setTab("Athletes")}>
                      {t("sports.guide.viewAthletes")}
                      <ArrowUpRight size={15} />
                    </button>
                  )}
                </>
              )}
              {!!data.teams.length && (
                <>
                  <h3 className="mt-6 mb-4">{t("Teams")}</h3>
                  <div className="sh-league-guide-teams">
                    {data.teams.slice(0, 6).map((team) => (
                      <div className="sh-league-guide-team" key={team.id}>
                        <TeamProfileLink
                          team={{
                            id: team.id,
                            name: team.name,
                            logo: team.logo,
                            league: league.key,
                            source: data.provider,
                          }}
                        >
                          <Artwork key={team.logo} src={team.logo} sport={league.group} />
                        </TeamProfileLink>
                        <div>
                          <TeamProfileLink
                            team={{
                              id: team.id,
                              name: team.name,
                              logo: team.logo,
                              league: league.key,
                              source: data.provider,
                            }}
                          >
                            <strong>{team.name}</strong>
                          </TeamProfileLink>
                          <small>{team.location || team.country || team.abbr}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                  {data.teams.length > 6 && (
                    <button className="sh-button mt-4" onClick={() => setTab("Teams")}>
                      {t("View all teams")}
                      <ArrowUpRight size={15} />
                    </button>
                  )}
                </>
              )}
            </>
          )}
          {tab === "Athletes" && (
            <>
              <label className="sh-board-search mb-4">
                <Search size={16} />
                <input
                  aria-label={t("sports.guide.searchAthletes")}
                  placeholder={t("sports.guide.searchAthletes")}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setLimit(60);
                  }}
                />
              </label>
              <LeagueGuideAthletes athletes={athletes.slice(0, limit)} league={league} />
              {athletes.length > limit && (
                <button
                  className="sh-button mt-4"
                  onClick={() => setLimit((count) => count + 60)}
                >
                  {t("Show more")}
                </button>
              )}
              {!athletes.length && status !== "loading" && (
                <p className="sh-league-guide-description">
                  {t(people.length ? "sports.guide.noAthleteMatch" : "sports.guide.noAthletes")}
                </p>
              )}
            </>
          )}
          {tab === "Teams" && (
            <>
              <label className="sh-board-search mb-4">
                <Search size={16} />
                <input
                  aria-label={t("Search teams")}
                  placeholder={t("Search teams")}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setLimit(60);
                  }}
                />
              </label>
              <div className="sh-league-guide-teams">
                {teams.slice(0, limit).map((team) => (
                  <div className="sh-league-guide-team" key={team.id}>
                    <TeamProfileLink
                      team={{
                        id: team.id,
                        name: team.name,
                        logo: team.logo,
                        league: league.key,
                        source: data.provider,
                      }}
                    >
                      <Artwork key={team.logo} src={team.logo} sport={league.group} />
                    </TeamProfileLink>
                    <div>
                      <TeamProfileLink
                        team={{
                          id: team.id,
                          name: team.name,
                          logo: team.logo,
                          league: league.key,
                          source: data.provider,
                        }}
                      >
                        <strong>{team.name}</strong>
                      </TeamProfileLink>
                      <small>
                        {[team.location || team.country, team.venue?.name]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                      {(team.website || team.sourceUrl) && (
                        <button
                          className="sh-text-button mt-2 inline-flex items-center gap-1 text-xs"
                          onClick={() => openUrl(team.website || team.sourceUrl!)}
                        >
                          {t(team.website ? "Team website" : "Team profile")}
                          <ArrowUpRight size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {teams.length > limit && (
                <button
                  className="sh-button mt-4"
                  onClick={() => setLimit((count) => count + 60)}
                >
                  {t("Show more")}
                </button>
              )}
              {!teams.length && status !== "loading" && (
                <p className="sh-league-guide-description">
                  {t(
                    data.teams.length
                      ? "No teams match your search."
                      : "A team list has not been published by this feed.",
                  )}
                </p>
              )}
            </>
          )}
          {tab === "Standings" && (
            <>
              {table && (
                <p className="text-xs text-ink-muted mb-4">{table.season || data.season}</p>
              )}
              {table && table.groups.length > 1 && (
                <div
                  className="sh-league-guide-groups"
                  role="group"
                  aria-label={t("Standings groups")}
                >
                  {table.groups.map((item) => (
                    <button
                      key={item.id}
                      aria-pressed={selectedGroup?.id === item.id}
                      onClick={() => setGroup(item.id)}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              )}
              {selectedGroup?.rows.length ? (
                <div
                  className="sh-league-guide-table"
                  role="region"
                  tabIndex={0}
                  aria-label={t("Standings")}
                >
                  <table>
                    <thead>
                      <tr>
                        <th>{t("Position")}</th>
                        <th>
                          {t(
                            selectedGroup.rows.some((row) => row.athlete)
                              ? "sports.guide.athlete"
                              : "Team",
                          )}
                        </th>
                        {columns.map((column) => (
                          <th key={column.name} title={column.label}>
                            {column.abbr || column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedGroup.rows.map((row) => (
                        <tr key={`${row.teamId}:${row.name}`}>
                          <td>{row.rank || "—"}</td>
                          <td>
                            {row.athlete ? (
                              <LeagueGuideAthlete athlete={row.athlete} league={league} />
                            ) : (
                              <TeamProfileLink
                                className="sh-team-table-link"
                                team={{
                                  id: row.teamId,
                                  name: row.name,
                                  logo: row.logo,
                                  league: league.key,
                                  source: data.provider,
                                }}
                              >
                                <Artwork key={row.logo} src={row.logo} />
                                <strong>{row.name}</strong>
                              </TeamProfileLink>
                            )}
                          </td>
                          {columns.map((column) => (
                            <td key={column.name}>
                              {row.cells.find((cell) => cell.name === column.name)?.display ||
                                "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                status !== "loading" && (
                  <p className="sh-league-guide-description">
                    {t("Standings have not been published by this feed.")}
                  </p>
                )
              )}
            </>
          )}
          <footer className="sh-league-guide-links">
            {data.website && (
              <button className="sh-button" onClick={() => openUrl(data.website!)}>
                {t("Competition website")}
                <ArrowUpRight size={15} />
              </button>
            )}
            {data.sourceUrl && (
              <button className="sh-text-button" onClick={() => openUrl(data.sourceUrl!)}>
                {data.provider === "espn" ? "ESPN" : "TheSportsDB"}
                <ArrowUpRight size={14} />
              </button>
            )}
            {data.limited && status !== "loading" && (
              <p className="sh-league-guide-description">
                {t(
                  "This public feed supplies a limited selection of teams and standings. Visit the competition website for complete coverage.",
                )}
              </p>
            )}
            {data.partial && status !== "loading" && (
              <span className="text-xs text-ink-muted self-center">
                {t("Showing the metadata available from this provider.")}
              </span>
            )}
          </footer>
        </div>
      </article>
    </ModalShell>
  );
}
