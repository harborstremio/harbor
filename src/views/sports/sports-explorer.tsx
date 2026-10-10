import { lazy, Suspense, useRef, useState } from "react";
import { ArrowRight, ChevronDown, ExternalLink } from "lucide-react";
import { useT } from "@/lib/i18n";
import { getGroupLabel, getLeagueLabel, type LeagueDef } from "@/lib/sports/espn";
import { HUB_GROUPS, HUB_LEAGUES } from "@/lib/sports/hub-data";
import { normalizeSportsSearch } from "@/lib/sports/search-text";
import { LeagueLogo } from "./league-logo";
import { SportIcon } from "./sport-icon";
import { SportsSelect } from "./sports-select";
import { AUSTRALIAN_COMPETITION_GUIDES } from "@/lib/sports/australian-sports-catalog";
import { openUrl } from "@/lib/window";
import "./league-guide.css";
const Guide = lazy(() =>
  import("./league-guide").then((module) => ({ default: module.LeagueGuide })),
);
// Official directories are browsable, but never enter the schedule fetch queue.
const DIRECTORY_COMPETITIONS: (LeagueDef & { fixturesUrl?: string })[] = [
  ...HUB_LEAGUES,
  ...AUSTRALIAN_COMPETITION_GUIDES.map((guide) => ({
    ...guide,
    labelEn: guide.label,
    tag: guide.key,
    path: "official-directory",
  })),
];
export function SportsExplorer({ onSport }: { onSport: (group: string) => void }) {
  const t = useT();
  const [mode, setMode] = useState("sports");
  const [query, setQuery] = useState("");
  const [sport, setSport] = useState("all");
  const [limit, setLimit] = useState(36);
  const [league, setLeague] = useState<LeagueDef | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const section = useRef<HTMLElement | null>(null);
  const lastSport = useRef("");
  const filtered = DIRECTORY_COMPETITIONS.filter(
    (item) =>
      (mode === "sports" || sport === "all" || item.group === sport) &&
      normalizeSportsSearch(
        `${item.key} ${item.tag} ${getLeagueLabel(item)} ${item.labelEn} ${item.label} ${getGroupLabel(HUB_GROUPS.find((group) => group.key === item.group) || { label: item.group, labelEn: item.group })}`,
      ).includes(normalizeSportsSearch(query)),
  );
  const browseLeagues = (group: string) => {
    lastSport.current = group;
    setSport(group);
    setMode("leagues");
    setLimit(36);
    requestAnimationFrame(() => {
      section.current?.scrollIntoView({ block: "start", behavior: "instant" });
      section.current
        ?.querySelector<HTMLButtonElement>(".sports-select > button")
        ?.focus({ preventScroll: true });
    });
  };
  return (
    <section className="sh-section" ref={section}>
      <div className="sh-section-head">
        <div>
          <h2>{t("Find your next obsession")}</h2>
          <p>{t("From the biggest leagues to a new favorite sport.")}</p>
        </div>
        <input
          className="sh-explore-search"
          placeholder={t("Search sports and leagues")}
          aria-label={t("Search sports and leagues")}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setLimit(36);
          }}
        />
      </div>
      <div className="sh-explore-mode" role="group" aria-label={t("Explore sports")}>
        <button
          aria-pressed={mode === "sports"}
          onClick={() => {
            setMode("sports");
            requestAnimationFrame(() => {
              const target = section.current?.querySelector<HTMLButtonElement>(
                `[data-sport="${lastSport.current}"] .sh-explore-sport-main`,
              );
              target?.focus({ preventScroll: true });
              target?.scrollIntoView({ block: "center", behavior: "instant" });
            });
          }}
        >
          {t("Sports")} · {HUB_GROUPS.length}
        </button>
        <button
          aria-pressed={mode === "leagues"}
          onClick={() => {
            setSport("all");
            setMode("leagues");
          }}
        >
          {t("Leagues")} · {DIRECTORY_COMPETITIONS.length}
        </button>
      </div>
      {mode === "leagues" && (
        <div className="sh-explore-league-toolbar">
          <SportsSelect
            ariaLabel={t("Filter by sport")}
            value={sport}
            onChange={(value) => {
              setSport(value);
              setLimit(36);
            }}
            options={[
              { value: "all", label: t("All sports"), left: <SportIcon name="trophy" size={20} /> },
              ...HUB_GROUPS.map((group) => ({
                value: group.key,
                label: getGroupLabel(group),
                left: <SportIcon name={group.key} size={20} />,
              })),
            ]}
          />
          <span>
            {t("Leagues")} · {filtered.length}
          </span>
          {sport !== "all" && (
            <button className="sh-button" onClick={() => onSport(sport)}>
              {t("Schedule")}
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      )}
      {mode === "sports" ? (
        <div className="sh-explore-grid">
          {HUB_GROUPS.filter((group) => filtered.some((item) => item.group === group.key)).map(
            (group) => {
              const leagues = DIRECTORY_COMPETITIONS.filter((item) => item.group === group.key);
              const featured = leagues
                .filter((item) => item.logo && !/ESPN-icon-|data:image/i.test(item.logo))
                .slice(0, 3);
              return (
                <article className="sh-explore-sport" key={group.key} data-sport={group.key}>
                  <button
                    className="sh-explore-sport-main"
                    onClick={() => browseLeagues(group.key)}
                  >
                    <SportIcon name={group.key} size={32} />
                    <div className="sh-league-art">
                      {featured.map((item) => (
                        <LeagueLogo key={item.key} league={item} size={52} />
                      ))}
                    </div>
                    <strong>{getGroupLabel(group)}</strong>
                    <small>
                      {(featured.length ? featured : leagues)
                        .slice(0, 3)
                        .map(getLeagueLabel)
                        .join(" · ")}
                    </small>
                  </button>
                  <div className="sh-explore-sport-footer">
                    <button
                      onClick={() => browseLeagues(group.key)}
                      aria-label={`${getGroupLabel(group)} · ${t("Leagues")} · ${leagues.length}`}
                    >
                      {t("Leagues")}
                      <span>{leagues.length}</span>
                    </button>
                    <button
                      onClick={() => onSport(group.key)}
                      aria-label={`${getGroupLabel(group)} · ${t("Schedule")}`}
                    >
                      {t("Schedule")}
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </article>
              );
            },
          )}
        </div>
      ) : (
        <>
          <div className="sh-league-directory">
            {filtered.slice(0, limit).map((item) => (
              <button
                className="sh-league-directory-card"
                key={item.key}
                onClick={(event) => {
                  if (item.fixturesUrl) {
                    void openUrl(item.fixturesUrl);
                    return;
                  }
                  trigger.current = event.currentTarget;
                  setLeague(item);
                }}
              >
                <LeagueLogo league={item} size={46} />
                <span>
                  <strong>{getLeagueLabel(item)}</strong>
                  <small>
                    {getGroupLabel(
                      HUB_GROUPS.find((group) => group.key === item.group) || {
                        label: item.group,
                        labelEn: item.group,
                      },
                    )}{" "}
                    ·{" "}
                    {t(
                      item.fixturesUrl
                        ? "Official website"
                        : /^\d+$/.test(item.path)
                          ? "Schedule"
                          : "League guide",
                    )}
                  </small>
                </span>
                {item.fixturesUrl ? <ExternalLink size={16} /> : <ArrowRight size={16} />}
              </button>
            ))}
          </div>
          {filtered.length > limit && (
            <button className="sh-button mt-5" onClick={() => setLimit((count) => count + 36)}>
              {t("Show more")}
              <ChevronDown size={15} />
            </button>
          )}
        </>
      )}
      {!filtered.length && <p className="sh-empty">{t("No leagues match your search.")}</p>}
      <Suspense fallback={null}>
        {league && (
          <Guide
            league={league}
            onClose={() => {
              setLeague(null);
              requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
            }}
          />
        )}
      </Suspense>
    </section>
  );
}
