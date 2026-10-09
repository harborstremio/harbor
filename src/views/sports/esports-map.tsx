import { useEffect, useRef, useState } from "react";
import { ChevronDown, ExternalLink, LoaderCircle, Minus, Plus, RotateCcw } from "lucide-react";
import type { SportsGame } from "@/lib/sports/espn";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { useInViewport, usePageVisible } from "@/lib/visibility";
import { useDragScroll } from "@/lib/use-drag-scroll";
import {
  ESPORTS_MAPS,
  esportsGameKind,
  fetchEsportsRoster,
  type EsportsGameKind,
  type EsportsMapDef,
  type EsportsPlayer,
  type EsportsRoster,
} from "@/lib/sports/esports-map-data";
import { SportIcon } from "./sport-icon";
import { MapBlueprint } from "./map-blueprint";
import "./esports-map.css";

export function EsportsMap({
  game,
  onPlayer,
  sourceUrl,
}: {
  game: SportsGame;
  onPlayer?: (accountId: string) => void;
  sourceUrl?: string;
}) {
  const kind = esportsGameKind(game);
  return kind ? (
    <EsportsMapPanel
      key={`${game.league}:${game.id}`}
      game={game}
      kind={kind}
      onPlayer={onPlayer}
      sourceUrl={sourceUrl}
    />
  ) : null;
}
function Portrait({ player }: { player: EsportsPlayer }) {
  const [broken, setBroken] = useState(false);
  return player.image && !broken ? (
    <img
      src={player.image}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
    />
  ) : (
    <SportIcon name="esports" size={25} />
  );
}
function PlayerNumbers({ player }: { player: EsportsPlayer }) {
  const t = useT();
  const stats = player.stats?.length
    ? player.stats
    : [
        { label: "Kills", value: player.kills },
        { label: "Deaths", value: player.deaths },
        { label: "Assists", value: player.assists },
      ]
        .filter((stat) => stat.value !== undefined)
        .map((stat) => ({ ...stat, value: String(stat.value) }));
  if (!stats.length) return null;
  return (
    <span className="sh-esmap-statline">
      {stats
        .filter((stat) => ["Kills", "Deaths", "Assists", "ADR"].includes(stat.label))
        .map((stat) => (
          <span
            key={stat.label}
            title={t(stat.label === "ADR" ? "Average damage per round" : stat.label)}
            aria-label={`${t(stat.label)}: ${stat.value}`}
          >
            <b>{stat.value}</b>
            {stat.label === "ADR" ? "ADR" : t(stat.label)}
          </span>
        ))}
    </span>
  );
}
function MapArtwork({ map }: { map: EsportsMapDef }) {
  const t = useT();
  const [layer, setLayer] = useState(0);
  if (map.blueprint) return <MapBlueprint map={map} />;
  const selected = map.layers?.[layer];
  return (
    <>
      <MapImage
        key={selected?.image || map.image || map.id}
        map={selected ? { ...map, ...selected, name: `${map.name} · ${t(selected.name)}` } : map}
      />
      {map.layers && (
        <div className="sh-esmap-blueprint-picks" role="group" aria-label={t("Map levels")}>
          {map.layers.map((item, index) => (
            <button key={item.image} aria-pressed={index === layer} onClick={() => setLayer(index)}>
              {t(item.name)}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
function MapImage({ map }: { map: EsportsMapDef }) {
  const t = useT();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [fallback, setFallback] = useState(false);
  return (
    <>
      {(!map.image || failed) && (
        <div className="sh-esmap-unavailable">
          <SportIcon name="esports" size={52} />
          <strong>{map.name}</strong>
          <p>{t("An overhead image is not available from this source.")}</p>
          <button className="sh-button" onClick={() => openUrl(map.source)}>
            {t("Open official map guide")}
            <ExternalLink size={15} />
          </button>
        </div>
      )}
      {map.image && !failed && (
        <>
          <img
            className="sh-esmap-art"
            src={fallback ? map.fallbackImage : map.image}
            alt={map.name}
            data-loaded={loaded}
            onLoad={() => setLoaded(true)}
            onError={() => {
              if (map.fallbackImage && !fallback) setFallback(true);
              else setFailed(true);
            }}
            decoding="async"
            draggable={false}
          />
          {!loaded && (
            <span className="sh-esmap-loading" role="status">
              <LoaderCircle size={24} />
              <span>{t("Loading map…")}</span>
            </span>
          )}
        </>
      )}
      {failed && (
        <span className="sh-esmap-art-error">
          {t("An overhead image is not available from this source.")}
        </span>
      )}
    </>
  );
}
function EsportsMapPanel({
  game,
  kind,
  onPlayer,
  sourceUrl,
}: {
  game: SportsGame;
  kind: EsportsGameKind;
  onPlayer?: (accountId: string) => void;
  sourceUrl?: string;
}) {
  const t = useT();
  const locale = useUiLanguage();
  const root = useRef<HTMLDetailsElement>(null);
  const visible = useInViewport(root, true);
  const pageVisible = usePageVisible();
  const [open, setOpen] = useState(false);
  const [mapId, setMapId] = useState(ESPORTS_MAPS[kind][0].id);
  const [zoom, setZoom] = useState(1);
  const [roster, setRoster] = useState<EsportsRoster>();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState("");
  const mapChosen = useRef(false);
  const { ref: mapRail, handlers: mapHandlers } = useDragScroll<HTMLDivElement>();
  const map =
    ESPORTS_MAPS[kind].find((candidate) => candidate.id === mapId) || ESPORTS_MAPS[kind][0];
  const canFetch =
    (kind === "dota" && game.source === "opendota" && game.state !== "pre") ||
    (kind === "cs2" && !!sourceUrl?.startsWith("https://bo3.gg/matches/"));
  useEffect(() => {
    if (!open || !visible || !pageVisible || !canFetch) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      setLoading(true);
      setFailed(false);
      try {
        const data = await fetchEsportsRoster(game, controller.signal, sourceUrl);
        if (!controller.signal.aborted) {
          setRoster(data);
          if (!mapChosen.current && data.maps?.[0]) {
            setMapId(data.maps[0]);
            mapChosen.current = true;
          }
        }
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          if (game.state === "in") timer = setTimeout(load, kind === "cs2" ? 60_000 : 45_000);
        }
      }
    };
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [game.id, game.state, open, visible, pageVisible, canFetch, retry, sourceUrl]);
  const players = roster?.players || [];
  const activePlayer = players.find((player) => player.id === selected);
  const laneName = (lane?: number) =>
    t(
      lane === 1
        ? "Safe lane"
        : lane === 2
          ? "Mid lane"
          : lane === 3
            ? "Off lane"
            : lane === 4
              ? "Jungle"
              : "Lane not reported",
    );
  return (
    <details
      ref={root}
      className="sh-esmap"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary tabIndex={0}>
        <SportIcon name="esports" size={25} />
        <span>
          <strong>{t("Map & players")}</strong>
          <small>
            {map.name} · {t("Map explorer")}
          </small>
        </span>
        <ChevronDown size={19} />
      </summary>
      {open && (
        <div className="sh-esmap-content">
          {ESPORTS_MAPS[kind].length > 1 && (
            <div
              className="sh-esmap-picks"
              ref={mapRail}
              {...mapHandlers}
              aria-label={t("Explore maps")}
            >
              {ESPORTS_MAPS[kind].map((candidate) => (
                <button
                  key={candidate.id}
                  aria-pressed={candidate.id === map.id}
                  onClick={() => {
                    mapChosen.current = true;
                    setMapId(candidate.id);
                    setZoom(1);
                  }}
                >
                  {candidate.name}
                </button>
              ))}
            </div>
          )}
          <div className="sh-esmap-heading">
            <div>
              <h3>{map.name}</h3>
              <p>
                {t(
                  map.referenceOnly
                    ? "Official map reference. Open the source for its available layouts."
                    : roster?.maps?.includes(map.id)
                      ? "Reported series map. Radar layout may differ by game patch."
                      : kind === "dota" || kind === "lol"
                        ? "Reference map. Layout may differ by game patch."
                        : "Reference map. The event’s selected map is not supplied by this feed.",
                )}
              </p>
            </div>
            <div className="sh-esmap-zoom">
              <button
                aria-label={t("Zoom out")}
                disabled={zoom <= 1 || (!map.image && !map.blueprint)}
                onClick={() => setZoom((value) => Math.max(1, value - 0.25))}
              >
                <Minus size={16} />
              </button>
              <button aria-label={t("Reset zoom")} onClick={() => setZoom(1)}>
                {Math.round(zoom * 100)}%
              </button>
              <button
                aria-label={t("Zoom in")}
                disabled={zoom >= 1.75 || (!map.image && !map.blueprint)}
                onClick={() => setZoom((value) => Math.min(1.75, value + 0.25))}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
          <div className="sh-esmap-layout">
            <div>
              <div className="sh-esmap-viewport">
                <div className="sh-esmap-scene" style={{ transform: `scale(${zoom})` }}>
                  <MapArtwork key={map.id} map={map} />
                </div>
              </div>
              <div className="sh-esmap-caption">
                <span>{t("Live player positions are not supplied by this feed.")}</span>
                <button onClick={() => openUrl(map.source)}>
                  {map.sourceLabel ||
                    t(map.referenceOnly ? "About the game" : "Map artwork source")}
                  <ExternalLink size={13} />
                </button>
              </div>
            </div>
            <aside className="sh-esmap-rosters">
              <div className="sh-esmap-roster-heading">
                <h4>{t("Player roster")}</h4>
                {loading && (
                  <LoaderCircle
                    className="sh-esmap-spinner"
                    size={17}
                    aria-label={t("Loading players…")}
                  />
                )}
              </div>
              {(["home", "away"] as const).map((side) => (
                <section key={side}>
                  <div className={`sh-esmap-team ${side}`}>
                    <strong>{game[side].name || t(side === "home" ? "Team 1" : "Team 2")}</strong>
                    {game[side].score !== "" && <b>{game[side].score}</b>}
                  </div>
                  {players
                    .filter((player) => player.side === side)
                    .map((player, index) => (
                      <button
                        key={player.id}
                        className="sh-esmap-player"
                        aria-pressed={selected === player.id}
                        onClick={() => setSelected(player.id)}
                      >
                        <Portrait player={player} />
                        <span>
                          <strong>{player.name || t("Player {n}", { n: index + 1 })}</strong>
                          <small>
                            {player.hero || (kind === "dota" ? t("Hero unavailable") : "")}
                            {player.lane ? ` · ${laneName(player.lane)}` : ""}
                          </small>
                          <PlayerNumbers player={player} />
                        </span>
                      </button>
                    ))}
                </section>
              ))}
              {!players.length && (
                <p className="sh-esmap-empty">
                  {t(
                    loading
                      ? "Loading players…"
                      : failed
                        ? "Player data is unavailable right now."
                        : "The free feed has not supplied a player roster for this event.",
                  )}
                </p>
              )}
              {failed && (
                <button className="sh-esmap-retry" onClick={() => setRetry((value) => value + 1)}>
                  <RotateCcw size={14} />
                  {t("Retry")}
                </button>
              )}
              {activePlayer && (
                <div className="sh-esmap-inspect">
                  <strong>{activePlayer.name || activePlayer.hero}</strong>
                  <span>
                    {activePlayer.hero}
                    {activePlayer.lane ? ` · ${laneName(activePlayer.lane)}` : ""}
                  </span>
                  {activePlayer.stats?.map((stat) => (
                    <span key={stat.label}>
                      {t(stat.label)} · {stat.value}
                    </span>
                  ))}
                  {activePlayer.profileUrl && (
                    <button onClick={() => openUrl(activePlayer.profileUrl!)}>
                      {t("Player statistics")}
                      <ExternalLink size={13} />
                    </button>
                  )}
                  {activePlayer.accountId && (
                    <button
                      onClick={() =>
                        onPlayer
                          ? onPlayer(activePlayer.accountId!)
                          : openUrl(`https://www.opendota.com/players/${activePlayer.accountId}`)
                      }
                    >
                      {t("Player statistics")}
                      <ExternalLink size={13} />
                    </button>
                  )}
                </div>
              )}
              {roster && players.length > 0 && (
                <small className="sh-esmap-provider">
                  {roster.provider || "OpenDota"} ·{" "}
                  {t(
                    roster.basis === "current-team"
                      ? "Current team roster"
                      : roster.live
                        ? "Reported picks"
                        : "Match roster",
                  )}
                  <time
                    className="sh-esmap-check-time"
                    dateTime={new Date(roster.at).toISOString()}
                  >
                    {t("Updated {time}", {
                      time: new Date(roster.at).toLocaleTimeString(locale, {
                        hour: "numeric",
                        minute: "2-digit",
                        second: "2-digit",
                      }),
                    })}
                  </time>
                </small>
              )}
            </aside>
          </div>
        </div>
      )}
    </details>
  );
}
