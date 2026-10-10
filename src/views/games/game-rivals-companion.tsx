import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { ArrowUpRight, RefreshCw, Search } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { loadRivalsOfficial, loadRivalsPairs, loadRivalsStats } from "@/lib/games/rivals";
import { filterRivalsHeroes, rivalsMatchups, rivalsRoster, RIVALS_LOGO, RIVALS_SOURCE, RIVALS_STALE, RIVALS_TTL, type RivalsHero, type RivalsOfficialHero, type RivalsPairs, type RivalsStats } from "@/lib/games/rivals-data";
import { GameArt } from "./game-art";
import { GameRivalsGuide } from "./game-rivals-guide";
import { useLiveRefresh } from "./use-live-refresh";
import "./game-rivals-companion.css";

type Feed<T> = { data: T | null; busy: boolean; failed: boolean };
const empty = <T,>(): Feed<T> => ({ data: null, busy: true, failed: false });

export function GameRivalsCompanion({ active }: { active: boolean }) {
  const t = useT(), language = useUiLanguage(), root = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false), [activated, setActivated] = useState(false), [attempt, setAttempt] = useState(0), [now, setNow] = useState(Date.now);
  const [official, setOfficial] = useState<Feed<RivalsOfficialHero[]>>(empty), [stats, setStats] = useState<Feed<RivalsStats>>(empty);
  const [counters, setCounters] = useState<Feed<RivalsPairs>>(empty), [synergy, setSynergy] = useState<Feed<RivalsPairs>>(empty);
  const [query, setQuery] = useState(""), [role, setRole] = useState("all"), [sort, setSort] = useState("matches"), [limit, setLimit] = useState(12), [selection, setSelection] = useState<string | null>(null);
  const [counterMode, setCounterMode] = useState<"hardest" | "best">("hardest");
  const revision = useLiveRefresh(active && visible, RIVALS_TTL), label = (key: string) => t(`games.rivals.${key}`);
  useEffect(() => {
    if (!active) { setActivated(false); setVisible(false); return; }
    if (!root.current) return;
    const observer = new IntersectionObserver(entries => {
      const inView = entries.some(entry => entry.isIntersecting);
      setVisible(inView); if (inView) setActivated(true);
    }, { rootMargin: "240px" });
    observer.observe(root.current); return () => observer.disconnect();
  }, [active]);
  useEffect(() => {
    // Finish the bounded batch after first exposure, even if late content above
    // moves it offscreen. Refresh polling still requires current visibility.
    if (!active || !activated) return;
    const controller = new AbortController(); setNow(Date.now());
    const read = <T,>(task: Promise<{data: T}>, update: Dispatch<SetStateAction<Feed<T>>>) => {
      update(previous => ({ ...previous, busy: true, failed: false }));
      void task.then(value => { if (!controller.signal.aborted) { update({data:value.data,busy:false,failed:false}); setNow(Date.now()); } }, () => { if (!controller.signal.aborted) update(previous => ({...previous,busy:false,failed:true})); });
    };
    read(loadRivalsOfficial(controller.signal, attempt > 0), setOfficial);
    read(loadRivalsStats(controller.signal, attempt > 0), setStats);
    read(loadRivalsPairs("counters", controller.signal, attempt > 0), setCounters);
    read(loadRivalsPairs("synergy", controller.signal, attempt > 0), setSynergy);
    return () => controller.abort();
  }, [active, activated, attempt, revision]);
  const roster = useMemo(() => rivalsRoster(official.data ?? [], stats.data), [official.data, stats.data]);
  const heroes = useMemo(() => filterRivalsHeroes(roster, query, role, sort), [roster, query, role, sort]);
  const selected = heroes.find(hero => hero.key === selection) ?? heroes[0];
  const busy = [official, stats, counters, synergy].some(feed => feed.busy);
  const stale = [stats, counters, synergy].some(feed => feed.data && now - feed.data.generatedAt > RIVALS_STALE);
  const percent = (value: number) => value.toLocaleString(language, {style:"percent",maximumFractionDigits:1});
  const date = (value: number) => new Date(value).toLocaleString(language, {dateStyle:"medium",timeStyle:"short"});
  const reset = () => { setSelection(null); setLimit(12); };
  return <section ref={root} className="games-rivals games-inset" aria-labelledby="rivals-guide-title">
    <header className="games-rivals-heading"><div><GameArt className="games-rivals-logo" src={RIVALS_LOGO}/><h2 id="rivals-guide-title">{label("title")}</h2><p>{label("intro")}</p></div><button className="games-button" aria-label={label("refresh")} disabled={busy} onClick={() => setAttempt(value=>value+1)}><RefreshCw size={18}/></button></header>
    {(official.failed || stats.failed) && <p className="games-rivals-status" role="status">{label(stats.failed ? "statsFailed" : "artFailed")}</p>}
    {stale && <p className="games-rivals-status" role="status">{label("stale")}</p>}
    {[stats,counters,synergy].some(feed=>feed.data?.partial) && <p className="games-rivals-status" role="status">{label("partial")}</p>}
    <div className="games-rivals-tools"><div className="games-rivals-roles" role="group" aria-label={label("role")}>{["all","vanguard","duelist","strategist"].map(value=><button key={value} aria-pressed={role===value} onClick={()=>{setRole(value);reset();}}>{label(value)}</button>)}</div>
      <Dropdown ariaLabel={label("sort")} value={sort} options={["matches","winRate","name"].map(value=>({value,label:label(`sort.${value}`)}))} onChange={value=>{setSort(value);reset();}}/>
      <label className="games-rivals-search" data-tv-focus-container><Search size={17}/><input type="search" value={query} maxLength={100} spellCheck={false} autoComplete="off" aria-label={label("search")} placeholder={label("search")} onChange={event=>{setQuery(event.target.value);reset();}}/></label>
    </div>
    {!roster.length && (!official.failed || !stats.failed) && (busy || !visible) ? <div className="games-rivals-loading" aria-busy="true" aria-label={t("common.loading")}><div className="games-rivals-roster">{Array.from({length:12},(_,index)=><i key={index} className="games-detail-skeleton"/>)}</div><div className="games-rivals-detail"><i className="games-detail-skeleton"/><i className="games-detail-skeleton"/></div></div> : selected ? <>
      <div className="games-rivals-roster">{heroes.slice(0,limit).map(hero=><button key={hero.key} aria-pressed={hero.key===selected.key} onClick={()=>setSelection(hero.key)} aria-label={hero.name}><GameArt src={hero.thumbnail}/><span>{hero.name}</span></button>)}</div>
      {heroes.length>limit && <button className="games-rivals-more" onClick={()=>setLimit(value=>value+24)}>{label("more")}</button>}
      <div className="games-rivals-detail" key={selected.key}>
        <article className="games-rivals-identity"><div className="games-rivals-portrait"><GameArt src={selected.portrait} eager/></div><div><span className="games-rivals-role">{label(selected.role)}</span><h3>{selected.name}</h3>
          {selected.stat ? <dl><div><dt>{label("winRate")}</dt><dd>{percent(selected.stat.winRate)}</dd></div><div><dt>{label("pickRate")}</dt><dd>{percent(selected.stat.pickRate)}</dd></div><div><dt>{label("matches")}</dt><dd>{selected.stat.matches.toLocaleString(language)}</dd></div></dl> : <p>{label("noSample")}</p>}
          <GameRivalsGuide hero={selected} active={active}/>
          {selected.url && <a href={selected.url} target="_blank" rel="noreferrer" onClick={event=>{event.preventDefault();openUrl(selected.url);}}>{label("official")}<ArrowUpRight size={15}/></a>}
        </div></article>
        <div className="games-rivals-comparisons"><div className="games-rivals-comparison"><div className="games-rivals-comparison-heading"><h4>{label("against")}</h4><Dropdown ariaLabel={label("matchups")} value={counterMode} options={["hardest","best"].map(value=>({value,label:label(value)}))} onChange={value=>setCounterMode(value as typeof counterMode)}/></div><p>{t("games.rivals.heroRate",{hero:selected.name})}</p><Pairings hero={selected} roster={roster} feed={counters} stats={stats.data} mode={counterMode}/></div>
          <div className="games-rivals-comparison"><div className="games-rivals-comparison-heading"><h4>{label("with")}</h4></div><p>{label("duoRate")}</p><Pairings hero={selected} roster={roster} feed={synergy} stats={stats.data} mode="with"/></div>
        </div>
      </div>
    </> : <p className="games-rivals-status" role="status">{label(roster.length ? "noMatches" : "unavailable")}</p>}
    <footer><a href={`${RIVALS_SOURCE}/marvel-rivals/methodology`} target="_blank" rel="noreferrer" onClick={event=>{event.preventDefault();openUrl(`${RIVALS_SOURCE}/marvel-rivals/methodology`);}}>batru.gg<ArrowUpRight size={14}/></a>{stats.data && <span>{t("games.rivals.snapshot",{date:date(stats.data.generatedAt)})}</span>}<p>{label("scope")}</p></footer>
  </section>;
}

