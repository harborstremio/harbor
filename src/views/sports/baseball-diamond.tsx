import { useState } from "react";
import { ChevronDown, UserRound } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { MatchPlayer, SportsGame, SportsMatchDetail } from "@/lib/sports/espn-types";
import { baseballBattingOrder, baseballDefense } from "@/lib/sports/baseball";
import { SportIcon } from "./sport-icon";
import { AthleteProfileLink } from "./athlete-profile";
import "./baseball-diamond.css";

function PlayerPortrait({ player }: { player: MatchPlayer }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="sh-diamond-portrait">
      {player.image && !failed ? (
        <img src={player.image} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        player.jersey || <UserRound size={20} />
      )}
    </span>
  );
}

export function BaseballDiamond({
  game,
  detail,
  failed,
  loading,
  retry,
}: {
  game: SportsGame;
  detail: SportsMatchDetail | null;
  failed: boolean;
  loading: boolean;
  retry: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [chosenTeam, setChosenTeam] = useState<"home" | "away" | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const current = detail ?? game;
  const situation = detail?.baseball;
  const currentDefense =
    situation?.pitcherId && detail?.awayRoster.some((player) => player.id === situation.pitcherId)
      ? "away"
      : "home";
  const team = chosenTeam ?? currentDefense;
  const roster = detail ? (team === "home" ? detail.homeRoster : detail.awayRoster) : [];
  const allPlayers = detail ? [...detail.homeRoster, ...detail.awayRoster] : [];
  const defense = baseballDefense(roster, current.state, situation?.pitcherId);
  const order = baseballBattingOrder(roster, current.state);
  const selected = allPlayers.find((player) => player.id === selectedId);
  const pitcher = allPlayers.find((player) => player.id === situation?.pitcherId);
  const batter = allPlayers.find((player) => player.id === situation?.batterId);
  const live = current.state === "in" && !failed;
  const runners = [
    { name: "First base", id: situation?.onFirstId, x: 68, y: 65 },
    { name: "Second base", id: situation?.onSecondId, x: 50, y: 47 },
    { name: "Third base", id: situation?.onThirdId, x: 32, y: 65 },
  ];
  return (
    <details className="sh-diamond" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary tabIndex={0}>
        <SportIcon name="baseball" size={24} />
        <span className="sh-diamond-heading">
          <strong>{t("On the diamond")}</strong>
          <small>{t("Field positions")}</small>
        </span>
        <span className="sh-diamond-score">
          <span className={live ? "sh-live" : "sh-eyebrow"}>
            {t(
              failed
                ? "Saved scores"
                : live
                  ? "Live now"
                  : current.state === "post"
                    ? "Final"
                    : "Upcoming",
            )}
          </span>
          {current.state !== "pre" && (
            <b>
              {current.home.abbr} {current.home.score} <i>:</i> {current.away.score}{" "}
              {current.away.abbr}
            </b>
          )}
          <small>{current.state !== "pre" ? current.detail : ""}</small>
        </span>
        <ChevronDown className="sh-diamond-chevron" size={19} />
      </summary>
      {open && (
        <div className="sh-diamond-body">
          <div className="sh-diamond-toolbar">
            <div className="sh-diamond-teams" role="group" aria-label={t("Field positions")}>
              {(["home", "away"] as const).map((side) => (
                <button
                  key={side}
                  aria-pressed={team === side}
                  onClick={() => {
                    setChosenTeam(side);
                    setSelectedId(null);
                  }}
                >
                  {current[side].logo && <img src={current[side].logo} alt="" />}
                  <span>{current[side].name}</span>
                </button>
              ))}
            </div>
            <small>{t("Lineup positions · not live tracking")}</small>
          </div>
          {loading && !detail && <p role="status">{t("Loading match details…")}</p>}
          {failed && (
            <p className="sh-feed-note">
              {t(detail ? "Showing saved match details." : "Lineup unavailable")}{" "}
              <button className="sh-text-button" onClick={retry}>
                {t("Retry")}
              </button>
            </p>
          )}
          <div className="sh-diamond-layout">
            <div
              className="sh-diamond-field"
              role="group"
              aria-label={`${t("Field positions")} · ${current[team].name}`}
            >
              <div className="sh-diamond-outfield" />
              <div className="sh-diamond-infield" />
              <div className="sh-diamond-grass" />
              <div className="sh-diamond-foul sh-diamond-foul-left" />
              <div className="sh-diamond-foul sh-diamond-foul-right" />
              <div className="sh-diamond-path" />
              <div className="sh-diamond-mound" />
              <span className="sh-diamond-home" />
              {runners.map((base) => (
                <span
                  key={base.name}
                  className={`sh-diamond-base ${live && base.id ? "is-occupied" : ""}`}
                  style={{ left: `${base.x}%`, top: `${base.y}%` }}
                  title={t(base.name)}
                />
              ))}
              {defense.map((position) => (
                <div
                  className="sh-diamond-position"
                  key={position.key}
                  style={{ left: `${position.x}%`, top: `${position.y}%` }}
                >
                  {position.player ? (
                    <button
                      aria-pressed={selectedId === position.player.id}
                      title={`${position.player.name} · ${position.key}`}
                      onClick={() => setSelectedId(position.player!.id)}
                    >
                      <PlayerPortrait key={position.player.id} player={position.player} />
                      <span className="sh-diamond-name">{position.player.name}</span>
                      <small>{position.key}</small>
                    </button>
                  ) : (
                    <span className="sh-diamond-vacant">{position.key}</span>
                  )}
                </div>
              ))}
            </div>
            <aside className="sh-diamond-order">
              <h3>{t("Batting order")}</h3>
              {!order.length && (
                <p>
                  {t(
                    current.state === "pre"
                      ? "Lineups have not been announced yet."
                      : "Lineup unavailable",
                  )}
                </p>
              )}
              <ol>
                {order.map((player) => (
                  <li key={player.id}>
                    <button
                      aria-pressed={selectedId === player.id}
                      onClick={() => setSelectedId(player.id)}
                    >
                      <b>{player.batOrder}</b>
                      <PlayerPortrait player={player} />
                      <span>{player.name}</span>
                      <small>{player.position}</small>
                    </button>
                  </li>
                ))}
              </ol>
            </aside>
          </div>
          {selected && (
            <div className="sh-diamond-inspect" aria-live="polite">
              <PlayerPortrait key={selected.id} player={selected} />
              <div>
                <small>{t("Player details")}</small>
                <strong>{selected.name}</strong>
                <AthleteProfileLink athlete={selected} league={game.league} />
                <span>
                  {selected.position}
                  {selected.jersey ? ` · #${selected.jersey}` : ""}
                </span>
              </div>
            </div>
          )}
          {current.state === "in" && situation && (
            <div className="sh-diamond-game-state">
              {(
                [
                  ["Balls", situation.balls],
                  ["Strikes", situation.strikes],
                  ["Outs", situation.outs],
                ] as const
              ).map(
                ([label, value]) =>
                  value !== undefined && (
                    <div key={label}>
                      <small>{t(label)}</small>
                      <b>{value}</b>
                    </div>
                  ),
              )}
              {pitcher && (
                <div>
                  <small>{t("Pitching")}</small>
                  <strong>{pitcher.name}</strong>
                </div>
              )}
              {batter && (
                <div>
                  <small>{t("At bat")}</small>
                  <strong>{batter.name}</strong>
                </div>
              )}
              {runners
                .filter((base) => base.id)
                .map((base) => (
                  <div key={base.name}>
                    <small>{t(base.name)}</small>
                    <strong>
                      {allPlayers.find((player) => player.id === base.id)?.name ?? t("On base")}
                    </strong>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </details>
  );
}
