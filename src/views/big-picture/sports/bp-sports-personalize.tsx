import { useEffect, useMemo, useRef, useState } from "react";
import { useSettings } from "@/lib/settings";
import { getGroupLabel, getLeagueLabel } from "@/lib/sports/espn";
import { HUB_DEFAULTS, HUB_GROUPS, HUB_LEAGUES } from "@/lib/sports/hub-data";
import {
  cachedLeagueTeams,
  fetchLeagueTeams,
  teamCatalogIsPartial,
  teamCatalogStatus,
  useFavourites,
  writeFavourites,
  type FavouriteTeam,
  type SportsTeam,
} from "@/lib/sports/favourites";
import { selectedSportsLeagues } from "@/lib/sports/personalization";
import { pushBpBack } from "../bp-back";
import { BpGrid } from "../bp-grid";
import { useBpT } from "../bp-i18n";
import { BpChip, BpChipRow } from "../bp-library-chips";
import {
  BP_ROW_FLUSH,
  BpDecisionAction,
  BpDecisionNote,
  BpDecisionRow,
} from "../onboarding/bp-step-parts";
import { setBpFocus } from "../use-bp-focus";
import { BP_PICK_MARK_SIZE, BpPickMark, bpPickLeagueMark } from "./bp-sports-pick-mark";
import { BpPickTile } from "./bp-sports-pick-tile";

const EVENT_GROUPS = ["combat", "boxing", "esports", "motorsport", "golf", "tennis"];
const TITLES = ["Choose your sports", "Pick your leagues", "Follow your teams"];
const NOTES = [
  "Keep the sports you follow, or start with popular leagues.",
  "Your selections shape the live and upcoming rows.",
  "Optional. Keep your teams close, wherever they play.",
];
const PAGE =
  "flex h-full flex-col gap-[clamp(10px,1.4vh,22px)] px-[var(--bp-gutter)] pt-[var(--bp-page-top)] pb-[var(--bp-hint-h)]";
const SCROLL =
  "relative -mx-[14px] min-h-0 flex-1 overflow-y-auto overscroll-contain px-[14px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
const EYEBROW =
  "text-[calc(clamp(10px,1.3vh,15px)*var(--bp-up,1))] font-bold uppercase tracking-[0.2em] text-ink-subtle";
const TITLE =
  "font-display text-[calc(clamp(24px,3.9vh,48px)*var(--bp-up,1))] font-semibold leading-[1.05] tracking-[-0.02em] text-ink";
