import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, LockKeyhole, RefreshCw, Search, Star } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { wowClassicArt } from "@/lib/games/wow-art";
import { parsePinnedWowRealms, wowClassicStorageKey } from "@/lib/games/wow-classic";
import { loadWowRealmDirectory } from "@/lib/games/wow-realms";
import { filterWowRealms, WOW_REALM_REGIONS, WOW_REALM_TTL, wowRealmStatusUrl, type WowClassicEdition, type WowRealmDirectory, type WowRealmRegion } from "@/lib/games/wow-realm-data";
import type { CompanionObservation } from "@/lib/games/companion-request";
import { GameArt } from "./game-art";
import { useLiveRefresh } from "./use-live-refresh";
import "./game-wow-companion.css";
import "./game-wow-classic.css";

function readRegion(key: string): WowRealmRegion {
  try { const value = localStorage.getItem(key); if (WOW_REALM_REGIONS.some(region => region === value)) return value as WowRealmRegion; } catch { /* Optional device preference. */ }
  return "us";
}
function readPinned(key: string) { try { return parsePinnedWowRealms(JSON.parse(localStorage.getItem(key) ?? "[]")); } catch { return []; } }

export function GameWowClassicCompanion({ edition, active, profile }: { edition: WowClassicEdition; active: boolean; profile: string }) {
  const key = `harbor.games.wow.region:${profile}:${edition}`;
  const [region, setRegion] = useState(() => readRegion(key));
  return <ClassicRealms key={`${key}:${region}`} edition={edition} region={region} active={active} profile={profile} changeRegion={next => {
    setRegion(next); try { localStorage.setItem(key, next); } catch { /* Region remains usable without persistence. */ }
  }}/>;
}

