import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, LoaderCircle, Search, Shield, Trophy } from "lucide-react";
import { ModalShell } from "@/components/modal-shell";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import {
  fetchTeamProfile,
  type TeamIdentity,
  type TeamProfileData,
} from "@/lib/sports/team-profile";
import { hubLeague } from "@/lib/sports/hub-data";
import { getLeagueLabel } from "@/lib/sports/espn";
import { AthleteProfile } from "./athlete-profile";
import { LeagueLogo } from "./league-logo";
import { TeamLinkIcon, TeamFactValue } from "./team-profile-details";
import "./team-profile.css";

function TeamImage({ src, player = false }: { src?: string; player?: boolean }) {
  const [failed, setFailed] = useState("");
  return src && failed !== src ? (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      className={player ? "is-player" : ""}
      onError={() => setFailed(src)}
    />
  ) : (
    <Shield aria-hidden size={player ? 24 : 48} />
  );
}

export function TeamProfile({ team, onClose }: { team: TeamIdentity; onClose: () => void }) {
  const t = useT(),
    locale = useUiLanguage(),
    titleId = useId();
  const [data, setData] = useState<TeamProfileData | null>(null);
  const [loading, setLoading] = useState(true),
    [failed, setFailed] = useState(false),
    [retry, setRetry] = useState(0);
  const [tab, setTab] = useState("Overview"),
    [query, setQuery] = useState(""),
    [limit, setLimit] = useState(60);
  const [athlete, setAthlete] = useState<TeamProfileData["roster"][number] | null>(null);
  const back = useRef<HTMLButtonElement>(null),
    body = useRef<HTMLDivElement>(null),
    playerTrigger = useRef<HTMLElement | null>(null);
  const league = hubLeague(team.league);
  useEffect(() => {
    back.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    fetchTeamProfile(team, controller.signal, retry > 0)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [team.id, team.league, team.name, team.source, retry]);
  const roster = (data?.roster ?? []).filter((player) =>
    `${player.name} ${player.position ?? ""} ${player.jersey ?? ""}`
      .toLocaleLowerCase(locale)
      .includes(query.toLocaleLowerCase(locale)),
  );
  const links =
    data?.links.filter((link) =>
      ["Official website", "Facebook", "Instagram", "X", "YouTube"].includes(link.label),
    ) ?? [];
  const sources = [
    ...new Map((data?.sourceUrls ?? []).map((url) => [new URL(url).hostname, url])).values(),
  ];
  return (
    <ModalShell closing={false} onDismiss={onClose} width={1100} labelledBy={titleId}>
      <article
        className="sh-team-profile"
        onKeyDown={(event) => {
          if (event.key !== "Tab" || athlete) return;
          const buttons = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input:not(:disabled), a[href], [tabindex="0"]',
            ),
          ).filter((node) => node.getClientRects().length > 0);
          const first = buttons[0],
            last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <header className="sh-team-profile-header">
          <button ref={back} className="sh-button" onClick={onClose}>
            <ArrowLeft size={16} />
            {t("Back")}
          </button>
          <span>{t("Team profile")}</span>
        </header>
        <div className="sh-team-profile-intro">
          <span className="sh-team-profile-crest">
            <TeamImage src={data?.logo || team.logo} />
          </span>
          <div>
            <h2 id={titleId}>{data?.name || team.name}</h2>
            {league && (
              <p>
                <LeagueLogo league={league} size={22} />
                {getLeagueLabel(league)}
              </p>
            )}
            {!!links.length && (
              <div className="sh-team-profile-links">
                {links.map((link) => (
                  <button key={link.url} onClick={() => openUrl(link.url)}>
                    <TeamLinkIcon label={link.label} />
                    {t(link.label)}
                    <ArrowUpRight size={12} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <nav className="sh-team-profile-tabs" aria-label={t("Team profile")}>
          {["Overview", "Roster", "Statistics", "Results", "Honors"].map((label) => (
            <button
              key={label}
              aria-pressed={label === tab}
              onClick={() => {
                setTab(label);
                body.current?.scrollTo({ top: 0 });
              }}
            >
              {t(label)}
            </button>
          ))}
        </nav>
        <div className="sh-team-profile-body" ref={body}>
          {loading && (
            <div className="sh-team-profile-loading" role="status">
              <LoaderCircle size={20} />
              {t("Loading team details…")}
            </div>
          )}
          {(failed || data?.partial) && !loading && (
            <div className="sh-team-profile-note">
              <span>
                {t(
                  failed
                    ? "Team details could not be loaded."
                    : "Some team details could not be loaded.",
                )}
              </span>
              <button className="sh-button" onClick={() => setRetry((value) => value + 1)}>
                {t("Retry")}
              </button>
            </div>
          )}
          {tab === "Overview" && (
            <>
              {!!data?.facts.length && (
                <dl className="sh-team-profile-facts">
                  {data.facts.map((fact, index) => (
                    <div key={`${fact.label}:${index}`}>
                      <dt>{t(fact.label)}</dt>
                      <dd>
                        <TeamFactValue label={fact.label} value={fact.value} />
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {data?.description && (
                <section>
                  <h3>{t("About the team")}</h3>
                  <p className="sh-team-profile-description">{data.description}</p>
                </section>
              )}
              {!loading && !data?.description && !data?.facts.length && (
                <p className="sh-team-profile-empty">
                  {t("Team history has not been published by this source.")}
                </p>
              )}
            </>
          )}
          {tab === "Roster" && (
            <>
              {data?.rosterLimited && (
                <p className="sh-team-profile-empty">
                  {t("This source may provide a partial roster.")}
                </p>
              )}
              <label className="sh-team-profile-search">
                <Search size={16} />
                <input
                  aria-label={t("Search players")}
                  placeholder={t("Search players")}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setLimit(60);
                  }}
                />
              </label>
              <div className="sh-team-profile-roster">
                {roster.slice(0, limit).map((player, index) => (
                  <button
                    key={`${player.id}:${index}`}
                    disabled={!player.id && !player.profileUrl}
                    onClick={(event) => {
                      playerTrigger.current = event.currentTarget;
                      setAthlete(player);
                    }}
                  >
                    <TeamImage src={player.image} player />
                    <span>
                      <strong>{player.name}</strong>
                      <small>
                        {[player.position, player.jersey ? `#${player.jersey}` : ""]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    </span>
                    <ArrowUpRight size={15} />
                  </button>
                ))}
              </div>
              {roster.length > limit && (
                <button className="sh-button" onClick={() => setLimit((value) => value + 60)}>
                  {t("Show more")}
                </button>
              )}
              {!loading && !roster.length && (
                <p className="sh-team-profile-empty">
                  {t(
                    query
                      ? "No players match your search."
                      : "A roster has not been published by this source.",
                  )}
                </p>
              )}
            </>
          )}
          {tab === "Statistics" && (
            <>
              {data?.statistics.length ? (
                <dl className="sh-team-profile-facts">
                  {data.statistics.map((stat, index) => (
                    <div key={`${stat.label}:${index}`}>
                      <dt>{stat.label}</dt>
                      <dd>{stat.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                !loading && (
                  <p className="sh-team-profile-empty">
                    {t("Team statistics have not been published by this source.")}
                  </p>
                )
              )}
            </>
          )}
          {tab === "Results" && (
            <>
              {data?.events.map((event, index) => (
                <div className="sh-team-profile-event" key={`${event.id}:${index}`}>
                  <span>
                    <strong>{event.name}</strong>
                    <small>
                      {[
                        event.date
                          ? new Date(event.date).toLocaleDateString(locale, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "",
                        event.status,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </span>
                  <b>{event.score}</b>
                  {event.sourceUrl && (
                    <button
                      className="sh-icon"
                      aria-label={event.name}
                      onClick={() => openUrl(event.sourceUrl!)}
                    >
                      <ArrowUpRight size={16} />
                    </button>
                  )}
                </div>
              ))}
              {!loading && !data?.events.length && (
                <p className="sh-team-profile-empty">
                  {t("Results have not been published by this source.")}
                </p>
              )}
            </>
          )}
          {tab === "Honors" && (
            <>
              {data?.honors.map((honor, index) => (
                <section className="sh-team-profile-honor" key={`${honor.title}:${index}`}>
                  <Trophy size={22} />
                  <div>
                    <h3>{t(honor.title)}</h3>
                    {honor.season && <small>{honor.season}</small>}
                    {honor.detail && <p>{honor.detail}</p>}
                    {honor.sourceUrl && (
                      <button className="sh-text-button" onClick={() => openUrl(honor.sourceUrl!)}>
                        {t("Source")}
                        <ArrowUpRight size={13} />
                      </button>
                    )}
                  </div>
                </section>
              ))}
              {!loading && !data?.honors.length && (
                <p className="sh-team-profile-empty">
                  {t("Honors have not been published by this source.")}
                </p>
              )}
            </>
          )}
          {!!sources.length && (
            <footer className="sh-team-profile-sources">
              <span>{t("Sources")}</span>
              {sources.map((url) => (
                <button key={url} onClick={() => openUrl(url)}>
                  {new URL(url).hostname.replace(/^www\./, "")}
                  <ArrowUpRight size={12} />
                </button>
              ))}
            </footer>
          )}
        </div>
      </article>
      {athlete && (
        <AthleteProfile
          athlete={athlete}
          league={team.league}
          onClose={() => {
            setAthlete(null);
            playerTrigger.current?.focus({ preventScroll: true });
          }}
        />
      )}
    </ModalShell>
  );
}