function Pairings({hero,roster,feed,stats,mode}:{hero:RivalsHero;roster:RivalsHero[];feed:Feed<RivalsPairs>;stats:RivalsStats|null;mode:"hardest"|"best"|"with"}) {
  const t=useT(),language=useUiLanguage(),label=(key:string)=>t(`games.rivals.${key}`);
  const pairs=rivalsMatchups(hero,roster,feed.data,stats,mode).slice(0,5);
  if(feed.busy&&!feed.data)return <div className="games-rivals-pair-loading" aria-busy="true" aria-label={t("common.loading")}>{Array.from({length:5},(_,i)=><i className="games-detail-skeleton" key={i}/>)}</div>;
  const mismatch=!!feed.data&&!!stats&&feed.data.season!==stats.season;
  return <div className="games-rivals-pairings">{(feed.failed||mismatch)&&<p className="games-rivals-status" role="status">{label(mismatch?"mismatch":"pairsFailed")}</p>}{pairs.length ? <ul>{pairs.map(pair=><li key={pair.id}><GameArt src={pair.hero.thumbnail}/><div><strong>{pair.hero.name}</strong><span>{t("games.rivals.sample",{count:pair.matches.toLocaleString(language)})}</span></div><b>{pair.winRate.toLocaleString(language,{style:"percent",maximumFractionDigits:1})}</b></li>)}</ul> : !feed.failed&&!mismatch&&<p className="games-rivals-status">{label("noSample")}</p>}
    {feed.data&&!mismatch&&<small>{t("games.rivals.snapshot",{date:new Date(feed.data.generatedAt).toLocaleDateString(language,{dateStyle:"medium"})})}</small>}
  </div>;
}
