import { useEffect, useMemo, useState } from "react";
import type { EsportsMatch, EsportsTeam } from "@/lib/sports/esports-feeds";
import { esportsTeamDirectory, type EsportsTeamEntry } from "@/lib/sports/esports-team-directory";
import { fetchEsportsRankings, type EsportsRankings } from "@/lib/sports/esports-rankings";
import { EsportsTeamProfile } from "./esports-profile";
import { TeamMatches } from "./esports-teams";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { EsportsImage } from "./esports-image";
import { fetchCsMatchDetail, type CsMatchDetail } from "@/lib/sports/esports-cs-detail";
import { esportsTeamLeague } from "@/lib/sports/esports-team-identity";
import { fetchTeamProfile, type TeamProfileData } from "@/lib/sports/team-profile";

export type EsportsTeamSelection = { game: EsportsMatch["game"]; team: EsportsTeam };

/** Team data is loaded only after an explicit team selection, never once per card. */
export function EsportsTeamDialog({
  selection,
  matches,
  onClose,
  onMatch,
}: {
  selection: EsportsTeamSelection;
  matches: EsportsMatch[];
  onClose: () => void;
  onMatch: (match: EsportsMatch) => void;
}) {
  const t = useT();
  const [rankings, setRankings] = useState<EsportsRankings | null>(null);
  const [detail, setDetail] = useState<CsMatchDetail | null>(null);
  const [loading, setLoading] = useState(selection.game === "cs2");
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [profile, setProfile] = useState<TeamProfileData | null>(null);
  const league = esportsTeamLeague(
    selection.game,
    matches.filter((match) => match.teams.some((team) => team.id === selection.team.id)),
  );
  const sourceMatch = matches.find(
    (match) =>
      match.game === selection.game && match.teams.some((team) => team.id === selection.team.id),
  );
  useEffect(() => {
    if (!league) return;
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    fetchTeamProfile({ ...selection.team, league, source: "esports" }, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setProfile(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [league, selection.team.id, selection.team.name, retry]);
  useEffect(() => {
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const dialog = [
        ...document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'),
      ].at(-1);
      const items = [
        ...(dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input, select, textarea, [tabindex="0"]',
        ) || []),
      ].filter((item) => item.getClientRects().length > 0);
      const target = event.shiftKey ? items.at(-1) : items[0];
      if (
        target &&
        (!dialog?.contains(document.activeElement) ||
          document.activeElement === (event.shiftKey ? items[0] : items.at(-1)))
      ) {
        event.preventDefault();
        target.focus();
      }
    };
    window.addEventListener("keydown", trap, true);
    return () => window.removeEventListener("keydown", trap, true);
  }, []);
  useEffect(() => {
    if (selection.game !== "cs2") return;
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    void (async () => {
      let ranked = false;
      try {
        const value = await fetchEsportsRankings(controller.signal, retry > 0);
        if (controller.signal.aborted) return;
        setRankings(value);
        ranked = value.teams.some((team) => team.id === selection.team.id);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
      if (!ranked && sourceMatch) {
        let slug: string | undefined;
        try {
          const url = new URL(sourceMatch.sourceUrl);
          slug =
            url.hostname === "bo3.gg"
              ? url.pathname.match(/^\/matches\/([^/]+)\/?$/)?.[1]
              : undefined;
        } catch {
          /* Feed records without a valid match URL still have a team summary. */
        }
        if (slug)
          try {
            const value = await fetchCsMatchDetail(slug, controller.signal);
            if (!controller.signal.aborted) setDetail(value);
          } catch {
            if (!controller.signal.aborted) setFailed(true);
          }
      }
      if (!controller.signal.aborted) setLoading(false);
    })();
    return () => controller.abort();
  }, [selection.game, selection.team.id, sourceMatch?.sourceUrl, retry]);
  const entry = useMemo<EsportsTeamEntry>(
    () =>
      esportsTeamDirectory(matches, rankings?.teams).find(
        (item) => item.game === selection.game && item.id === selection.team.id,
      ) || { ...selection.team, game: selection.game, matches: [] },
    [matches, rankings, selection],
  );
  if (
    selection.game === "dota2" &&
    /^\d+$/.test(selection.team.id) &&
    Number(selection.team.id) > 0
  )
    return <EsportsTeamProfile teamId={Number(selection.team.id)} onClose={onClose} />;
  const players = detail?.teams.find((team) => team.id === selection.team.id)?.players || [];
  return (
    <TeamMatches team={entry} rankings={rankings} onClose={onClose} onMatch={onMatch}>
      {loading && (
        <p className="ea-feed-health" role="status">
          {t("Loading…")}
        </p>
      )}
      {failed && !loading && (
        <div className="ea-feed-health" role="status">
          <span>{t("Detailed statistics could not be loaded.")}</span>
          <button className="sh-button" onClick={() => setRetry((value) => value + 1)}>
            {t("Retry")}
          </button>
        </div>
      )}
      {profile && (
        <>
          {!!profile.facts.length && (
            <dl className="ea-team-combat-totals">
              {profile.facts.map((fact) => (
                <div key={fact.label}>
                  <dt>{t(fact.label)}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {profile.description && (
            <section className="ea-team-history">
              <h3>{t("About the team")}</h3>
              <p className="ea-team-biography">{profile.description}</p>
            </section>
          )}
          {!!profile.honors.length && (
            <section className="ea-team-history">
              <h3>{t("Honors")}</h3>
              {profile.honors.map((honor, index) => (
                <p key={index}>{honor.detail || honor.title}</p>
              ))}
            </section>
          )}
          {!!profile.roster.length && (
            <section className="ea-ranking-roster">
              <div className="ea-directory-heading">
                <strong>{t("Roster")}</strong>
                <span>TheSportsDB</span>
              </div>
              <div className="ea-ranking-players">
                {profile.roster.map((player) => (
                  <button
                    key={player.id}
                    disabled={!player.profileUrl}
                    onClick={() => player.profileUrl && openUrl(player.profileUrl)}
                  >
                    <EsportsImage src={player.image} name={player.name} />
                    <strong>{player.name}</strong>
                  </button>
                ))}
              </div>
            </section>
          )}
          {!!profile.sourceUrls.length && (
            <div className="ea-directory-heading">
              {profile.sourceUrls.map((url) => (
                <button className="ea-source-link" key={url} onClick={() => openUrl(url)}>
                  {t("Source")} · {new URL(url).hostname.replace(/^www\./, "")}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {!entry.ranking && players.length > 0 && (
        <section className="ea-ranking-roster">
          <div className="ea-directory-heading">
            <strong>
              {t(detail?.rosterBasis === "match" ? "Match roster" : "Current team roster")}
            </strong>
            <span>Bo3.gg</span>
          </div>
          <div className="ea-ranking-players">
            {players.map((player) => (
              <button
                key={player.id}
                disabled={!player.url}
                onClick={() => player.url && openUrl(player.url)}
              >
                <EsportsImage src={player.image} name={player.name} />
                <strong>{player.name}</strong>
              </button>
            ))}
          </div>
        </section>
      )}
    </TeamMatches>
  );
}
