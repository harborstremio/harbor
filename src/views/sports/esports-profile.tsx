import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronRight,
  LoaderCircle,
  Shield,
  UserRound,
  X,
} from "lucide-react";
import { ModalShell } from "@/components/modal-shell";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import {
  fetchEsportsPlayerProfile,
  fetchEsportsTeamProfile,
  type EsportsPlayerRecord,
  type EsportsRecordMatch,
  type EsportsTeamRecord,
} from "@/lib/sports/esports-profiles";
import "./esports-profile.css";

function ProfileImage({ src, player = false }: { src?: string; player?: boolean }) {
  const [failed, setFailed] = useState(false);
  const t = useT();
  useEffect(() => setFailed(false), [src]);
  return (
    <span
      className={`sh-es-profile-image ${player ? "is-player" : ""}`}
      title={player ? t("Account avatar") : undefined}
    >
      {src && !failed ? (
        <img src={src} alt="" decoding="async" onError={() => setFailed(true)} />
      ) : player ? (
        <UserRound aria-hidden size={32} />
      ) : (
        <Shield aria-hidden size={32} />
      )}
    </span>
  );
}
function useRecord<T>(identity: number, fetcher: (id: number, signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<{
    id: number;
    value: T | null;
    busy: boolean;
    error: boolean;
  }>({ id: identity, value: null, busy: true, error: false });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ id: identity, value: null, busy: true, error: false });
    void fetcher(identity, controller.signal).then(
      (value) => {
        if (!controller.signal.aborted)
          setState({ id: identity, value, busy: false, error: false });
      },
      () => {
        if (!controller.signal.aborted)
          setState({ id: identity, value: null, busy: false, error: true });
      },
    );
    return () => controller.abort();
  }, [identity, revision, fetcher]);
  return {
    value: state.id === identity ? state.value : null,
    busy: state.id !== identity || state.busy,
    error: state.id === identity && state.error,
    retry: () => setRevision((value) => value + 1),
  };
}
function ProfileStatus({
  busy,
  error,
  partial,
  retry,
}: {
  busy: boolean;
  error: boolean;
  partial?: boolean;
  retry: () => void;
}) {
  const t = useT();
  if (busy)
    return (
      <div className="sh-es-profile-status" role="status">
        <LoaderCircle className="sh-es-profile-spinner" size={24} />
        {t("Loading records…")}
      </div>
    );
  if (error)
    return (
      <div className="sh-es-profile-status" role="status">
        <p>{t("These records could not be loaded.")}</p>
        <button onClick={retry}>{t("Retry")}</button>
      </div>
    );
  return partial ? (
    <p className="sh-es-profile-note" role="status">
      {t("Some records are unavailable. Available statistics are shown below.")}
    </p>
  ) : null;
}
function Stat({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <strong>{value ?? "—"}</strong>
      <span>{label}</span>
    </div>
  );
}
function MatchHistory({
  matches,
  player = false,
}: {
  matches: EsportsRecordMatch[];
  player?: boolean;
}) {
  const t = useT(),
    locale = useUiLanguage();
  const [opponentId, setOpponentId] = useState<number | null>(null);
  return (
    <section className="sh-es-record-history">
      <h3>{t("Recent results")}</h3>
      {matches.length ? (
        <div>
          {matches.map((match) => (
            <div key={match.id} className="sh-es-result">
              <button
                className="sh-es-result-open"
                aria-label={`${t("Match")} ${match.id}`}
                onClick={() => openUrl(`https://www.opendota.com/matches/${match.id}`)}
              />
              <span
                className={`sh-es-result-outcome ${match.won === null ? "" : match.won ? "is-win" : "is-loss"}`}
              >
                {match.won === null ? "—" : match.won ? t("Win") : t("Loss")}
              </span>
              {!player &&
                (match.opponentId ? (
                  <button
                    className="sh-es-opponent-logo"
                    aria-label={`${t("View team profile")} · ${match.opponent}`}
                    onClick={() => setOpponentId(match.opponentId)}
                  >
                    <ProfileImage src={match.opponentLogo} />
                  </button>
                ) : (
                  <ProfileImage src={match.opponentLogo} />
                ))}
              <span className="sh-es-result-name">
                <strong>
                  {player ? (
                    `${t("Match")} ${match.id}`
                  ) : match.opponentId ? (
                    <button
                      className="sh-es-opponent-name"
                      onClick={() => setOpponentId(match.opponentId)}
                    >
                      {match.opponent || t("Opponent unconfirmed")}
                    </button>
                  ) : (
                    match.opponent || t("Opponent unconfirmed")
                  )}
                </strong>
                <small>
                  {match.tournament ||
                    (player ? t("Tracked account match") : t("Recorded team match"))}
                </small>
              </span>
              {player && (
                <span className="sh-es-result-kda" title={t("Kills / deaths / assists")}>
                  {match.kills ?? "—"} / {match.deaths ?? "—"} / {match.assists ?? "—"}
                </span>
              )}
              <span className="sh-es-result-time">
                {match.at
                  ? new Date(match.at).toLocaleDateString(locale, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "—"}
                <small>
                  {match.duration === null
                    ? "—"
                    : `${Math.floor(match.duration / 60)}:${String(Math.floor(match.duration % 60)).padStart(2, "0")}`}
                </small>
              </span>
              <ArrowUpRight size={14} />
            </div>
          ))}
        </div>
      ) : (
        <p className="sh-es-profile-note">{t("No recent results were supplied by this feed.")}</p>
      )}
      {opponentId !== null && (
        <EsportsTeamProfile teamId={opponentId} onClose={() => setOpponentId(null)} />
      )}
    </section>
  );
}
function SourceFooter({ id, scope }: { id: number; scope: "teams" | "players" }) {
  const t = useT();
  return (
    <footer>
      <p>
        {scope === "players"
          ? t(
              "OpenDota account history includes tracked public and professional matches. It is not a complete professional career record.",
            )
          : t(
              "Team ratings, results and roster membership are reported by OpenDota. Coverage and roster updates may be incomplete.",
            )}
      </p>
      <button onClick={() => openUrl(`https://www.opendota.com/${scope}/${id}`)}>
        {t("Full record on OpenDota")}
        <ArrowUpRight size={15} />
      </button>
    </footer>
  );
}
export function EsportsTeamProfile({ teamId, onClose }: { teamId: number; onClose: () => void }) {
  const t = useT(),
    locale = useUiLanguage(),
    title = useId();
  const { value, busy, error, retry } = useRecord<EsportsTeamRecord>(
    teamId,
    fetchEsportsTeamProfile,
  );
  const [history, setHistory] = useState(false),
    [person, setPerson] = useState<number | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null),
    opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    opener.current = document.activeElement as HTMLElement;
    closeButton.current?.focus({ preventScroll: true });
    return () => opener.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    setHistory(false);
    setPerson(null);
  }, [teamId]);
  if (person)
    return (
      <EsportsPlayerProfile
        accountId={person}
        onClose={() => {
          setPerson(null);
          requestAnimationFrame(() =>
            document.getElementById(`sh-es-roster-${person}`)?.focus({ preventScroll: true }),
          );
        }}
      />
    );
  const current = value?.players.filter((player) => player.current) ?? [];
  const players = history || !current.length ? (value?.players ?? []) : current;
  const games =
    value?.team?.wins !== null && value?.team?.wins !== undefined && value.team.losses !== null
      ? value.team.wins + value.team.losses
      : null;
  return (
    <ModalShell closing={false} onDismiss={onClose} width={1040} labelledBy={title}>
      <article className="sh-es-profile">
        <header>
          <span>
            {t("Dota 2")} · {t("Team profile")}
          </span>
          <button
            ref={closeButton}
            className="sh-es-close"
            onClick={onClose}
            aria-label={t("Close")}
          >
            <X size={20} />
          </button>
        </header>
        <div className="sh-es-profile-identity">
          <ProfileImage src={value?.team?.logo} />
          <div>
            <span>{value?.team?.tag || t("Team profile")}</span>
            <h2 id={title}>{value?.team?.name || `${t("Team")} ${teamId}`}</h2>
            <p>
              {value?.team?.lastMatchTime
                ? `${t("Last recorded match")} · ${new Date(value.team.lastMatchTime).toLocaleDateString(locale, { month: "long", day: "numeric", year: "numeric" })}`
                : t("Professional Dota 2 records")}
            </p>
          </div>
        </div>
        <ProfileStatus busy={busy} error={error} partial={value?.partial} retry={retry} />
        {value && (
          <>
            <div className="sh-es-profile-stats">
              <Stat
                label={t("OpenDota rating")}
                value={value.team?.rating?.toLocaleString(locale, {
                  maximumFractionDigits: 0,
                })}
              />
              <Stat label={t("Recorded matches")} value={games?.toLocaleString(locale)} />
              <Stat label={t("Wins")} value={value.team?.wins?.toLocaleString(locale)} />
              <Stat
                label={t("Win rate")}
                value={games ? `${((value.team!.wins! / games) * 100).toFixed(1)}%` : null}
              />
            </div>
            <section>
              <div className="sh-es-roster-heading">
                <h3>{history || !current.length ? t("Player history") : t("Reported roster")}</h3>
                {current.length > 0 && (
                  <button aria-pressed={history} onClick={() => setHistory((v) => !v)}>
                    {history ? t("Current roster") : t("View player history")}
                  </button>
                )}
              </div>
              <p className="sh-es-profile-note">
                {t("Wins and appearances below are recorded with this team.")}
              </p>
              {players.length ? (
                <div className="sh-es-roster">
                  {players.map((player) => (
                    <button
                      id={`sh-es-roster-${player.accountId}`}
                      key={player.accountId}
                      onClick={() => setPerson(player.accountId)}
                    >
                      <ProfileImage src={player.avatar} player />
                      <span>
                        <strong>{player.name}</strong>
                        <small>
                          {player.games ?? "—"} {t("Matches")} · {player.wins ?? "—"} {t("Wins")}
                        </small>
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="sh-es-profile-note">{t("No roster was supplied by this feed.")}</p>
              )}
            </section>
            <MatchHistory matches={value.matches} />
          </>
        )}
        <SourceFooter id={teamId} scope="teams" />
      </article>
    </ModalShell>
  );
}
const totalNames: Record<string, string> = {
  kills: "Kills",
  deaths: "Deaths",
  assists: "Assists",
  kda: "KDA ratio",
  last_hits: "Last hits",
  denies: "Denies",
  gold_per_min: "Gold per minute",
  xp_per_min: "Experience per minute",
  lane_efficiency_pct: "Lane efficiency (%)",
  level: "Level",
  hero_damage: "Hero damage",
  tower_damage: "Tower damage",
  hero_healing: "Hero healing",
  duration: "Match duration (seconds)",
  stuns: "Stuns (seconds)",
  obs_placed: "Observer wards placed",
  sen_placed: "Sentry wards placed",
  camps_stacked: "Camps stacked",
  rune_pickups: "Runes collected",
  tower_kills: "Towers destroyed",
  neutral_kills: "Neutral kills",
  courier_kills: "Courier kills",
  purchase_tpscroll: "Town Portal Scrolls purchased",
  purchase_ward_observer: "Observer wards purchased",
  purchase_ward_sentry: "Sentry wards purchased",
  purchase_gem: "Gems purchased",
  purchase_rapier: "Divine Rapiers purchased",
  pings: "Pings",
  actions_per_min: "Actions per minute",
};
export function EsportsPlayerProfile({
  accountId,
  onClose,
}: {
  accountId: number;
  onClose: () => void;
}) {
  const t = useT(),
    locale = useUiLanguage(),
    title = useId(),
    back = useRef<HTMLButtonElement>(null);
  const { value, busy, error, retry } = useRecord<EsportsPlayerRecord>(
    accountId,
    fetchEsportsPlayerProfile,
  );
  useEffect(() => {
    const active = document.activeElement as HTMLElement;
    back.current?.focus({ preventScroll: true });
    return () => active?.focus({ preventScroll: true });
  }, []);
  const games =
    value?.wins !== null && value?.wins !== undefined && value.losses !== null
      ? value.wins + value.losses
      : null;
  const totals = value?.totals ?? [];
  return (
    <ModalShell closing={false} onDismiss={onClose} width={1040} labelledBy={title}>
      <article className="sh-es-profile">
        <header>
          <button ref={back} onClick={onClose}>
            <ArrowLeft size={16} />
            {t("Back")}
          </button>
          <span>
            {t("Dota 2")} · {t("Player profile")}
          </span>
        </header>
        <div className="sh-es-profile-identity">
          <ProfileImage src={value?.avatar} player />
          <div>
            <span>
              {t("Account avatar")}
              {value?.country ? ` · ${value.country}` : ""}
            </span>
            <h2 id={title}>{value?.name || `${t("Player")} ${accountId}`}</h2>
            <p>{t("Tracked account history")}</p>
          </div>
        </div>
        <ProfileStatus busy={busy} error={error} partial={value?.partial} retry={retry} />
        {value && (
          <>
            <div className="sh-es-profile-stats">
              <Stat label={t("Recorded matches")} value={games?.toLocaleString(locale)} />
              <Stat label={t("Wins")} value={value.wins?.toLocaleString(locale)} />
              <Stat label={t("Losses")} value={value.losses?.toLocaleString(locale)} />
              <Stat
                label={t("Win rate")}
                value={games ? `${((value.wins! / games) * 100).toFixed(1)}%` : null}
              />
            </div>
            <section>
              <h3>{t("Career totals available in this feed")}</h3>
              <p className="sh-es-profile-note">
                {t(
                  "Each statistic can cover a different number of parsed matches. Averages use the sample shown.",
                )}
              </p>
              {totals.length ? (
                <div
                  className="sh-es-totals"
                  tabIndex={0}
                  role="region"
                  aria-label={t("Career statistics")}
                >
                  <table>
                    <thead>
                      <tr>
                        <th>{t("Statistic")}</th>
                        <th>{t("Total")}</th>
                        <th>{t("Per match")}</th>
                        <th>{t("Sample matches")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {totals.map((total) => (
                        <tr key={total.field}>
                          <th title={total.field}>
                            {totalNames[total.field]
                              ? t(totalNames[total.field])
                              : total.field.replaceAll("_", " ")}
                          </th>
                          <td>
                            {[
                              "gold_per_min",
                              "xp_per_min",
                              "kda",
                              "level",
                              "lane_efficiency_pct",
                              "actions_per_min",
                            ].includes(total.field)
                              ? "—"
                              : total.sum.toLocaleString(locale, {
                                  maximumFractionDigits: 0,
                                })}
                          </td>
                          <td>
                            {(total.sum / total.count).toLocaleString(locale, {
                              maximumFractionDigits: 1,
                            })}
                          </td>
                          <td>{total.count.toLocaleString(locale)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="sh-es-profile-note">
                  {t("No parsed statistics were supplied by this feed.")}
                </p>
              )}
            </section>
            <MatchHistory matches={value.matches} player />
          </>
        )}
        <SourceFooter id={accountId} scope="players" />
      </article>
    </ModalShell>
  );
}
