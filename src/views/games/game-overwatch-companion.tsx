import { Play } from "@/components/icons/play-filled";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, RefreshCw, Search, X } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { loadOverwatchHeroes, loadOverwatchHero, loadOverwatchMaps, loadOverwatchModes } from "@/lib/games/overwatch";
import { OVERWATCH_API, OVERWATCH_LOGO, OVERWATCH_ROLES, OVERWATCH_ROLE_ICONS, filterOverwatchHeroes, overwatchHeroUrl, type OverwatchAbility, type OverwatchHero, type OverwatchHeroDetail, type OverwatchList, type OverwatchMap, type OverwatchMode } from "@/lib/games/overwatch-data";
import { GameArt } from "./game-art";
import "./game-overwatch-companion.css";

type Feed<T> = { data: T | null; busy: boolean; failed: boolean; at: number };
const empty = <T,>(): Feed<T> => ({ data: null, busy: false, failed: false, at: 0 });
function External({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); openUrl(href); }}>{children}<ArrowUpRight size={14}/></a>;
}
function FeedStatus({ failed, partial, retry }: { failed: boolean; partial?: boolean; retry: () => void }) {
  const t = useT();
  return failed ? <p className="games-overwatch-status" role="status">{t("games.overwatch.unavailable")} <button onClick={retry}>{t("common.retry")}</button></p> : partial ? <p className="games-overwatch-status" role="status">{t("games.overwatch.partial")}</p> : null;
}
function Footer({ at, maps = false }: { at: number; maps?: boolean }) {
  const t = useT(), language = useUiLanguage();
  return <footer><External href={OVERWATCH_API}>OverFast</External>{at > 0 && <span>{t("games.overwatch.checked", { date: new Date(at).toLocaleString(language, { dateStyle: "medium", timeStyle: "short" }) })}</span>}<p>{t(maps ? "games.overwatch.mapsScope" : "games.overwatch.scope")}</p></footer>;
}
export function GameOverwatchCompanion({ active }: { active: boolean }) {
  const language = useUiLanguage();
  return <Companion key={language} active={active} language={language}/>;
}
function Companion({ active, language }: { active: boolean; language: string }) {
  const t = useT(), root = useRef<HTMLElement>(null), [engaged, setEngaged] = useState(false), [tab, setTab] = useState("heroes");
  useEffect(() => {
    if (!active || !root.current) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) setEngaged(true); }, { rootMargin: "240px" });
    observer.observe(root.current); return () => observer.disconnect();
  }, [active]);
  return <section ref={root} className="games-overwatch games-inset" aria-labelledby="overwatch-title">
    <header className="games-overwatch-heading"><div><GameArt src={OVERWATCH_LOGO} alt="Overwatch" className="games-overwatch-logo"/><h2 id="overwatch-title">{t("games.overwatch.title")}</h2><p>{t("games.overwatch.intro")}</p></div><div className="games-overwatch-tabs" role="group" aria-label={t("games.overwatch.browse")}>{["heroes", "maps"].map(value => <button key={value} aria-pressed={tab === value} onClick={() => setTab(value)}>{t(`games.overwatch.${value}`)}</button>)}</div></header>
    <div hidden={tab !== "heroes"}><Heroes active={active && tab === "heroes"} engaged={engaged} language={language}/></div>
    <div hidden={tab !== "maps"}><Maps active={active && tab === "maps"} engaged={engaged}/></div>
  </section>;
}
function Heroes({ active, engaged, language }: { active: boolean; engaged: boolean; language: string }) {
  const t = useT(), [feed, setFeed] = useState<Feed<OverwatchList<OverwatchHero>>>(empty), [attempt, setAttempt] = useState(0);
  const refreshed = useRef(0);
  const [query, setQuery] = useState(""), [role, setRole] = useState("all"), [stadium, setStadium] = useState(false), [selection, setSelection] = useState(""), [limit, setLimit] = useState(16);
  useEffect(() => {
    if (!active || !engaged) return;
    const controller = new AbortController(); setFeed(value => ({ ...value, busy: true, failed: false }));
    const refresh = attempt !== refreshed.current; refreshed.current = attempt;
    void loadOverwatchHeroes(language, controller.signal, refresh).then(value => { if (!controller.signal.aborted) setFeed({ ...value, busy: false, failed: false }); }, () => { if (!controller.signal.aborted) setFeed(value => ({ ...value, busy: false, failed: true })); });
    return () => controller.abort();
  }, [active, engaged, language, attempt]);
  const heroes = useMemo(() => filterOverwatchHeroes(feed.data?.items ?? [], query, role, stadium), [feed.data, query, role, stadium]);
  const selected = heroes.find(hero => hero.key === selection) ?? heroes[0];
  const reset = () => { setLimit(16); setSelection(""); };
  return <>
    <div className="games-overwatch-tools"><div className="games-overwatch-roles" role="group" aria-label={t("games.overwatch.role")}>{["all", ...OVERWATCH_ROLES].map(value => <button key={value} aria-pressed={value === role} onClick={() => { setRole(value); reset(); }}>{value !== "all" && <GameArt src={OVERWATCH_ROLE_ICONS[value as keyof typeof OVERWATCH_ROLE_ICONS]}/>}<span>{t(`games.overwatch.${value}`)}</span></button>)}</div>
      <button className="games-overwatch-stadium" aria-pressed={stadium} onClick={() => { setStadium(value => !value); reset(); }}>{t("games.overwatch.stadium")}</button>
      <label className="games-overwatch-search" data-tv-focus-container><Search size={17}/><input type="search" autoComplete="off" spellCheck={false} maxLength={100} aria-label={t("games.overwatch.searchHeroes")} placeholder={t("games.overwatch.searchHeroes")} value={query} onChange={event => { setQuery(event.target.value); reset(); }}/></label>
      <button className="games-button" aria-label={t("games.overwatch.refresh")} disabled={feed.busy} onClick={() => setAttempt(value => value + 1)}><RefreshCw size={17}/></button>
    </div>
    <FeedStatus failed={feed.failed} partial={feed.data?.partial} retry={() => setAttempt(value => value + 1)}/>
    {!feed.data && !feed.failed ? <div className="games-overwatch-roster" aria-label={t("common.loading")} aria-busy="true">{Array.from({ length: 16 }, (_, index) => <i key={index} className="games-detail-skeleton"/>)}</div> : heroes.length ? <>
      <div className="games-overwatch-roster">{heroes.slice(0, limit).map(hero => <button key={hero.key} aria-label={hero.name} aria-pressed={hero.key === selected?.key} onClick={() => setSelection(hero.key)}><GameArt src={hero.portrait}/><span dir="auto">{hero.name}</span></button>)}</div>
      {heroes.length > limit && <button className="games-overwatch-more" onClick={() => setLimit(value => value + 24)}>{t("games.overwatch.moreHeroes")}<ChevronDown size={15}/></button>}
      {selected && <Hero key={selected.key} hero={selected} active={active} language={language} refreshToken={attempt}/>}
    </> : feed.data && <p className="games-overwatch-status" role="status">{t("games.overwatch.empty")}</p>}
    <Footer at={feed.at}/>
  </>;
}
function Hero({ hero, active, language, refreshToken }: { hero: OverwatchHero; active: boolean; language: string; refreshToken: number }) {
  const t = useT(), [feed, setFeed] = useState<Feed<OverwatchHeroDetail>>(empty), [attempt, setAttempt] = useState(0);
  const refreshed = useRef({ attempt: 0, token: refreshToken });
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController(); setFeed(value => ({ ...value, busy: true, failed: false }));
    const refresh = attempt !== refreshed.current.attempt || refreshToken !== refreshed.current.token; refreshed.current = { attempt, token: refreshToken };
    void loadOverwatchHero(hero, language, controller.signal, refresh).then(value => { if (!controller.signal.aborted) setFeed({ ...value, busy: false, failed: false }); }, () => { if (!controller.signal.aborted) setFeed(value => ({ ...value, busy: false, failed: true })); });
    return () => controller.abort();
  }, [active, hero.key, hero.name, hero.role, language, attempt, refreshToken]);
  const detail = feed.data;
  return <article className="games-overwatch-hero" aria-label={hero.name}>
    <div className="games-overwatch-splash"><GameArt src={detail?.background ?? ""} className="games-overwatch-hero-art"/>
      <div className="games-overwatch-hero-copy"><span><GameArt src={OVERWATCH_ROLE_ICONS[hero.role]}/>{t(`games.overwatch.${hero.role}`)}</span><h3 dir="auto">{hero.name}</h3>{detail ? <p dir="auto">{detail.description}</p> : !feed.failed && <div className="games-overwatch-copy-loading" aria-busy="true" aria-label={t("common.loading")}><i className="games-detail-skeleton"/><i className="games-detail-skeleton"/></div>}<External href={overwatchHeroUrl(hero.key, language)}>{t("games.overwatch.official")}</External></div>
    </div>
    <FeedStatus failed={feed.failed} partial={detail?.partial} retry={() => setAttempt(value => value + 1)}/>
    {detail ? <>
      <h4>{t("games.overwatch.abilities")}</h4><div className="games-overwatch-abilities">{detail.abilities.map((ability, index) => <Ability key={`${index}:${ability.name}`} ability={ability} active={active}/>)}</div>
      {!!(detail.minor.length || detail.major.length) && <details className="games-overwatch-disclosure"><summary>{t("games.overwatch.perks")}<ChevronDown size={18}/></summary><div className="games-overwatch-perks">{(["minor", "major"] as const).map(kind => detail[kind].length ? <div key={kind}><h4>{t(`games.overwatch.${kind}`)}</h4>{detail[kind].map((ability, index) => <Ability key={`${index}:${ability.name}`} ability={ability} active={active}/>)}</div> : null)}</div></details>}
      {!!detail.stadium.length && <details className="games-overwatch-disclosure"><summary>{t("games.overwatch.powers")}<ChevronDown size={18}/></summary><div className="games-overwatch-abilities">{detail.stadium.map((ability, index) => <Ability key={`${index}:${ability.name}`} ability={ability} active={active}/>)}</div></details>}
      {detail.story && <details className="games-overwatch-disclosure"><summary>{t("games.overwatch.story")}<ChevronDown size={18}/></summary><p className="games-overwatch-story" dir="auto">{detail.story}</p></details>}
    </> : !feed.failed && <div className="games-overwatch-abilities games-overwatch-ability-loading" aria-label={t("common.loading")} aria-busy="true">{Array.from({ length: 4 }, (_, index) => <i key={index} className="games-detail-skeleton"/>)}</div>}
  </article>;
}
function Ability({ ability, active }: { ability: OverwatchAbility; active: boolean }) {
  const t = useT(), [watch, setWatch] = useState(false), [failed, setFailed] = useState(false), video = useRef<HTMLVideoElement>(null), trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (!active) setWatch(false); }, [active]);
  useEffect(() => {
    const element = video.current;
    if (!watch || !element) return;
    const pause = () => { if (document.hidden) element.pause(); };
    const observer = new IntersectionObserver(entries => { if (!entries.some(entry => entry.isIntersecting)) element.pause(); });
    observer.observe(element); document.addEventListener("visibilitychange", pause);
    return () => { element.pause(); observer.disconnect(); document.removeEventListener("visibilitychange", pause); };
  }, [watch]);
  return <div className="games-overwatch-ability"><div className="games-overwatch-ability-copy"><GameArt src={ability.icon}/><div><h5 dir="auto">{ability.name}</h5><p dir="auto">{ability.description}</p>{ability.video && <button ref={trigger} aria-expanded={watch} onClick={() => { setFailed(false); setWatch(value => !value); }}><Play size={13}/>{t(watch ? "games.overwatch.hideDemo" : "games.overwatch.watchDemo")}</button>}</div></div>
    {watch && active && <div className="games-overwatch-demo"><button className="games-overwatch-close-demo" aria-label={t("games.overwatch.closeDemo")} onClick={() => { setWatch(false); trigger.current?.focus({ preventScroll: true }); }}><X size={17}/></button>{failed ? <p role="status">{t("games.overwatch.videoFailed")}</p> : <video ref={video} src={ability.video} poster={ability.poster || undefined} controls autoPlay playsInline preload="none" aria-label={ability.name} onPlay={event => { const current = event.currentTarget; current.closest(".games-overwatch")?.querySelectorAll("video").forEach(other => { if (other !== current) other.pause(); }); }} onError={() => setFailed(true)}/>}</div>}
  </div>;
}
function Maps({ active, engaged }: { active: boolean; engaged: boolean }) {
  const t = useT(), [feed, setFeed] = useState<Feed<OverwatchList<OverwatchMap>>>(empty), [modes, setModes] = useState<Feed<OverwatchList<OverwatchMode>>>(empty), [attempt, setAttempt] = useState(0);
  const refreshed = useRef(0);
  const [query, setQuery] = useState(""), [mode, setMode] = useState("all"), [limit, setLimit] = useState(12);
  useEffect(() => {
    if (!active || !engaged) return;
    const controller = new AbortController(); setFeed(value => ({ ...value, busy: true, failed: false })); setModes(value => ({ ...value, busy: true, failed: false }));
    const refresh = attempt !== refreshed.current; refreshed.current = attempt;
    void loadOverwatchMaps(controller.signal, refresh).then(value => { if (!controller.signal.aborted) setFeed({ ...value, busy: false, failed: false }); }, () => { if (!controller.signal.aborted) setFeed(value => ({ ...value, busy: false, failed: true })); });
    void loadOverwatchModes(controller.signal, refresh).then(value => { if (!controller.signal.aborted) setModes({ ...value, busy: false, failed: false }); }, () => { if (!controller.signal.aborted) setModes(value => ({ ...value, busy: false, failed: true })); });
    return () => controller.abort();
  }, [active, engaged, attempt]);
  const modeName = (key: string) => modes.data?.items.find(value => value.key === key)?.name ?? key;
  const options = [...new Set(feed.data?.items.flatMap(value => value.modes) ?? [])];
  const chosen = modes.data?.items.find(value => value.key === mode);
  const maps = feed.data?.items.filter(value => (mode === "all" || value.modes.includes(mode)) && `${value.name} ${value.location}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) ?? [];
  return <>
    <div className="games-overwatch-tools"><Dropdown ariaLabel={t("games.overwatch.mode")} value={mode} options={[{ value: "all", label: t("games.overwatch.allModes") }, ...options.map(value => ({ value, label: modeName(value) }))]} onChange={value => { setMode(value); setLimit(12); }}/>
      <label className="games-overwatch-search" data-tv-focus-container><Search size={17}/><input type="search" maxLength={100} autoComplete="off" spellCheck={false} value={query} aria-label={t("games.overwatch.searchMaps")} placeholder={t("games.overwatch.searchMaps")} onChange={event => { setQuery(event.target.value); setLimit(12); }}/></label><button className="games-button" aria-label={t("games.overwatch.refresh")} disabled={feed.busy || modes.busy} onClick={() => setAttempt(value => value + 1)}><RefreshCw size={17}/></button></div>
    <FeedStatus failed={feed.failed || modes.failed} partial={feed.data?.partial || modes.data?.partial} retry={() => setAttempt(value => value + 1)}/>
    {chosen && <div className="games-overwatch-mode"><GameArt src={chosen.icon}/><div><h3 dir="auto">{chosen.name}</h3><p dir="auto">{chosen.description}</p></div></div>}
    {!feed.data && !feed.failed ? <div className="games-overwatch-maps" aria-busy="true" aria-label={t("common.loading")}>{Array.from({ length: 6 }, (_, index) => <i key={index} className="games-detail-skeleton"/>)}</div> : maps.length ? <><div className="games-overwatch-maps">{maps.slice(0, limit).map(map => <article key={map.key}><GameArt src={map.image}/><div><h3 dir="auto">{map.name}</h3><p dir="auto">{map.location}</p><span dir="auto">{map.modes.map(modeName).join(" · ")}</span></div></article>)}</div>{maps.length > limit && <button className="games-overwatch-more" onClick={() => setLimit(value => value + 12)}>{t("games.overwatch.moreMaps")}<ChevronDown size={15}/></button>}</> : feed.data && <p className="games-overwatch-status" role="status">{t("games.overwatch.empty")}</p>}
    <Footer at={feed.at} maps/>
  </>;
}