function ClassicRealms({ edition, region, active, profile, changeRegion }: { edition: WowClassicEdition; region: WowRealmRegion; active: boolean; profile: string; changeRegion: (region: WowRealmRegion) => void }) {
  const t = useT(), language = useUiLanguage(), id = useId(), root = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false), [observation, setObservation] = useState<CompanionObservation<WowRealmDirectory> | null>(null);
  const [busy, setBusy] = useState(false), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0), [now, setNow] = useState(Date.now);
  const [query, setQuery] = useState(""), [category, setCategory] = useState("__default"), [onlyPinned, setOnlyPinned] = useState(false);
  const storageKey = wowClassicStorageKey(profile, edition, region);
  const [pinned, setPinned] = useState(() => readPinned(storageKey)), [saveFailed, setSaveFailed] = useState(false);
  const revision = useLiveRefresh(active && visible, WOW_REALM_TTL);
  useEffect(() => {
    if (!active || !root.current) return;
    const observer = new IntersectionObserver(entries => setVisible(entries.some(entry => entry.isIntersecting)), { rootMargin: "200px" });
    observer.observe(root.current); return () => observer.disconnect();
  }, [active]);
  useEffect(() => {
    if (!active || !visible || document.hidden) return;
    const request = new AbortController(); setBusy(true);
    void loadWowRealmDirectory(region, edition, request.signal).then(result => {
      if (!request.signal.aborted) { setObservation(result); setFailed(false); setBusy(false); setNow(Date.now()); }
    }, () => { if (!request.signal.aborted) { setFailed(true); setBusy(false); } });
    return () => request.abort();
  }, [active, visible, region, edition, revision, attempt]);
  useEffect(() => {
    if (!active || !visible) return;
    const tick = () => setNow(Date.now()); tick();
    const timer = setInterval(tick, 15_000); document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, [active, visible]);
  const realms = observation?.data.realms ?? [], categories = [...new Set(realms.map(realm => realm.category).filter(Boolean))].sort();
  const selectedCategory = category === "__default" ? categories.includes("Active") ? "Active" : "" : categories.includes(category) ? category : "";
  const matches = filterWowRealms(realms, query, language).filter(realm => (!selectedCategory || realm.category === selectedCategory) && (!onlyPinned || pinned.includes(realm.slug)))
    .sort((a, b) => Number(pinned.includes(b.slug)) - Number(pinned.includes(a.slug)));
  const fresh = !!observation && !failed && now >= observation.at && now - observation.at < 2 * WOW_REALM_TTL;
  const art = wowClassicArt(edition, observation?.data.editionName ?? "");
  const toggle = (slug: string) => {
    const next = pinned.includes(slug) ? pinned.filter(value => value !== slug) : parsePinnedWowRealms([...pinned, slug]);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setPinned(next); setSaveFailed(false); } catch { setSaveFailed(true); }
  };
  const source = wowRealmStatusUrl(region, edition);
  return <section ref={root} className="games-wow games-wow-classic games-inset" aria-labelledby={`${id}-title`}>
    <header className="games-wow-classic-heading">
      <GameArt src={art.backdrop} className="games-wow-classic-scene"/>
      <div className="games-wow-classic-intro"><GameArt src={art.logo} alt={art.name} className="games-wow-classic-logo"/><p>{t(`games.wow.classic.${edition}`)}</p><h2 id={`${id}-title`}>{t("games.wow.classic.title")}</h2><p>{t("games.wow.classic.intro")}</p></div>
    </header>
    <div className="games-wow-classic-controls">
      <label className="games-wow-classic-search" data-tv-focus-container><Search size={18}/><input type="search" aria-label={t("games.wow.classic.search")} placeholder={t("games.wow.classic.search")} value={query} onChange={event => setQuery(event.target.value)} maxLength={80} autoComplete="off" spellCheck={false}/></label>
      <Dropdown value={region} ariaLabel={t("games.wow.region")} options={WOW_REALM_REGIONS.map(value => ({ value, label: t(`games.wow.region.${value}`) }))} onChange={value => changeRegion(value as WowRealmRegion)}/>
      {categories.length > 1 && <Dropdown value={selectedCategory} ariaLabel={t("games.wow.classic.group")} options={[{ value: "", label: t("games.wow.classic.all") }, ...categories.map(value => ({ value, label: value }))]} onChange={setCategory}/>}
      <button className="games-button games-wow-classic-pinned" aria-pressed={onlyPinned} onClick={() => setOnlyPinned(value => !value)}><Star size={17} fill={onlyPinned ? "currentColor" : "none"}/>{t("games.wow.classic.pinned")}</button>
      <button className="games-button" disabled={busy} aria-label={t("games.wow.realm.refresh")} onClick={() => setAttempt(value => value + 1)}><RefreshCw size={17}/></button>
    </div>
    {saveFailed && <p className="games-wow-status" role="status">{t("games.wow.classic.saveError")}</p>}
    {failed && <p className="games-wow-status" role="status">{t("games.wow.classic.unavailable")}</p>}
    {!observation && !failed ? <div className="games-wow-classic-loading" aria-busy="true" aria-label={t("common.loading")}>{Array.from({ length: 4 }, (_, index) => <i key={index} className="games-detail-skeleton"/>)}</div> : observation && <>
      <div className="games-wow-classic-columns" aria-hidden="true"><span>{t("games.wow.character.realm")} · {matches.length.toLocaleString(language)}</span><span>{t("games.wow.classic.population")}</span><span>{t("games.wow.classic.status")}</span><span/></div>
      <ul className="games-wow-classic-realms" aria-label={t("games.wow.classic.title")}>{matches.map(realm => {
        const state = fresh && realm.online !== null ? realm.online ? "online" : "offline" : "unknown";
        const restrictions = fresh ? [realm.newCharactersLocked ? t("games.wow.realm.locked") : "", realm.transfersLocked ? t("games.wow.classic.transfersLocked") : ""].filter(Boolean).join(" · ") : "";
        return <li key={realm.slug} data-realm={realm.slug}>
          <div className="games-wow-classic-realm-name"><strong>{realm.name}</strong><small>{[realm.type ? t(`games.wow.realm.${realm.type}`) : "", realm.category, realm.locale, realm.timezone].filter(Boolean).join(" · ")}</small></div>
          <span className="games-wow-classic-population">{fresh && realm.population ? t(`games.wow.realm.${realm.population}`) : "—"}{restrictions && <HoverTooltip label={restrictions}><span tabIndex={0} aria-label={restrictions} className="games-wow-classic-lock"><LockKeyhole size={14}/></span></HoverTooltip>}</span>
          <span className={`games-wow-classic-state is-${state}`}><i/>{t(`games.wow.realm.${state}`)}</span>
          <HoverTooltip label={t(pinned.includes(realm.slug) ? "games.wow.classic.unpin" : "games.wow.classic.pin", { realm: realm.name })}><button className="games-wow-classic-pin" aria-pressed={pinned.includes(realm.slug)} aria-label={t(pinned.includes(realm.slug) ? "games.wow.classic.unpin" : "games.wow.classic.pin", { realm: realm.name })} onClick={() => toggle(realm.slug)}><Star size={18} fill={pinned.includes(realm.slug) ? "currentColor" : "none"}/></button></HoverTooltip>
        </li>;
      })}</ul>
      {!matches.length && <p className="games-wow-status" role="status">{t("games.wow.classic.noMatches")}</p>}
    </>}
    <footer><a href={source} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); openUrl(source); }}>{t("games.wow.realm.source")}<ArrowUpRight size={14}/></a>{observation && <time dateTime={new Date(observation.at).toISOString()}>{t("games.wow.checked", { date: new Date(observation.at).toLocaleTimeString(language, { hour: "numeric", minute: "2-digit" }) })}</time>}<a href="https://worldofwarcraft.blizzard.com/en-us/classic" target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); openUrl(event.currentTarget.href); }}>{t("games.wow.classic.news")}<ArrowUpRight size={14}/></a></footer>
  </section>;
}
