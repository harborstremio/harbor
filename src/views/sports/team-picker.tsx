import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { House, Search, Star, X } from "lucide-react";
import { useT, useUiLanguage } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { DEFAULT_SPORTS_LEAGUES, getLeagueLabel } from "@/lib/sports/espn";
import {
  clearFavouriteTeams,
  fetchLeagueTeams,
  isHomeTeam,
  isLeagueFavourite,
  isTeamFavourite,
  leagueOf,
  setHomeTeam,
  teamsInLeague,
  toggleFavouriteLeague,
  toggleFavouriteTeam,
  useFavourites,
  type FavouriteTeam,
  type SportsFavourites,
  type SportsTeam,
} from "@/lib/sports/favourites";

function asFavourite(team: SportsTeam): FavouriteTeam {
  const { id, leagueKey, group, name, abbr, logo } = team;
  return { id, leagueKey, group, name, abbr, logo };
}

function columnsFor(width: number): number {
  if (width >= 1080) return 8;
  if (width >= 820) return 6;
  if (width >= 560) return 5;
  return 4;
}

export function TeamPicker({ leagueKeys, onClose }: { leagueKeys?: string[]; onClose: () => void }) {
  const t = useT();
  useUiLanguage();
  const { settings } = useSettings();
  const fav = useFavourites();
  const [query, setQuery] = useState("");
  const [byLeague, setByLeague] = useState<Record<string, SportsTeam[]>>({});
  const [loading, setLoading] = useState(true);
  const [cols, setCols] = useState(6);
  const bodyRef = useRef<HTMLDivElement>(null);

  const chosen = settings.sportsLeagues?.length ? settings.sportsLeagues : DEFAULT_SPORTS_LEAGUES;
  const keySig = (leagueKeys?.length ? leagueKeys : chosen).join(",");
  const keys = useMemo(() => keySig.split(",").filter(Boolean), [keySig]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(keys.map((k) => fetchLeagueTeams(k).then((teams) => [k, teams] as const)))
      .then((pairs) => {
        if (cancelled) return;
        const next: Record<string, SportsTeam[]> = {};
        for (const [k, teams] of pairs) if (teams.length) next[k] = teams;
        setByLeague(next);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [keys]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setCols(columnsFor(el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const needle = query.trim().toLowerCase();
  const sections = useMemo(
    () =>
      keys
        .map((key) => {
          const all = byLeague[key] ?? [];
          const teams = needle
            ? all.filter((x) => `${x.name} ${x.shortName} ${x.abbr}`.toLowerCase().includes(needle))
            : all;
          return { key, teams };
        })
        .filter((s) => s.teams.length > 0),
    [keys, byLeague, needle],
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[170] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="animate-modal-in flex max-h-[86vh] w-full max-w-[1120px] flex-col overflow-hidden rounded-lg border border-edge-soft bg-elevated shadow-[0_24px_60px_-18px_rgba(0,0,0,0.7)]">
        <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[14px] font-semibold tracking-tight text-ink">{t("Your teams")}</h2>
            <p className="text-[11.5px] text-ink-subtle">
              {fav.teams.length > 0
                ? t("{n} followed", { n: fav.teams.length })
                : t("Follow a club to pin its fixtures and results")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Close")}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-raised hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2 px-5 pb-3">
          <div className="relative flex-1">
            <Search size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Search teams")}
              className="h-10 w-full rounded-lg bg-canvas ps-9 pe-3 text-[13px] text-ink ring-1 ring-inset ring-edge-soft transition-colors placeholder:text-ink-subtle focus:outline-none focus:ring-accent/50"
            />
          </div>
          {fav.teams.length > 0 && (
            <button
              type="button"
              onClick={() => clearFavouriteTeams()}
              className="h-10 shrink-0 rounded-lg bg-raised px-3.5 text-[12.5px] font-medium text-ink-muted transition-colors hover:text-ink"
            >
              {t("Clear all")}
            </button>
          )}
        </div>

        <div ref={bodyRef} className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 pb-5">
          {loading && sections.length === 0 ? (
            <SkeletonGrid cols={cols} />
          ) : sections.length === 0 ? (
            <p className="py-16 text-center text-[13px] text-ink-subtle">
              {needle ? t("No teams match that search.") : t("No teams available for these competitions yet.")}
            </p>
          ) : (
            sections.map((section) => (
              <LeagueSection key={section.key} leagueKey={section.key} teams={section.teams} cols={cols} fav={fav} />
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SkeletonGrid({ cols }: { cols: number }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
      {Array.from({ length: cols * 2 }, (_, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <div className="aspect-square rounded-lg bg-raised/40" />
          <div className="mx-auto h-2.5 w-3/5 rounded-full bg-raised/40" />
        </div>
      ))}
    </div>
  );
}

function LeagueSection({
  leagueKey,
  teams,
  cols,
  fav,
}: {
  leagueKey: string;
  teams: SportsTeam[];
  cols: number;
  fav: SportsFavourites;
}) {
  const t = useT();
  const def = leagueOf(leagueKey);
  const pinned = isLeagueFavourite(fav, leagueKey);
  const followed = teamsInLeague(fav, leagueKey).length;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        {def?.logo && <img src={def.logo} alt="" draggable={false} className="h-5 w-5 shrink-0 object-contain" />}
        <h3 className="text-[13px] font-semibold text-ink">{def ? getLeagueLabel(def) : leagueKey}</h3>
        <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-raised px-1 text-[10px] font-bold tabular-nums text-ink-subtle">
          {teams.length}
        </span>
        {followed > 0 && (
          <span className="text-[11px] tabular-nums text-ink-subtle">{t("{n} followed", { n: followed })}</span>
        )}
        <button
          type="button"
          onClick={() => toggleFavouriteLeague(leagueKey)}
          title={pinned ? t("Unpin this competition") : t("Pin this competition")}
          className={`ms-auto flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-medium transition-colors ${
            pinned ? "bg-raised text-ink" : "bg-raised/60 text-ink-subtle hover:bg-raised hover:text-ink"
          }`}
        >
          <Star size={12} fill={pinned ? "currentColor" : "none"} />
          {pinned ? t("Pinned") : t("Pin")}
        </button>
      </div>
      <div className="harbor-cascade grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
        {teams.map((team) => (
          <ClubCard
            key={team.id}
            team={team}
            favourite={isTeamFavourite(fav, team.leagueKey, team.id)}
            home={isHomeTeam(fav, team)}
          />
        ))}
      </div>
    </section>
  );
}

function ClubCard({ team, favourite, home }: { team: SportsTeam; favourite: boolean; home: boolean }) {
  const t = useT();
  const [err, setErr] = useState(false);
  const [pop, setPop] = useState(false);

  const toggle = () => {
    if (toggleFavouriteTeam(asFavourite(team))) setPop(true);
  };

  return (
    <div className="group flex min-w-0 flex-col gap-1.5">
      <button
        type="button"
        onClick={toggle}
        title={favourite ? t("Remove from your teams") : t("Add to your teams")}
        className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-raised/60 ring-1 ring-inset ring-edge-soft transition-colors hover:bg-raised"
      >
        {team.logo && !err ? (
          <img
            src={team.logo}
            alt=""
            draggable={false}
            loading="lazy"
            onError={() => setErr(true)}
            className="h-full w-full object-contain p-[19%]"
          />
        ) : (
          <span className="text-[15px] font-bold uppercase tracking-[0.04em] text-ink-subtle">
            {team.abbr || team.shortName.slice(0, 3)}
          </span>
        )}
        <span
          onAnimationEnd={() => setPop(false)}
          className={`absolute start-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-150 ${pop ? "harbor-pop" : ""} ${
            favourite
              ? "bg-accent text-canvas"
              : "bg-canvas/70 text-ink-subtle opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
          }`}
        >
          <Star size={13} fill={favourite ? "currentColor" : "none"} />
        </span>
      </button>
      <div className="flex min-w-0 items-center justify-center gap-1">
        <span className="truncate text-center text-[11px] font-medium text-ink-muted group-hover:text-ink">
          {team.shortName}
        </span>
        {favourite && (
          <button
            type="button"
            onClick={() => setHomeTeam(asFavourite(team))}
            title={home ? t("Clear home team") : t("Set as home team")}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${
              home ? "bg-ink text-canvas" : "text-ink-subtle hover:bg-raised hover:text-ink"
            }`}
          >
            <House size={10} />
          </button>
        )}
      </div>
    </div>
  );
}
