import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, Clock3, RefreshCw, Search } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { loadDarktideBoard } from "@/lib/games/darktide";
import { currentDarktideMissions, darktideCondition, DARKTIDE_SOURCE, DARKTIDE_STALE, DARKTIDE_TTL, type DarktideBoard, type DarktideMission } from "@/lib/games/darktide-data";
import { GameArt } from "./game-art";
import { useLiveRefresh } from "./use-live-refresh";
import "./game-darktide-companion.css";

const DIFFICULTIES = ["all", "1", "2", "3", "4", "5", "auric", "unknown"];
const CATEGORIES = ["common", "maelstrom", "story", "all"];

export function GameDarktideCompanion({ active, hero = "", logo = "" }: { active: boolean; hero?: string; logo?: string }) {
  const t = useT(), language = useUiLanguage(), root = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false), [observation, setObservation] = useState<{ data: DarktideBoard; at: number } | null>(null);
  const [busy, setBusy] = useState(false), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  const [category, setCategory] = useState("common"), [difficulty, setDifficulty] = useState("all"), [query, setQuery] = useState(""), [limit, setLimit] = useState(6);
  const [now, setNow] = useState(Date.now);
  const revision = useLiveRefresh(active && visible, DARKTIDE_TTL);
  useEffect(() => {
    if (!active || !root.current) return;
    const observer = new IntersectionObserver(entries => setVisible(entries.some(entry => entry.isIntersecting)), { rootMargin: "240px" });
    observer.observe(root.current); return () => observer.disconnect();
  }, [active]);
  useEffect(() => {
    if (!active || !visible) return;
    const tick = () => { if (!document.hidden) setNow(Date.now()); };
    tick(); const timer = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, [active, visible]);
  useEffect(() => {
    if (!active || !visible || document.hidden) return;
    const controller = new AbortController(); setBusy(true); setFailed(false);
    void loadDarktideBoard(controller.signal, attempt > 0).then(value => {
      if (!controller.signal.aborted) { setObservation(value); setNow(Date.now()); setBusy(false); }
    }, () => { if (!controller.signal.aborted) { setFailed(true); setBusy(false); } });
    return () => controller.abort();
  }, [active, visible, attempt, revision]);
  const stale = observation !== null && now - observation.at >= DARKTIDE_STALE;
  const missions = observation ? currentDarktideMissions(observation.data, now, category, difficulty, query) : [];
  const anyCurrent = observation ? currentDarktideMissions(observation.data, now, "all", "all", "").length > 0 : false;
  const date = (value: number) => new Date(value).toLocaleString(language, { dateStyle: "medium", timeStyle: "short" });
  const label = (key: string) => t(`games.darktide.${key}`);
  return <section ref={root} className="games-darktide games-inset" aria-labelledby="darktide-board-title">
    <header className="games-darktide-heading">
      <GameArt className="games-darktide-world" src={hero}/>
      <div className="games-darktide-heading-copy"><GameArt className="games-darktide-logo" src={logo}/><p>WARHAMMER 40,000 · DARKTIDE</p><h2 id="darktide-board-title">{label("title")}</h2><span>{label("intro")}</span></div>
      <button className="games-button games-darktide-refresh" aria-label={label("refresh")} disabled={busy} onClick={() => setAttempt(value => value + 1)}><RefreshCw size={18}/></button>
    </header>
    <div className="games-darktide-tools">
      <div className="games-darktide-categories" aria-label={label("category")} role="group">{CATEGORIES.map(value => <button key={value} aria-pressed={category === value} onClick={() => { setCategory(value); setLimit(6); }}>{label(value)}</button>)}</div>
      <Dropdown ariaLabel={label("difficulty")} value={difficulty} options={DIFFICULTIES.map(value => ({ value, label: label(`difficulty.${value}`) }))} onChange={value => { setDifficulty(value); setLimit(6); }}/>
      <label className="games-darktide-search"><Search size={17}/><input type="search" maxLength={100} aria-label={label("search")} placeholder={label("search")} value={query} onChange={event => { setQuery(event.target.value); setLimit(6); }}/></label>
    </div>
    {(failed || stale) && <p className="games-darktide-status" role="status">{label(stale ? "stale" : "failed")} <button className="games-button" disabled={busy} onClick={() => setAttempt(value => value + 1)}>{t("common.retry")}</button></p>}
    {observation?.data.partial && <p className="games-darktide-status" role="status">{label("partial")}</p>}
    {!observation && !failed ? <div className="games-darktide-grid" aria-busy="true" aria-label={t("common.loading")}>{Array.from({length:6}, (_, index) => <div key={index} className="games-darktide-skeleton games-detail-skeleton"/>)}</div>
      : observation && !stale && <>{missions.length ? <div className="games-darktide-grid">{missions.slice(0, limit).map(mission => <Mission key={mission.id} mission={mission} now={now}/>)}</div> : <p className="games-darktide-status" role="status">{label(anyCurrent ? "noMatches" : "empty")}</p>}
      {missions.length > limit && <button className="games-button games-darktide-more" onClick={() => setLimit(value => value + 12)}>{label("more")}<ChevronDown size={17}/></button>}</>}
    <footer><a href={DARKTIDE_SOURCE} target="_blank" rel="noreferrer" onClick={event => {event.preventDefault();openUrl(DARKTIDE_SOURCE);}}>OtwakO · Darktide Mission<ArrowUpRight size={14}/></a>{observation && <span>{t("games.darktide.checked", {date:date(observation.at)})}</span>}<p>{label("scope")}</p></footer>
  </section>;
}

function Mission({ mission, now }: { mission: DarktideMission; now: number }) {
  const t = useT(), language = useUiLanguage();
  const conditions = darktideCondition(mission.condition);
  const minutes = Math.max(1, Math.ceil((mission.expiry - now) / 60_000));
  const ends = new Date(mission.expiry).toLocaleString(language, { dateStyle: "medium", timeStyle: "short" });
  const label = (key: string) => t(`games.darktide.${key}`);
  return <details className="games-darktide-mission">
    <summary>
      <div className="games-darktide-scene"><GameArt src={mission.image}/><span className="games-darktide-difficulty">{label(`difficulty.${mission.difficulty}`)}</span><time dateTime={new Date(mission.expiry).toISOString()} title={ends}><Clock3 size={14}/>{t("games.darktide.remaining", {count:minutes.toLocaleString(language)})}</time></div>
      <div className="games-darktide-mission-name"><div><span>{label(CATEGORIES.includes(mission.category) ? mission.category : "unknown")}</span><h3>{mission.name}</h3></div><ChevronDown size={18}/></div>
      {conditions.length > 0 && <p className="games-darktide-conditions">{conditions.map(value => label(`condition.${value}`)).join(" · ")}</p>}
    </summary>
    <div className="games-darktide-mission-info"><dl>{([["credits", mission.credits], ["xp", mission.xp], ["level", mission.requiredLevel]] as const).map(([key, value]) => <div key={key}><dt>{label(key)}</dt><dd>{value === null ? "—" : value.toLocaleString(language)}</dd></div>)}</dl>
      <p>{t("games.darktide.ends", {date:ends})}</p>
      {mission.sideMission && mission.sideMission !== "no_side_mission" && <p>{label("objective")}: {mission.sideMission === "side_mission_tome" ? label("scriptures") : mission.sideMission === "side_mission_grimoire" ? label("grimoires") : <code>{mission.sideMission}</code>}</p>}
      {conditions.includes("unknown") && <p>{label("modifier")}: <code>{mission.condition}</code></p>}
    </div>
  </details>;
}
