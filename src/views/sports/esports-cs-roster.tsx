import { useEffect, useId, useState } from "react";
import { ArrowUpRight, ChevronDown, LoaderCircle, Play, Users } from "lucide-react";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import type { EsportsMatch, EsportsStream } from "@/lib/sports/esports-feeds";
import {
  fetchCsMatchDetail,
  type CsMatchDetail,
  type CsPlayer,
} from "@/lib/sports/esports-cs-detail";
import { EsportsImage } from "./esports-image";
import "./esports-cs-roster.css";

function PlayerRow({ player }: { player: CsPlayer }) {
  const t = useT();
  const stat = (label: string) => player.stats.find((value) => value.label === label)?.value ?? "—";
  const hasStats = player.stats.length > 0;
  const content = (
    <>
      <EsportsImage src={player.image} name={player.name} className="ea-cs-portrait" />
      <span className="ea-cs-player-name">
        <strong>{player.name}</strong>
        <small>{player.fullName || player.country}</small>
      </span>
      {hasStats && (
        <span className="ea-cs-player-numbers">
          <span title={`${t("Kills")} / ${t("Deaths")} / ${t("Assists")}`}>
            <b>
              {stat("Kills")}
              <i>/</i>
              {stat("Deaths")}
              <i>/</i>
              {stat("Assists")}
            </b>
            <small>K / D / A</small>
          </span>
          <span title={t("Average damage per round")}>
            <b>{stat("ADR")}</b>
            <small>ADR</small>
          </span>
          <span title={t("Kill, assist, survived or traded rounds")}>
            <b>{stat("KAST")}</b>
            <small>KAST</small>
          </span>
        </span>
      )}
      {player.url && <ArrowUpRight size={15} className="ea-cs-player-link" />}
    </>
  );
  return player.url ? (
    <button
      type="button"
      className="ea-cs-player"
      onClick={() => void openUrl(player.url!)}
      aria-label={`${player.name} · ${t("Player profile")}`}
    >
      {content}
    </button>
  ) : (
    <div className="ea-cs-player">{content}</div>
  );
}

export function EsportsCsRoster({
  match,
  onWatch,
}: {
  match: EsportsMatch;
  onWatch: (stream: EsportsStream) => void;
}) {
  const t = useT();
  const id = useId();
  const [expanded, setExpanded] = useState(true);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    detail?: CsMatchDetail;
    error?: boolean;
  }>();
  const key = `${match.id}:${retry}`;
  const detail = result?.key === key ? result.detail : undefined;
  const failed = result?.key === key && result.error;
  useEffect(() => {
    if (!expanded || match.game !== "cs2") return;
    const controller = new AbortController();
    const slug = match.sourceUrl.split("/").filter(Boolean).at(-1) || "";
    fetchCsMatchDetail(slug, controller.signal).then(
      (value) => {
        if (!controller.signal.aborted) setResult({ key, detail: value });
      },
      () => {
        if (!controller.signal.aborted) setResult({ key, error: true });
      },
    );
    return () => controller.abort();
  }, [expanded, key, match.game, match.sourceUrl]);
  if (match.game !== "cs2") return null;
  return (
    <section className="ea-cs-roster">
      <button
        className="ea-cs-toggle"
        type="button"
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => setExpanded((value) => !value)}
      >
        <Users size={19} />
        <strong>{t("Players & match stats")}</strong>
        <ChevronDown size={18} className={expanded ? "is-open" : ""} />
      </button>
      {expanded && (
        <div id={id} className="ea-cs-body">
          {!detail && !failed && (
            <div className="ea-cs-status" role="status">
              <LoaderCircle size={22} className="ea-cs-spinner" />
              <span>{t("Loading")}</span>
            </div>
          )}
          {failed && (
            <div className="ea-cs-status" role="status">
              <span>{t("Player details could not be loaded.")}</span>
              <button type="button" onClick={() => setRetry((value) => value + 1)}>
                {t("Retry")}
              </button>
            </div>
          )}
          {detail && (
            <>
              {detail.maps.length > 0 && (
                <div className="ea-cs-maps" aria-label={t("Map results")}>
                  {detail.maps.map((map) => (
                    <div key={map.id} className="ea-cs-map-result">
                      <span>
                        {map.number.toString().padStart(2, "0")}
                        <strong>{map.name}</strong>
                      </span>
                      <b
                        aria-label={`${detail.teams[0].name} ${map.teamScores[0] ?? "—"}, ${detail.teams[1].name} ${map.teamScores[1] ?? "—"}`}
                      >
                        {map.teamScores[0] ?? "—"}
                        <i>:</i>
                        {map.teamScores[1] ?? "—"}
                      </b>
                    </div>
                  ))}
                </div>
              )}
              <p className="ea-cs-source-note">
                {t(
                  detail.rosterBasis === "match"
                    ? "Match lineup and statistics"
                    : detail.rosterBasis === "current-team"
                      ? "Current team roster. Match-day lineup may differ."
                      : "Player data is not available for this match.",
                )}
              </p>
              <div className="ea-cs-teams">
                {detail.teams.map((team) => (
                  <div key={team.id} className="ea-cs-team">
                    <header>
                      <EsportsImage src={team.logo} name={team.name} className="ea-cs-team-logo" />
                      <h3>{team.name}</h3>
                    </header>
                    <div>
                      {team.players.map((player) => (
                        <PlayerRow key={player.id} player={player} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {detail.streams.length > 0 && (
                <div className="ea-cs-streams">
                  <strong>{t("Official broadcasts")}</strong>
                  <div>
                    {detail.streams.map((stream) => (
                      <button key={stream.url} type="button" onClick={() => onWatch(stream)}>
                        <Play size={14} fill="currentColor" />
                        {stream.title}
                        <ArrowUpRight size={13} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