const LEAD = "text-[calc(clamp(13px,1.8vh,21px)*var(--bp-up,1))] leading-[1.5] text-ink-muted";
const ROW = { ...BP_ROW_FLUSH, containIntrinsicSize: "auto 80px" } as const;
const SPORT_COLUMNS = "repeat(auto-fill, minmax(clamp(132px, 10.5vw, 206px), 1fr))";
const LIST_COLUMNS = "repeat(auto-fill, minmax(clamp(150px, 12.5vw, 250px), 1fr))";
export function BpSportsPersonalize({ onClose }: { onClose: () => void }) {
  const t = useBpT();
  const { settings, update } = useSettings();
  const fav = useFavourites();
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const saved = useMemo(
    () =>
      selectedSportsLeagues(HUB_LEAGUES, settings.sportsLeagues, !!fav.personalized, HUB_DEFAULTS),
    [settings.sportsLeagues, fav.personalized],
  );
  const [step, setStep] = useState(0);
  const [leagues, setLeagues] = useState<string[]>(saved);
  const [chosenGroups, setChosenGroups] = useState<string[]>([]);
  const [teams, setTeams] = useState<FavouriteTeam[]>(fav.teams);
  const [league, setLeague] = useState(saved[0] || "NFL");
  const [available, setAvailable] = useState<SportsTeam[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [saveError, setSaveError] = useState(false);

  const groups = useMemo(() => [...new Map(HUB_GROUPS.map((g) => [g.key, g])).values()], []);
  const teamLeagues = useMemo(
    () => HUB_LEAGUES.filter((l) => leagues.includes(l.key) && !EVENT_GROUPS.includes(l.group)),
    [leagues],
  );
  const stepLeagues = useMemo(
    () => HUB_LEAGUES.filter((l) => chosenGroups.includes(l.group)),
    [chosenGroups],
  );

  useEffect(() => {
    const el = bodyRef.current?.querySelector<HTMLElement>("[data-bp-focusable]");
    if (el) setBpFocus(el, { silent: true });
  }, [step]);

  useEffect(
    () =>
      pushBpBack(() => {
        if (step > 0) {
          setStep(step - 1);
          return true;
        }
        onClose();
        return true;
      }),
    [step, onClose],
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
        if (!alive) return;
        setAvailable(next);
        setLoading(false);
        setError(next.length === 0);
      })
      .catch(() => {
        if (!alive) return;
        setLoading(false);
        setError(cached.length === 0);
      });
    return () => {
      alive = false;
    };
  }, [step, league, retry, teamLeagues]);

  const toggleGroup = (group: string) => {
    const items = HUB_LEAGUES.filter((l) => l.group === group);
    const on = items.some((l) => leagues.includes(l.key));
    setLeagues((prev) =>
      on
        ? prev.filter((k) => !items.some((l) => l.key === k))
        : [...new Set([...prev, ...items.slice(0, 3).map((l) => l.key)])],
    );
  };

  const toggleLeague = (key: string) =>
    setLeagues((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const toggleTeam = (team: SportsTeam) =>
    setTeams((prev) =>
      prev.some((x) => x.id === team.id && x.leagueKey === team.leagueKey)
        ? prev.filter((x) => x.id !== team.id || x.leagueKey !== team.leagueKey)
        : [...prev, team],
    );

  const advance = () => {
    if (step === 0) {
      setChosenGroups([
        ...new Set(HUB_LEAGUES.filter((l) => leagues.includes(l.key)).map((l) => l.group)),
      ]);
    }
    if (step === 1) setLeague(teamLeagues[0]?.key || "");
    setStep(step + 1);
  };

  const save = () => {
    const written = writeFavourites({
      ...fav,
      personalized: true,
      teams,
      leagues,
      home: Object.fromEntries(
        Object.entries(fav.home).filter(([, id]) => teams.some((team) => team.id === id)),
      ),
    });
    if (!written) {
      setSaveError(true);
      return;
    }
    update({ sportsLeagues: leagues });
    onClose();
  };

  const last = step === 2 || leagues.length === 0;

  return (
    <div className={PAGE}>
      <div className="flex shrink-0 flex-col gap-[clamp(2px,0.4vh,7px)]">
        <span className={EYEBROW}>{`${t("Make it yours")} ${step + 1}/3`}</span>
        <h1 className={TITLE}>{t(TITLES[step])}</h1>
        <p className={LEAD}>{t(NOTES[step])}</p>
      </div>

      <div ref={bodyRef} data-bp-scroll-y className={SCROLL}>
        {step === 0 && (
          <>
            <div data-bp-row style={ROW} className="shrink-0 pt-[14px]">
              <BpDecisionAction
                label={t("Use popular leagues")}
                tone="quiet"
                onSelect={() => setLeagues([...HUB_DEFAULTS])}
              />
            </div>
            <BpGrid columns={SPORT_COLUMNS}>
              {groups.map((group) => (
                <BpPickTile
                  key={group.key}
                  restoreKey={`sports-pick-group:${group.key}`}
                  label={getGroupLabel(group)}
                  mark={<BpPickMark sport={group.key} size={BP_PICK_MARK_SIZE} />}
                  on={HUB_LEAGUES.some((l) => l.group === group.key && leagues.includes(l.key))}
                  onSelect={() => toggleGroup(group.key)}
                />
              ))}
            </BpGrid>
          </>
        )}

        {step === 1 && (
          <BpGrid columns={LIST_COLUMNS}>
            {stepLeagues.map((l) => (
              <BpPickTile
                key={l.key}
                restoreKey={`sports-pick-league:${l.key}`}
                label={getLeagueLabel(l)}
                mark={bpPickLeagueMark(l, BP_PICK_MARK_SIZE)}
                on={leagues.includes(l.key)}
                onSelect={() => toggleLeague(l.key)}
              />
            ))}
          </BpGrid>
        )}

        {step === 2 && teamLeagues.length === 0 && (
          <p className={`${LEAD} pt-[14px]`}>
            {t("Your selected sports are organized by events. You are ready to go.")}
          </p>
        )}

        {step === 2 && teamLeagues.length > 0 && (
          <>
            <span className={`${EYEBROW} block pt-[14px]`}>{t("League")}</span>
            <BpChipRow flush>
              {teamLeagues.map((l) => (
                <BpChip
                  key={l.key}
                  label={getLeagueLabel(l)}
                  selected={l.key === league}
                  icon={bpPickLeagueMark(l, "clamp(22px, 2.6vh, 30px)")}
                  onSelect={() => {
                    setLeague(l.key);
                    setRetry(0);
                  }}
                />
              ))}
            </BpChipRow>
            {loading && <p className={`${LEAD} pt-[14px]`}>{t("Loading teams…")}</p>}
            {!loading && error && (
              <div className="flex flex-col items-start gap-[clamp(9px,1.2vh,18px)] pt-[14px]">
                <p className={LEAD}>
                  {t(
                    teamCatalogStatus(league) === "not-published"
                      ? "Teams will appear when this competition announces its participants."
                      : "Teams are unavailable right now. You can finish setup and try again later.",
                  )}
                </p>
                <BpDecisionRow>
                  <BpDecisionAction
                    label={t("Retry")}
                    tone="quiet"
                    onSelect={() => setRetry((n) => n + 1)}
                  />
                </BpDecisionRow>
              </div>
            )}
            {!loading && !error && teamCatalogIsPartial(league) && (
              <p className={`${LEAD} pt-[clamp(4px,0.6vh,9px)]`}>
                {t("This source provides a partial team list.")}
              </p>
            )}
            {!loading && !error && (
              <BpGrid columns={LIST_COLUMNS}>
                {available.map((team) => (
                  <BpPickTile
                    key={`${team.leagueKey}:${team.id}`}
                    restoreKey={`sports-pick-team:${team.leagueKey}:${team.id}`}
                    label={team.name}
                    mark={
                      <BpPickMark
                        logo={team.logo}
                        text={team.abbr || team.shortName.slice(0, 3)}
                        size={BP_PICK_MARK_SIZE}
                      />
                    }
                    on={teams.some((x) => x.id === team.id && x.leagueKey === team.leagueKey)}
                    onSelect={() => toggleTeam(team)}
                  />
                ))}
              </BpGrid>
            )}
          </>
        )}
      </div>

      <BpDecisionRow>
        <BpDecisionAction
          label={step > 0 ? t("Back") : t("Cancel")}
          tone="quiet"
          onSelect={() => (step > 0 ? setStep(step - 1) : onClose())}
        />
        <BpDecisionAction
          label={last ? t("Save preferences") : t("Continue")}
          onSelect={last ? save : advance}
        />
      </BpDecisionRow>

      <BpDecisionNote
        text={
          saveError
            ? t("Preferences could not be saved. Please try again.")
            : t("{leagues} leagues selected, {teams} teams followed", {
                leagues: leagues.length,
                teams: teams.length,
              })
        }
        alert={saveError}
      />
    </div>
  );
}
