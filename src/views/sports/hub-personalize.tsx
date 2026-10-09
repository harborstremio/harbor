import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { ModalShell } from "@/components/modal-shell";
import { useT } from "@/lib/i18n";
import { getGroupLabel, getLeagueLabel } from "@/lib/sports/espn";
import { HUB_DEFAULTS, HUB_GROUPS, HUB_LEAGUES } from "@/lib/sports/hub-data";
import {
  cachedLeagueTeams,
  teamCatalogStatus,
  teamCatalogIsPartial,
  fetchLeagueTeams,
  useFavourites,
  writeFavourites,
  type FavouriteTeam,
  type SportsTeam,
} from "@/lib/sports/favourites";
import { SportIcon } from "./sport-icon";
import { LeagueLogo } from "./league-logo";
import { SportsSelect } from "./sports-select";
import { useSettings } from "@/lib/settings";
import { PolymarketLogo } from "./polymarket-logo";
import { matchesTeamSearch, normalizeSportsSearch } from "@/lib/sports/search-text";

export function HubPersonalize({ selected, onClose }: { selected: string[]; onClose: () => void }) {
  const t = useT();
  const { settings, update } = useSettings();
  const fav = useFavourites();
  const [showOdds, setShowOdds] = useState(settings.sportsShowOdds);
  const [step, setStep] = useState(0);
  const [leagues, setLeagues] = useState(selected);
  const [chosenGroups, setChosenGroups] = useState<string[]>([]);
  const [teams, setTeams] = useState<FavouriteTeam[]>(fav.teams);
  const [league, setLeague] = useState(selected[0] || "NFL");
  const [available, setAvailable] = useState<SportsTeam[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [saveError, setSaveError] = useState(false);
  const trigger = useRef(document.activeElement as HTMLElement | null);
  useEffect(
    () => () => {
      trigger.current?.focus({ preventScroll: true });
    },
    [],
  );
  const teamLeagues = HUB_LEAGUES.filter(
    (l) =>
      leagues.includes(l.key) &&
      !["combat", "boxing", "esports", "motorsport", "golf", "tennis"].includes(l.group),
  );
  useEffect(() => {
    if (step !== 2 || !teamLeagues.some((l) => l.key === league)) return;
    let alive = true;
    const cached = cachedLeagueTeams(league);
    setAvailable(cached);
    setLoading(cached.length === 0);
    setError(false);
    fetchLeagueTeams(league, { force: retry > 0 })
      .then((next) => {
        if (alive) {
          setAvailable(next);
          setLoading(false);
          setError(next.length === 0);
        }
      })
      .catch(() => {
        if (alive) {
          setLoading(false);
          setError(cached.length === 0);
        }
      });
    return () => {
      alive = false;
    };
  }, [step, league, retry]);
  function toggle(key: string) {
    setLeagues((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }
  function toggleGroup(group: string) {
    const items = HUB_LEAGUES.filter((l) => l.group === group);
    const on = items.some((l) => leagues.includes(l.key));
    setLeagues((prev) =>
      on
        ? prev.filter((k) => !items.some((l) => l.key === k))
        : [...new Set([...prev, ...items.slice(0, 3).map((l) => l.key)])],
    );
  }
  function save() {
    if (
      !writeFavourites({
        ...fav,
        personalized: true,
        teams,
        leagues,
        home: Object.fromEntries(
          Object.entries(fav.home).filter(([, id]) => teams.some((team) => team.id === id)),
        ),
      })
    ) {
      setSaveError(true);
      return;
    }
    update({ sportsLeagues: leagues, sportsShowOdds: showOdds });
    onClose();
  }
  const next = () => {
    if (step === 0)
      setChosenGroups([
        ...new Set(HUB_LEAGUES.filter((l) => leagues.includes(l.key)).map((l) => l.group)),
      ]);
    if (step === 1) setLeague(teamLeagues[0]?.key || "");
    setStep(step + 1);
    setQuery("");
    setError(false);
  };
  return (
    <ModalShell closing={false} onDismiss={onClose} width={800} labelledBy="sports-setup-title">
      <div className="sh-setup-head">
        <div>
          <span className="sh-eyebrow">
            {t("Make it yours")} · {step + 1}/3
          </span>
          <h2 id="sports-setup-title">
            {t(["Choose your sports", "Pick your leagues", "Follow your teams"][step])}
          </h2>
          <p>
            {t(
              [
                "Keep the sports you follow, or start with popular leagues.",
                "Your selections shape the live and upcoming rows.",
                "Optional. Keep your teams close, wherever they play.",
              ][step],
            )}
          </p>
        </div>
        <button className="sh-icon" aria-label={t("Close")} onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <div className="sh-setup-body">
        {saveError && <p role="alert">{t("Preferences could not be saved. Please try again.")}</p>}
        {step === 0 && (
          <label className="sh-odds-option">
            <span>
              <strong className="sh-odds-option-heading">
                {t("Show market odds")}
                <PolymarketLogo decorative />
              </strong>
              <small>{t("Optional Polymarket prices on event details. Off by default.")}</small>
            </span>
            <input
              type="checkbox"
              checked={showOdds}
              onChange={(event) => setShowOdds(event.target.checked)}
            />
          </label>
        )}
        {step === 0 && (
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              className="sh-button"
              onClick={() => setLeagues([...HUB_DEFAULTS])}
            >
              {t("Use popular leagues")}
            </button>
          </div>
        )}
        {step === 0 && (
          <div className="sh-sport-grid">
            {HUB_GROUPS.map((group) => {
              const on = HUB_LEAGUES.some((l) => l.group === group.key && leagues.includes(l.key));
              return (
                <button
                  key={group.key}
                  className="sh-sport-choice"
                  aria-pressed={on}
                  onClick={() => toggleGroup(group.key)}
                >
                  <SportIcon name={group.key} size={28} />
                  <span>{getGroupLabel(group)}</span>
                  <span className="sh-check">{on && <Check size={16} />}</span>
                </button>
              );
            })}
          </div>
        )}
        {step === 1 && (
          <>
            <label className="sh-search">
              <Search size={18} />
              <input
                placeholder={t("Search leagues")}
                aria-label={t("Search leagues")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div className="sh-league-options">
              {HUB_LEAGUES.filter(
                (l) =>
                  chosenGroups.includes(l.group) &&
                  normalizeSportsSearch(getLeagueLabel(l)).includes(normalizeSportsSearch(query)),
              ).map((l) => (
                <button
                  key={l.key}
                  aria-pressed={leagues.includes(l.key)}
                  onClick={() => toggle(l.key)}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <LeagueLogo league={l} size={24} />
                    <span>{getLeagueLabel(l)}</span>
                  </span>
                  <span className="sh-check">{leagues.includes(l.key) && <Check size={16} />}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {step === 2 && (
          <>
            {teamLeagues.length > 0 ? (
              <>
                <div className="sh-select-label">
                  <span>{t("League")}</span>
                  <SportsSelect
                    ariaLabel={t("League")}
                    value={league}
                    options={teamLeagues.map((l) => ({
                      value: l.key,
                      label: getLeagueLabel(l),
                      left: <LeagueLogo league={l} size={20} />,
                    }))}
                    onChange={(value) => {
                      setLeague(value);
                      setQuery("");
                      setRetry(0);
                    }}
                  />
                </div>
                <label className="sh-search">
                  <Search size={18} />
                  <input
                    placeholder={t("Search teams")}
                    aria-label={t("Search teams")}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                {!loading && !error && available.length > 0 && teamCatalogIsPartial(league) && (
                  <p className="my-3 text-xs text-ink-muted" role="status">
                    {t("This source provides a partial team list.")}
                  </p>
                )}
                {loading ? (
                  <p role="status">{t("Loading teams…")}</p>
                ) : error ? (
                  <div className="sh-empty">
                    <p>
                      {t(
                        teamCatalogStatus(league) === "not-published"
                          ? "Teams will appear when this competition announces its participants."
                          : "Teams are unavailable right now. You can finish setup and try again later.",
                      )}
                    </p>
                    <button className="sh-button" onClick={() => setRetry((n) => n + 1)}>
                      {t("Retry")}
                    </button>
                  </div>
                ) : (
                  <div className="sh-team-grid">
                    {!available.some((team) => matchesTeamSearch(team, query)) && (
                      <p role="status">{t("No teams match that search.")}</p>
                    )}
                    {available
                      .filter((team) => matchesTeamSearch(team, query))
                      .map((team) => {
                        const on = teams.some(
                          (x) => x.id === team.id && x.leagueKey === team.leagueKey,
                        );
                        return (
                          <button
                            key={`${team.leagueKey}:${team.id}`}
                            aria-pressed={on}
                            onClick={() =>
                              setTeams((prev) =>
                                on
                                  ? prev.filter(
                                      (x) => x.id !== team.id || x.leagueKey !== team.leagueKey,
                                    )
                                  : [...prev, team],
                              )
                            }
                          >
                            <TeamBadge team={team} />
                            <span>{team.name}</span>
                            <span className="sh-check">{on && <Check size={16} />}</span>
                          </button>
                        );
                      })}
                  </div>
                )}
              </>
            ) : (
              <p>{t("Your selected sports are organized by events. You are ready to go.")}</p>
            )}
            {teams.length > 0 && (
              <div className="sh-following">
                <span>{t("Following")}</span>
                {teams.map((team) => (
                  <button
                    key={`${team.leagueKey}:${team.id}`}
                    onClick={() => setTeams((prev) => prev.filter((x) => x !== team))}
                  >
                    {team.name}
                    <X size={12} />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <div className="sh-setup-foot">
        <button
          className="sh-button"
          onClick={
            step > 0
              ? () => {
                  setStep(step - 1);
                  setError(false);
                }
              : onClose
          }
        >
          {step > 0 && <ChevronLeft size={16} />} {t(step > 0 ? "Back" : "Cancel")}
        </button>
        <span>{t("{n} leagues selected", { n: leagues.length })}</span>
        <button className="sh-button primary" onClick={step === 2 || !leagues.length ? save : next}>
          {t(step === 2 || !leagues.length ? "Save preferences" : "Continue")}{" "}
          {step < 2 && leagues.length > 0 && <ChevronRight size={16} />}
        </button>
      </div>
    </ModalShell>
  );
}

function TeamBadge({ team }: { team: SportsTeam }) {
  const [failed, setFailed] = useState(false);
  if (team.logo && !failed)
    return <img src={team.logo} loading="lazy" alt="" onError={() => setFailed(true)} />;
  return (
    <span className="sh-team-badge-fallback" aria-hidden="true">
      {team.abbr || team.shortName.slice(0, 3)}
    </span>
  );
}
