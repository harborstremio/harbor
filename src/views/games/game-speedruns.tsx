import { Play } from "@/components/icons/play-filled";
import { useEffect, useState } from "react";
import { DetailLoading } from "./game-detail-loading";
import { DetailDisclosure } from "./game-detail-disclosure";
import { ArrowUpRight, Trophy } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { useT } from "@/lib/i18n";
import { countryFlagSrc } from "@/components/flag";
import { openUrl } from "@/lib/window";
import { loadSpeedrunBoard, loadSpeedrunGame } from "@/lib/games/speedruns";
import { speedrunTime, type SpeedrunBoard, type SpeedrunGame, type SpeedrunRecord } from "@/lib/games/speedrun-data";
import { GameSpeedrunVideo } from "./game-speedrun-video";
import "./game-speedruns.css";

export function GameSpeedruns({ name, active }: { name: string; active: boolean }) {
  const t = useT(), [game, setGame] = useState<SpeedrunGame | null>(null), [category, setCategory] = useState("");
  const [board, setBoard] = useState<SpeedrunBoard | null>(null), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  const [watching, setWatching] = useState<SpeedrunRecord | null>(null);
  useEffect(() => { setWatching(null); }, [name, category, active]);
  useEffect(() => {
    if (!active) return;
    const request = new AbortController(); setFailed(false);
    void loadSpeedrunGame(name, request.signal).then(value => {
      if (request.signal.aborted) return;
      setGame(value); setCategory(previous => value?.categories.some(item => item.id === previous) ? previous : value?.categories[0]?.id ?? "");
    }, () => { if (!request.signal.aborted) setFailed(true); });
    return () => request.abort();
  }, [name, active, attempt]);
  useEffect(() => {
    const selected = game?.categories.find(item => item.id === category);
    setBoard(null);
    if (!active || !game || !selected) return;
    const request = new AbortController(); setFailed(false);
    void loadSpeedrunBoard(game, selected, request.signal).then(value => { if (!request.signal.aborted) setBoard(value); }, () => { if (!request.signal.aborted) setFailed(true); });
    return () => request.abort();
  }, [game, category, active, attempt]);
  if (!game && !failed) return null;
  return <><DetailDisclosure title={t("games.details.speedruns")} icon={<Trophy size={22}/>}><section className="games-detail-speedruns">
    <header><a href={game?.url ?? "https://www.speedrun.com/"} onClick={event => { event.preventDefault(); openUrl(game?.url ?? "https://www.speedrun.com/"); }}><img src="/games/brands/speedrun.ico" width={16} height={16} alt=""/>speedrun.com<ArrowUpRight size={12} aria-hidden="true"/></a></header>
    {game && <Dropdown className="games-speedrun-category" ariaLabel={t("games.details.speedrunCategory")} value={category} onChange={setCategory} size="sm" options={game.categories.map(item => ({ value: item.id, label: item.name }))}/>}
    {failed ? <p className="games-speedrun-status">{t("games.details.speedrunError")} <button onClick={() => setAttempt(value => value + 1)}>{t("common.retry")}</button></p> : !board ? <DetailLoading kind="speedrun"/> : !board.records.length ? <p className="games-speedrun-status">{t("games.details.speedrunEmpty")}</p> : board.records.map(record => <article key={record.id}>
      <a className="games-speedrun-record" href={record.url} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); openUrl(record.url); }}><span><small>{t("games.details.fastestVerified")}</small><strong>{speedrunTime(record.seconds)}</strong><small>{t(`games.details.timing.${record.timing}`)}</small></span><ArrowUpRight size={18}/></a>
      <div className="games-speedrun-runners">{record.runners.map((runner, index) => { const flag = countryFlagSrc(runner.country); return <span key={`${runner.name}:${index}`}>{flag && <img src={flag} width={18} height={12} alt=""/>}{runner.url ? <a href={runner.url} onClick={event => { event.preventDefault(); openUrl(runner.url); }}>{runner.name}</a> : runner.name}</span>; })}</div>
      <div className="games-speedrun-actions">{!!record.videos.length && <button className="games-button games-speedrun-watch" onClick={() => setWatching(record)}><Play size={15}/>{t("games.details.watchRun")}</button>}<a href={record.url} onClick={event => { event.preventDefault(); void openUrl(record.url); }}>{t("games.details.viewRun")}<ArrowUpRight size={14}/></a></div>
      <details className="games-speedrun-conditions"><summary>{t("games.details.runDetails")}<span>{record.platform}</span></summary><ul>{record.qualifiers.map(value => <li key={value}>{value}</li>)}{record.date && <li>{t("games.details.runDate", { date: new Date(`${record.date}T12:00:00Z`).toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" }) })}</li>}</ul></details>
    </article>)}
    {board && <p className="games-speedrun-source">{t("games.details.speedrunScope")}</p>}
  </section></DetailDisclosure>{active && watching && <GameSpeedrunVideo key={watching.id} game={name} category={game?.categories.find(item => item.id === category)?.name ?? ""} record={watching} close={() => setWatching(null)}/>}</>;
}
