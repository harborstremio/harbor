import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, ArrowUpRight, RefreshCw, Search } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { loadDotaHeroes, loadDotaMatchups } from "@/lib/games/dota";
import { DOTA_ATTRIBUTES, DOTA_LOGO, DOTA_SAMPLES, dotaWinRate, filterDotaHeroes, filterDotaMatchups, type DotaHero, type DotaList, type DotaMatchup, type DotaSample } from "@/lib/games/dota-data";
import { GameArt } from "./game-art";
import "./game-dota-companion.css";

type Feed<T> = { data: T | null; busy: boolean; failed: boolean; at: number };
const empty = <T,>(): Feed<T> => ({ data: null, busy: false, failed: false, at: 0 });
function External({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); openUrl(href); }}>{children}<ArrowUpRight size={13}/></a>;
}
function Status({ failed, partial, retry }: { failed: boolean; partial?: boolean; retry: () => void }) {
  const t = useT();
  return failed ? <p className="games-dota-status" role="status">{t("games.dota.unavailable")} <button onClick={retry}>{t("common.retry")}</button></p> : partial ? <p className="games-dota-status" role="status">{t("games.dota.partial")}</p> : null;
}
function Checked({ at }: { at: number }) {
  const t = useT(), language = useUiLanguage();
  return at ? <span>{t("games.dota.checked", { date: new Date(at).toLocaleString(language, { dateStyle: "medium", timeStyle: "short" }) })}</span> : null;
}
export function GameDotaCompanion({ active }: { active: boolean }) {
  const t = useT(), language = useUiLanguage(), root = useRef<HTMLElement>(null);
  const [engaged, setEngaged] = useState(false), [feed, setFeed] = useState<Feed<DotaList<DotaHero>>>(empty);
  const [attempt, setAttempt] = useState(0), refreshed = useRef(0);
  const [query, setQuery] = useState(""), [attribute, setAttribute] = useState(""), [sample, setSample] = useState<DotaSample>("pub"), [sort, setSort] = useState("picks");
  const [limit, setLimit] = useState(24), [selected, setSelected] = useState(0);
  useEffect(() => {
    if (!active || !root.current) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) setEngaged(true); }, { rootMargin: "240px" });
    observer.observe(root.current); return () => observer.disconnect();
  }, [active]);
  useEffect(() => {
    if (!active || !engaged) return;
    const controller = new AbortController(), refresh = attempt !== refreshed.current; refreshed.current = attempt;
    setFeed(value => ({ ...value, busy: true, failed: false }));
    void loadDotaHeroes(controller.signal, refresh).then(value => {
      if (controller.signal.aborted) return;
      setFeed({ data: value.data, busy: false, failed: false, at: value.at });
      setSelected(previous => value.data.items.some(hero => hero.id === previous) ? previous : filterDotaHeroes(value.data.items, "", "", "pub", "picks")[0]!.id);
    }, () => { if (!controller.signal.aborted) setFeed(value => ({ ...value, busy: false, failed: true })); });
    return () => controller.abort();
  }, [active, engaged, attempt]);
  const heroes = feed.data?.items ?? [];
  const filtered = useMemo(() => filterDotaHeroes(heroes, query, attribute, sample, sort), [heroes, query, attribute, sample, sort]);
  const hero = heroes.find(item => item.id === selected);
  const percent = new Intl.NumberFormat(language, { style: "percent", maximumFractionDigits: 1 });
  const search = (value: string) => { setQuery(value); setLimit(24); };
  const selectHero = (id: number) => {
    setSelected(id);
    if (window.matchMedia("(max-width: 1150px)").matches) requestAnimationFrame(() => {
      const panel = root.current?.querySelector<HTMLElement>(".games-dota-matchups");
      panel?.querySelector<HTMLElement>(".games-dota-selected h3")?.focus({ preventScroll: true });
      panel?.scrollIntoView({ block: "start" });
    });
  };
  const chooseHero = () => {
    requestAnimationFrame(() => {
      const target = root.current?.querySelector<HTMLElement>(`.games-dota-roster [data-dota-hero="${selected}"]`) ?? root.current?.querySelector<HTMLElement>(".games-dota-browse input");
      target?.focus({ preventScroll: true }); target?.scrollIntoView({ block: "center" });
    });
  };
  return <section ref={root} className="games-dota games-inset" aria-labelledby="dota-title">
    <header className="games-dota-heading"><div><GameArt src={DOTA_LOGO} alt="Dota 2" className="games-dota-logo"/><h2 id="dota-title">{t("games.dota.title")}</h2><p>{t("games.dota.intro")}</p></div><button className="games-button" aria-label={t("games.dota.refresh")} disabled={feed.busy} onClick={() => setAttempt(value => value + 1)}><RefreshCw size={17}/></button></header>
    <Status failed={feed.failed} partial={feed.data?.partial} retry={() => setAttempt(value => value + 1)}/>
    {!feed.data && !feed.failed ? <div className="games-dota-loading" aria-busy="true" aria-label={t("common.loading")}>{Array.from({ length: 8 }, (_, index) => <i key={index} className="games-detail-skeleton"/>)}</div> : feed.data && <div className="games-dota-workbench">
      <div className="games-dota-browse">
        <div className="games-dota-tools">
          <label className="games-dota-search" data-nav-focus-container><Search size={16}/><input value={query} onChange={event => search(event.target.value)} placeholder={t("games.dota.search")} aria-label={t("games.dota.search")}/></label>
          <Dropdown value={sample} ariaLabel={t("games.dota.sample")} options={DOTA_SAMPLES.map(value => ({ value, label: t(`games.dota.sample.${value}`) }))} onChange={value => { setSample(value as DotaSample); setLimit(24); }}/>
          <Dropdown value={sort} ariaLabel={t("games.dota.sort")} options={["picks", "win", "name"].map(value => ({ value, label: t(`games.dota.sort.${value}`) }))} onChange={value => { setSort(value); setLimit(24); }}/>
        </div>
        <div className="games-dota-attributes" role="group" aria-label={t("games.dota.attribute")}>{["", ...DOTA_ATTRIBUTES].map(value => <button key={value} aria-pressed={attribute === value} onClick={() => { setAttribute(value); setLimit(24); }}>{t(`games.dota.attribute.${value || "any"}`)}</button>)}</div>
        <p className="games-dota-scope">{t("games.dota.trendsScope")}</p>
        <div className="games-dota-roster">{filtered.slice(0, limit).map(item => {
          const stats = item.samples[sample], rate = dotaWinRate(stats);
          return <button key={item.id} data-dota-hero={item.id} aria-pressed={selected === item.id} onClick={() => selectHero(item.id)}><GameArt src={item.image}/><strong dir="auto">{item.name}</strong><span>{rate === null ? "—" : percent.format(rate)}<small>{t("games.dota.wins")}</small></span><small>{stats ? t("games.dota.picks", { count: stats.games.toLocaleString(language) }) : t("games.dota.noSample")}</small></button>;
        })}</div>
        {!filtered.length && <p className="games-dota-status">{t("games.dota.empty")}</p>}
        {filtered.length > limit && <button className="games-button games-dota-more" onClick={() => setLimit(value => value + 24)}>{t("games.dota.moreHeroes")}</button>}
        <footer><External href="https://www.opendota.com/heroes">OpenDota</External><Checked at={feed.at}/></footer>
      </div>
      {hero && <Matchups key={hero.id} hero={hero} heroes={heroes} active={active} sample={sample} chooseHero={chooseHero}/>}
    </div>}
  </section>;
}
function Matchups({ hero, heroes, active, sample, chooseHero }: { hero: DotaHero; heroes: DotaHero[]; active: boolean; sample: DotaSample; chooseHero: () => void }) {
  const t = useT(), language = useUiLanguage();
  const [feed, setFeed] = useState<Feed<DotaList<DotaMatchup>>>(empty), [attempt, setAttempt] = useState(0), refreshed = useRef(0);
  const [query, setQuery] = useState(""), [minimum, setMinimum] = useState(50), [sort, setSort] = useState("games"), [limit, setLimit] = useState(10);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController(), refresh = attempt !== refreshed.current; refreshed.current = attempt;
    setFeed(value => ({ ...value, busy: true, failed: false }));
    void loadDotaMatchups(hero.id, controller.signal, refresh).then(value => { if (!controller.signal.aborted) setFeed({ data: value.data, busy: false, failed: false, at: value.at }); }, () => { if (!controller.signal.aborted) setFeed(value => ({ ...value, busy: false, failed: true })); });
    return () => controller.abort();
  }, [hero.id, active, attempt]);
  const matches = filterDotaMatchups(feed.data?.items ?? [], heroes, query, minimum, sort);
  const partial = feed.data?.partial || feed.data?.items.some(item => !heroes.some(hero => hero.id === item.id));
  const percent = new Intl.NumberFormat(language, { style: "percent", maximumFractionDigits: 1 }), rate = dotaWinRate(hero.samples[sample]);
  return <aside className="games-dota-matchups" aria-label={t("games.dota.matchups")}>
    <button className="games-dota-return games-button" onClick={chooseHero}><ArrowUp size={15}/>{t("games.dota.chooseHero")}</button>
    <header className="games-dota-selected"><GameArt src={hero.image}/><div><p>{t(`games.dota.sample.${sample}`)}</p><h3 dir="auto" tabIndex={-1}>{hero.name}</h3><span>{rate === null ? "—" : percent.format(rate)} {t("games.dota.wins")}</span></div></header>
    <div className="games-dota-matchup-heading"><h3>{t("games.dota.matchups")}</h3><button className="games-button" aria-label={t("games.dota.refreshMatchups")} disabled={feed.busy} onClick={() => setAttempt(value => value + 1)}><RefreshCw size={15}/></button></div>
    <p className="games-dota-scope">{t("games.dota.matchupsScope", { hero: hero.name })}</p>
    <div className="games-dota-tools">
      <label className="games-dota-search" data-nav-focus-container><Search size={15}/><input value={query} onChange={event => { setQuery(event.target.value); setLimit(10); }} placeholder={t("games.dota.opponent")} aria-label={t("games.dota.opponent")}/></label>
      <Dropdown value={String(minimum)} ariaLabel={t("games.dota.minimum")} options={[0, 20, 50, 100].map(value => ({ value: String(value), label: t("games.dota.minGames", { count: value.toLocaleString(language) }) }))} onChange={value => { setMinimum(Number(value)); setLimit(10); }}/>
      <Dropdown value={sort} ariaLabel={t("games.dota.sortMatchups")} options={["games", "high", "low"].map(value => ({ value, label: t(`games.dota.matchupSort.${value}`) }))} onChange={value => { setSort(value); setLimit(10); }}/>
    </div>
    <Status failed={feed.failed} partial={partial} retry={() => setAttempt(value => value + 1)}/>
    {!feed.data && !feed.failed ? <div className="games-dota-matchup-loading" aria-busy="true" aria-label={t("common.loading")}>{Array.from({ length: 5 }, (_, index) => <i className="games-detail-skeleton" key={index}/>)}</div> : feed.data && <>
      <ol className="games-dota-opponents">{matches.slice(0, limit).map(item => {
        const rate = dotaWinRate(item);
        return <li key={item.id}><GameArt src={item.hero.image}/><div><strong dir="auto">{item.hero.name}</strong><small>{t("games.dota.games", { count: item.games.toLocaleString(language) })}</small></div><span>{rate === null ? "—" : percent.format(rate)}</span></li>;
      })}</ol>
      {!matches.length && <p className="games-dota-status">{feed.data.items.length ? t("games.dota.emptyMatchups") : t("games.dota.noMatchups")}</p>}
      {matches.length > limit && <button className="games-button games-dota-more" onClick={() => setLimit(value => value + 10)}>{t("games.dota.moreMatchups")}</button>}
    </>}
    <footer><External href={`https://www.opendota.com/heroes/${hero.id}/matchups`}>OpenDota</External><Checked at={feed.at}/></footer>
  </aside>;
}
