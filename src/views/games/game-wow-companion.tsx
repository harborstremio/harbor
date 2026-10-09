import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, Clock3, RefreshCw } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { loadWowCompanion, type WowCompanionData } from "@/lib/games/wow";
import { activeWowPeriod, wowRegion, WOW_REGIONS, WOW_WEEK_TTL, type WowRaid, type WowRegion } from "@/lib/games/wow-data";
import { GameArt } from "./game-art";
import { useLiveRefresh } from "./use-live-refresh";
import { GameWowCharacter } from "./game-wow-character";
import { GameWowDungeons } from "./game-wow-dungeons";
import { WOW_RETAIL_ART, wowSeasonArt } from "@/lib/games/wow-art";
import { wowEncounterArt, wowRaidArt } from "@/lib/games/wow-raid-art";
import "./game-wow-companion.css";

function readRegion(profile: string) { try { return wowRegion(localStorage.getItem(`harbor.games.wow.region:${profile}`)); } catch { return "us" as const; } }
function SourceLink({ url, children }: { url: string; children: React.ReactNode }) {
  return <a href={url} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); openUrl(url); }}>{children}<ArrowUpRight size={14}/></a>;
}

function RaidEncounters({ raid }: { raid: WowRaid }) {
  const t = useT(), language = useUiLanguage();
  const [open, setOpen] = useState(false);
  const art = wowRaidArt(raid.slug);
  return <details className={art ? "games-wow-raid-visual" : undefined} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>
      {art ? <GameArt src={art.image} className="games-wow-raid-scene"/> : <GameArt src={raid.image} className="games-wow-raid-icon"/>}
      <span><strong>{raid.name}</strong><small>{t("games.wow.bosses", { count: raid.bosses.length })}</small></span><ChevronDown size={17}/>
    </summary>
    {open && <>
      <ol className={art ? "games-wow-encounters" : undefined}>{raid.bosses.map((boss, index) => {
        const image = wowEncounterArt(raid.slug, boss);
        return <li key={`${index}:${boss.id}`}>
          {art && image && <GameArt src={image}/>}
          {art ? <span><small aria-hidden="true">{(index + 1).toLocaleString(language, { minimumIntegerDigits: 2 })}</small><strong dir="auto">{boss.name}</strong></span> : boss.name}
        </li>;
      })}</ol>
      {art && <div className="games-wow-raid-source"><SourceLink url={art.source}>Blizzard Entertainment</SourceLink></div>}
    </>}
  </details>;
}

