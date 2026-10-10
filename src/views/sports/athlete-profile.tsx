import { createContext, useEffect, useRef, useState } from "react";
import { formatStatValue } from "@/lib/sports/stat-format";
import { useAthletePortrait } from "./use-athlete-portrait";
import { ArrowLeft, ArrowUpRight, UserRound } from "lucide-react";
import { ModalShell } from "@/components/modal-shell";
import { useT, useUiLanguage } from "@/lib/i18n";
import { safeFetch } from "@/lib/safe-fetch";
import { openUrl } from "@/lib/window";
import { hubLeague } from "@/lib/sports/hub-data";
import { fetchSoccerCareer } from "@/lib/sports/athlete-soccer";
import { fetchAthleteCareer, type AthleteCareerCategory } from "@/lib/sports/athlete-career";
import {
  athleteImageUrl,
  fetchSportsDbAthleteBio,
  parseEspnAthleteBio,
  type AthleteSource,
} from "@/lib/sports/athlete-identity";
import { LeagueLogo } from "./league-logo";
import "./athlete-profile.css";
import { AthleteVideos } from "./athlete-videos";

export type AthleteIdentity = {
  id: string;
  name: string;
  image?: string;
  logo?: string;
  source?: AthleteSource;
};
export const SportsAthleteLeagueContext = createContext("");
type Profile = {
  name: string;
  image: string;
  bio: string[];
  summaryTitle: string;
  summary: { name: string; value: string }[];
  categories: AthleteCareerCategory[];
  statsFailed: boolean;
  team?: { name: string; logo: string };
  recordUrl?: string;
};
const cache = new Map<string, { at: number; data: Profile }>();
export function AthleteProfileLink({
  athlete,
  league,
  label,
  inline = false,
}: {
  athlete: AthleteIdentity;
  league: string;
  label?: string;
  inline?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={button}
        type="button"
        className={`sh-athlete-link${inline ? " is-inline" : ""}`}
        onClick={() => setOpen(true)}
      >
        {label || t("Career profile")}
        <ArrowUpRight size={15} />
      </button>
      {open && (
        <AthleteProfile
          athlete={athlete}
          league={league}
          onClose={() => {
            setOpen(false);
            button.current?.focus({ preventScroll: true });
          }}
        />
      )}
    </>
  );
}
export function AthleteProfile({
  athlete,
  league,
  onClose,
}: {
  athlete: AthleteIdentity;
  league: string;
  onClose: () => void;
}) {
  const t = useT();
  const locale = useUiLanguage();
  const def = hubLeague(league);
  const path = def?.group === "soccer" ? "soccer/all" : def?.path || "";
  const provider = athlete.source ?? "espn";
  const key = `${provider}:${def?.path || path}:${athlete.id}`;
  const [profile, setProfile] = useState<{ key: string; data: Profile } | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  const [failed, setFailed] = useState(false);
  const backButton = useRef<HTMLButtonElement>(null);
  const resolved = useAthletePortrait(
    {
      path: def?.path || path,
      group: def?.group,
      id: athlete.id,
      name: athlete.name,
      image: athlete.image,
    },
    true,
  );
  useEffect(() => {
    backButton.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    setBroken(new Set());
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < (hit.data.statsFailed ? 60_000 : 3_600_000)) {
      setProfile({ key, data: hit.data });
      setLoading(false);
      return;
    }
    if (provider === "thesportsdb") {
      void fetchSportsDbAthleteBio(athlete.id, def?.group || "", controller.signal)
        .then((bio) => {
          if (controller.signal.aborted) return;
          if (bio) {
            const data: Profile = {
              ...bio,
              summaryTitle: "Stats",
              summary: [],
              categories: [],
              statsFailed: false,
            };
            cache.set(key, { at: Date.now(), data });
            while (cache.size > 30) cache.delete(cache.keys().next().value!);
            setProfile({ key, data });
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) setFailed(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
      return () => controller.abort();
    }
    if (provider !== "espn" || !/^\d+$/.test(athlete.id) || !path.includes("/")) {
      setLoading(false);
      return;
    }
    const base = `https://site.web.api.espn.com/apis/common/v3/sports/${path}/athletes/${athlete.id}`;
    const json = async (url: string) => {
      const response = await safeFetch(url, {
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(9000)]),
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("Athlete feed unavailable");
      return response.json();
    };
    const bioRequest = json(base).then((raw) => {
      if (raw?.athlete && String(raw.athlete.id) !== athlete.id)
        throw new Error("Athlete identity mismatch");
      return raw;
    });
    void Promise.allSettled([
      bioRequest,
      def?.group === "soccer"
        ? fetchSoccerCareer(def.path, athlete.id, controller.signal)
        : fetchAthleteCareer(path, athlete.id, controller.signal, bioRequest),
    ]).then(([bio, stats]) => {
      if (controller.signal.aborted) return;
      const person = bio.status === "fulfilled" ? bio.value?.athlete : undefined;
      const data = stats.status === "fulfilled" ? stats.value : undefined;
      if (!person && !data) {
        setFailed(bio.status === "rejected" || stats.status === "rejected");
        setLoading(false);
        return;
      }
      const summary = (person?.statsSummary?.statistics ?? []).slice(0, 12).map((stat: any) => ({
        name: String(stat.displayName || stat.name),
        value: String(stat.displayValue ?? "—"),
      }));
      const summarySeason = bio.status === "fulfilled" ? String(bio.value?.season?.year) : "";
      const categories: AthleteCareerCategory[] = (data || [])
        .map((category: AthleteCareerCategory) => {
          if (!category.season || category.season !== summarySeason) return category;
          const included = category.descriptions
            .map((name, index) => ({ name, index }))
            .filter(({ name }) => !summary.some((stat: { name: string }) => stat.name === name));
          return {
            ...category,
            labels: included.map(({ index }) => category.labels[index]),
            descriptions: included.map(({ name }) => name),
            totals: included.map(({ index }) => category.totals[index]),
          };
        })
        .filter((category) => category.totals.length || category.rows.length);
      const identity = parseEspnAthleteBio({ athlete: person }, athlete.id);
      const result: Profile = {
        name: identity?.name || athlete.name,
        image: identity?.image || athleteImageUrl(athlete.image),
        bio: identity?.bio || [],
        summaryTitle:
          def?.group === "combat" ? "Career record" : person?.statsSummary?.displayName || "Stats",
        team: identity?.team,
        summary,
        categories,
        statsFailed:
          stats.status === "rejected" || (bio.status === "rejected" && !categories.length),
        recordUrl: identity?.recordUrl,
      };
      cache.set(key, { at: Date.now(), data: result });
      while (cache.size > 30) cache.delete(cache.keys().next().value!);
      setProfile({ key, data: result });
      setLoading(false);
    });
    return () => controller.abort();
  }, [key, retry]);
  const current = profile?.key === key ? profile.data : null;
  const portrait =
    athleteImageUrl(current?.image) ||
    athleteImageUrl(athlete.image) ||
    athleteImageUrl(resolved.image);
  const emblem = athleteImageUrl(athlete.logo) || athleteImageUrl(current?.team?.logo);
  const external = current?.recordUrl || "";

  return (
    <ModalShell closing={false} onDismiss={onClose} width={1120} labelledBy="sh-athlete-title">
      <article className="sh-athlete-profile" data-sport={def?.group}>
        <header>
          <button ref={backButton} className="sh-button" onClick={onClose}>
            <ArrowLeft size={16} />
            {t("Back")}
          </button>
          <span>
            {def && <LeagueLogo league={def} size={24} />}
            {t(provider === "thesportsdb" ? "Athlete profile" : "Career profile")} ·{" "}
            {def?.labelEn || league}
          </span>
        </header>
        <div className="sh-athlete-bio">
          <div className="sh-athlete-photo">
            {portrait && !broken.has(portrait) ? (
              <img
                src={portrait}
                alt=""
                onError={() => setBroken((current) => new Set(current).add(portrait))}
              />
            ) : emblem && !broken.has(emblem) ? (
              <img
                src={emblem}
                alt=""
                onError={() => setBroken((current) => new Set(current).add(emblem))}
              />
            ) : def ? (
              <LeagueLogo league={def} size={76} />
            ) : (
              <UserRound size={64} />
            )}
          </div>
          <div>
            <span className="sh-eyebrow">{t("Athlete profile")}</span>
            <h2 id="sh-athlete-title">{current?.name || athlete.name}</h2>
            {current?.team && (
              <div className="sh-athlete-team">
                <AthleteTeamLogo src={current.team.logo} />
                {current.team.name}
              </div>
            )}
            {current?.bio.map((item, i) => (
              <p key={i}>{item}</p>
            ))}
          </div>
        </div>
        {loading ? (
          <div
            className="sh-board-skeleton"
            role="status"
            aria-label={t("Loading athlete profile…")}
          >
            <i />
            <i />
            <i />
          </div>
        ) : (
          <>
            {current?.summary.length ? (
              <section>
                <h3>{t(current.summaryTitle)}</h3>
                <div className="sh-athlete-summary">
                  {current.summary.map((item) => (
                    <div key={item.name}>
                      <strong>{formatStatValue(item.value, locale)}</strong>
                      <span>{item.name}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
            {current?.categories.length ? (
              current.categories.map((category, index) => (
                <section key={`${category.name}:${index}`}>
                  <h3>{t(category.name)}</h3>
                  {!category.rows.length && category.totals.length ? (
                    <>
                      <p className="sh-athlete-stat-scope">
                        {category.season
                          ? `${t("Season")} ${category.season}`
                          : t(
                              def?.group === "soccer"
                                ? "Career totals for this competition"
                                : "Career totals",
                            )}
                      </p>
                      <div className="sh-athlete-summary" data-season={category.season}>
                        {category.totals.map((value, i) => (
                          <div key={i}>
                            <strong>{formatStatValue(value, locale)}</strong>
                            <span>
                              {t(category.descriptions[i] || category.labels[i] || "Stats")}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div
                      className="sh-athlete-table"
                      tabIndex={0}
                      role="region"
                      aria-label={t(category.name)}
                    >
                      <table>
                        <thead>
                          <tr>
                            <th>{t(category.rowLabel || "Season")}</th>
                            <th>{t(category.teamLabel || "Team")}</th>
                            {category.labels.map((label, i) => (
                              <th key={i} title={t(category.descriptions[i] || label)}>
                                {t(label)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {category.totals.length > 0 && (
                            <tr className="sh-career-totals">
                              <th>
                                {t(
                                  def?.group === "soccer"
                                    ? "Career totals for this competition"
                                    : "Career totals",
                                )}
                              </th>
                              <td>—</td>
                              {category.totals.map((value, i) => (
                                <td key={i}>{value}</td>
                              ))}
                            </tr>
                          )}
                          {[...category.rows].reverse().map((row, i) => (
                            <tr key={i}>
                              <th>{row.season}</th>
                              <td>
                                <span className="sh-athlete-team">
                                  <AthleteTeamLogo src={row.teamLogo} />
                                  {row.team.replaceAll("-", " ")}
                                </span>
                              </td>
                              {row.values.map((value, j) => (
                                <td key={j}>{value}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              ))
            ) : current?.statsFailed || failed || !current?.summary.length ? (
              <div
                className={current?.summary.length ? "sh-athlete-stat-notice" : "sh-empty"}
                role="status"
              >
                <p>
                  {t(
                    current?.statsFailed || failed
                      ? current?.summary.length
                        ? "Detailed statistics could not be loaded."
                        : "Statistics could not be loaded. Please try again."
                      : "Detailed statistics are not provided for this athlete yet.",
                  )}
                </p>
                {(current?.statsFailed || failed) && (
                  <button
                    className="sh-button"
                    onClick={() => {
                      cache.delete(key);
                      setRetry((value) => value + 1);
                    }}
                  >
                    {t("Retry")}
                  </button>
                )}
              </div>
            ) : null}
          </>
        )}
        <AthleteVideos
          key={`${league}:${athlete.id}`}
          name={current?.name || athlete.name}
          league={league}
          sport={def?.group || league}
        />
        {external && (
          <footer>
            <p>
              {t(
                provider === "thesportsdb"
                  ? "Athlete information supplied by TheSportsDB. Statistics may not be available."
                  : "Statistics supplied by ESPN. Historical coverage varies by athlete and competition.",
              )}
            </p>
            <button className="sh-button" onClick={() => openUrl(external)}>
              {t(
                provider === "thesportsdb"
                  ? "View profile on TheSportsDB"
                  : "View full record on ESPN",
              )}
              <ArrowUpRight size={15} />
            </button>
          </footer>
        )}
      </article>
    </ModalShell>
  );
}

function AthleteTeamLogo({ src }: { src?: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  return src && !broken ? (
    <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} />
  ) : null;
}
