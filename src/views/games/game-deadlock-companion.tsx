import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, RefreshCw, Search } from "lucide-react";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { Dropdown } from "@/components/dropdown";
import { loadDeadlockCompanion, type DeadlockCompanionData } from "@/lib/games/deadlock";
import { deadlockRoster, DEADLOCK_STATS_TTL } from "@/lib/games/deadlock-data";
import { GameArt } from "./game-art";
import { useLiveRefresh } from "./use-live-refresh";
import { GameDeadlockBuilds } from "./game-deadlock-builds";
import "./game-deadlock-companion.css";

const SOURCE = "https://deadlock-api.com/analytics/heroes";

export function GameDeadlockCompanion({ active }: { active: boolean }) {
  const t = useT(), language = useUiLanguage(), root = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false), [data, setData] = useState<DeadlockCompanionData | null>(null);
  const [failed, setFailed] = useState(false), [busy, setBusy] = useState(false), [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState(""), [sort, setSort] = useState<"matches" | "winRate" | "name">("matches");
  const [expanded, setExpanded] = useState(false), [selected, setSelected] = useState<number | null>(null);
  const forceRefresh = useRef(false);
  const refresh = () => { forceRefresh.current = true; setAttempt(value => value + 1); };
  const revision = useLiveRefresh(active && visible, DEADLOCK_STATS_TTL);
  useEffect(() => {
    if (!active || !root.current) return;
    const observer = new IntersectionObserver(entries => setVisible(entries.some(entry => entry.isIntersecting)), { rootMargin: "240px" });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [active]);
  useEffect(() => {
    if (!active || !visible || document.hidden) return;
    const controller = new AbortController(), force = forceRefresh.current; forceRefresh.current = false; setBusy(true); setFailed(false);
    void loadDeadlockCompanion(language, controller.signal, force).then(value => {
      if (!controller.signal.aborted) { setData(value); setBusy(false); }
    }, () => { if (!controller.signal.aborted) { setFailed(true); setBusy(false); } });
    return () => controller.abort();
  }, [active, visible, language, attempt, revision]);
  const heroes = data ? deadlockRoster(data.heroes, data.stats, query, sort) : [];
  const shown = expanded || query ? heroes : heroes.slice(0, 8);
  const chosen = heroes.find(hero => hero.id === selected) ?? heroes[0];
  const percentage = (value: number) => value.toLocaleString(language, { style: "percent", maximumFractionDigits: 1 });
  return <section ref={root} className="games-deadlock games-inset" aria-labelledby="deadlock-companion-title">
    <header className="games-deadlock-heading"><div><h2 id="deadlock-companion-title">{t("games.companion.heroes")}</h2><p>{t("games.companion.scope")}</p></div>
      <button className="games-button" disabled={busy} onClick={refresh} aria-label={t("games.companion.refresh")}><RefreshCw size={16}/></button>
    </header>
    {(failed || data?.statsUnavailable) && <p className="games-deadlock-status" role="status">{t(failed ? "games.companion.unavailable" : "games.companion.statsUnavailable")} <button onClick={refresh} disabled={busy}>{t("common.retry")}</button></p>}
    {!data && !failed ? <div className="games-deadlock-loading" aria-busy="true" aria-label={t("common.loading")}><i className="games-detail-skeleton"/>{Array.from({length: 8}, (_, index) => <i key={index} className="games-detail-skeleton"/>)}</div> : data && <>
      <div className="games-deadlock-tools"><label><Search size={17}/><input aria-label={t("games.companion.search")} placeholder={t("games.companion.search")} value={query} onChange={event => { setQuery(event.target.value); setSelected(null); }} maxLength={100}/></label>
        <Dropdown ariaLabel={t("games.companion.sort")} value={sort} options={[{value:"matches",label:t("games.companion.mostPlayed")},{value:"winRate",label:t("games.companion.winRate")},{value:"name",label:t("games.companion.name")}]} onChange={value => { setSort(value as typeof sort); setSelected(null); }} />
      </div>
      {chosen ? <div className="games-deadlock-body">
        <div className="games-deadlock-feature"><GameArt key={chosen.id} src={chosen.image} eager/><div><h3>{chosen.name}</h3><strong>{chosen.role}</strong><p>{chosen.playstyle}</p>
          {chosen.stats ? <dl><div><dt>{t("games.companion.winRate")}</dt><dd>{percentage(chosen.stats.winRate)}</dd></div><div><dt>{t("games.companion.matches")}</dt><dd>{chosen.stats.matches.toLocaleString(language)}</dd></div></dl> : <p>{t("games.companion.noSample")}</p>}
          <GameDeadlockBuilds key={chosen.id} hero={chosen} active={active} onOpen={() => setSelected(chosen.id)}/>
        </div></div>
        <div><div className="games-deadlock-roster">{shown.map(hero => <button key={hero.id} aria-pressed={hero.id === chosen.id} onClick={() => setSelected(hero.id)}>
          <GameArt src={hero.image}/><span><strong>{hero.name}</strong><small>{hero.stats ? t("games.companion.matchCount", {count:hero.stats.matches.toLocaleString(language)}) : t("games.companion.noSample")}</small></span>
          <span className="games-deadlock-rate" aria-label={hero.stats ? `${t("games.companion.winRate")}: ${percentage(hero.stats.winRate)}` : undefined}>{hero.stats ? percentage(hero.stats.winRate) : "—"}</span>
        </button>)}</div>
          {!query && heroes.length > 8 && <button className="games-deadlock-more" aria-expanded={expanded} onClick={() => { setExpanded(value => !value); if (expanded && !heroes.slice(0, 8).some(hero => hero.id === selected)) setSelected(null); }}>{t(expanded ? "games.companion.showLess" : "games.companion.showAll", {count:heroes.length})}</button>}
        </div>
      </div> : <p className="games-deadlock-status" role="status">{t("games.companion.noMatches")}</p>}
      <footer><a href={SOURCE} target="_blank" rel="noreferrer" onClick={event => {event.preventDefault();openUrl(SOURCE);}}>Deadlock API <ArrowUpRight size={14}/></a>{data.stats.length > 0 && <span>{t("games.companion.through", {date:new Date(data.to * 1000).toLocaleString(language, {dateStyle:"medium",timeStyle:"short"})})}</span>}<p>{t("games.companion.sampleNote")}</p></footer>
    </>}
  </section>;
}