export function GameWowCompanion({ active, profile }: { active: boolean; profile: string }) {
  const t = useT(), language = useUiLanguage(), root = useRef<HTMLElement>(null);
  const [region, setRegion] = useState<WowRegion>(() => readRegion(profile));
  const [visible, setVisible] = useState(false), [data, setData] = useState<WowCompanionData | null>(null);
  const [busy, setBusy] = useState(false), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(Date.now);
  const revision = useLiveRefresh(active && visible, WOW_WEEK_TTL);
  useEffect(() => {
    if (!active || !root.current) return;
    const observer = new IntersectionObserver(entries => setVisible(entries.some(entry => entry.isIntersecting)), { rootMargin: "240px" });
    observer.observe(root.current); return () => observer.disconnect();
  }, [active]);
  useEffect(() => {
    if (!active || !visible) return;
    const tick = () => { if (!document.hidden) setNow(Date.now()); };
    tick(); const timer = setInterval(tick, 30_000); document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, [active, visible]);
  useEffect(() => {
    if (!active || !visible || document.hidden) return;
    const controller = new AbortController(); setBusy(true); setFailed(false);
    void loadWowCompanion(region, language, controller.signal).then(value => { if (!controller.signal.aborted) { setData(value); setBusy(false); setNow(Date.now()); } }, () => { if (!controller.signal.aborted) { setFailed(true); setBusy(false); } });
    return () => controller.abort();
  }, [active, visible, region, language, attempt, revision]);
  const shown = data?.region === region ? data : null;
  const period = shown && activeWowPeriod(shown.periods, region, now);
  const weekly = !!period?.matchesProvider && !!shown && shown.observedAt >= period.start && !failed;
  const season = shown?.season && shown.season.start <= now && now < shown.season.end ? shown.season : null;
  const artwork = wowSeasonArt(season?.slug) ?? WOW_RETAIL_ART;
  const raids = shown?.raids?.filter(raid => raid.start <= now && now < raid.end);
  const date = (value: number) => new Date(value).toLocaleString(language, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  const hours = period ? Math.max(1, Math.ceil((period.end - now) / 3600_000)) : 0;
  const remaining = period ? new Intl.RelativeTimeFormat(language, { numeric: "always" }).format(hours >= 48 ? Math.round(hours / 24) : hours, hours >= 48 ? "day" : "hour") : "";
  return <section ref={root} className="games-wow games-inset" aria-labelledby="wow-week-title">
    <header className="games-wow-heading">
      <GameArt src={artwork.backdrop} fallback={WOW_RETAIL_ART.backdrop} className="games-wow-backdrop"/>
      <div className="games-wow-heading-copy"><div className="games-wow-wordmark-slot"><GameArt src={artwork.logo} fallback={WOW_RETAIL_ART.logo} alt={WOW_RETAIL_ART.name} className="games-wow-wordmark"/></div><p className="games-eyebrow">World of Warcraft · Retail</p><h2 id="wow-week-title">{t("games.wow.title")}</h2><p className="games-wow-season-name" aria-hidden={!season}>{season?.name || "\u00a0"}</p></div>
      <div className="games-wow-tools"><Dropdown value={region} ariaLabel={t("games.wow.region")} options={WOW_REGIONS.map(value => ({ value, label: t(`games.wow.region.${value}`) }))} onChange={value => { const next = wowRegion(value); setRegion(next); setFailed(false); try { localStorage.setItem(`harbor.games.wow.region:${profile}`, next); } catch {} }}/><button className="games-button" aria-label={t("games.wow.refresh")} disabled={busy} onClick={() => setAttempt(value => value + 1)}><RefreshCw size={17}/></button></div>
    </header>
    {failed && <p className="games-wow-status" role="status">{t("games.wow.unavailable")} <button onClick={() => setAttempt(value => value + 1)}>{t("common.retry")}</button></p>}
    {!shown && !failed ? <div className="games-wow-loading" aria-busy="true" aria-label={t("common.loading")}><i className="games-detail-skeleton"/><i className="games-detail-skeleton"/>{Array.from({ length: 4 }, (_, index) => <i key={index} className="games-detail-skeleton"/>)}</div> : shown && <>
      <div className="games-wow-week">
        <div className="games-wow-reset"><Clock3 size={21}/><h3>{t("games.wow.reset")}</h3>{period ? <><strong>{remaining}</strong><time dateTime={new Date(period.end).toISOString()}>{date(period.end)}</time><p>{t("games.wow.resetNote")}</p></> : <p>{t("games.wow.resetUnavailable")}</p>}</div>
        <div className="games-wow-affixes"><h3>{t("games.wow.affixes")}</h3>{shown.affixes && weekly ? <div>{shown.affixes.affixes.map(affix => <div key={affix.id} className="games-wow-affix"><GameArt src={affix.image}/><div><strong>{affix.name}</strong><p>{affix.description}</p></div></div>)}</div> : <p className="games-wow-status">{t("games.wow.affixesUnavailable")}</p>}</div>
      </div>
      <div className="games-wow-section-heading"><h3>{t("games.wow.dungeons")}</h3>{season && <span>{season.name}</span>}</div>
      {season?.dungeons.length ? <GameWowDungeons key={`${region}:${season.slug}`} season={season} region={region} active={active}/> : <p className="games-wow-status">{t("games.wow.seasonUnavailable")}</p>}
      <div className="games-wow-section-heading"><h3>{t("games.wow.raids")}</h3></div>
      {raids?.length ? <div className="games-wow-raids">{raids.map(raid => <RaidEncounters key={`${region}:${raid.slug}`} raid={raid}/>)}</div> : <p className="games-wow-status">{t("games.wow.raidsUnavailable")}</p>}
      <footer><SourceLink url="https://raider.io">Raider.IO</SourceLink><span>{t("games.wow.checked", { date: date(shown.observedAt) })}</span><p>{t("games.wow.scope")}</p></footer>
    </>}
    <GameWowCharacter key={`${profile}:${region}`} profile={profile} region={region} season={season} raids={raids ?? null} active={active} reset={shown ? { periods: shown.periods, at: shown.observedAt, now } : null}/>
  </section>;
}
