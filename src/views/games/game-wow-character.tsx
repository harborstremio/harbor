import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, RefreshCw, Search, Star } from "lucide-react";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { loadWowCharacter, WowApiError, WOW_CHARACTER_TTL } from "@/lib/games/wow";
import { rememberedWowCharacter, wowCharacterKey, wowCharacterTarget, type WowCharacter, type WowCharacterTarget } from "@/lib/games/wow-character-data";
import type { WowRaid, WowRegion, WowSeason } from "@/lib/games/wow-data";
import { GameArt } from "./game-art";
import { useLiveRefresh } from "./use-live-refresh";
import { GameWowEquipment } from "./game-wow-equipment";
import { GameWowSeasonProgress } from "./game-wow-season-progress";
import { GameWowRealmField } from "./game-wow-realm-field";
import { GameWowTalents } from "./game-wow-talents";
import { GameWowWeekly } from "./game-wow-weekly";
import type { WowResetContext } from "@/lib/games/wow-weekly";
import "./game-wow-character.css";

function initialCharacter(key: string, region: WowRegion) { try { return rememberedWowCharacter(localStorage.getItem(key), region); } catch { return null; } }
export function GameWowCharacter({ profile, region, season, raids, active, reset = null }: { profile: string; region: WowRegion; season: WowSeason | null; raids: WowRaid[] | null; active: boolean; reset?: WowResetContext | null }) {
  const t = useT(), language = useUiLanguage(), root = useRef<HTMLElement>(null);
  const storageKey = `harbor.games.wow.character:${profile}:${region}`;
  const [remembered, setRemembered] = useState(() => initialCharacter(storageKey, region));
  const [realm, setRealm] = useState(remembered?.realm ?? ""), [name, setName] = useState(remembered?.name ?? "");
  const [target, setTarget] = useState<WowCharacterTarget | null>(remembered);
  const [result, setResult] = useState<{ data: WowCharacter; at: number } | null>(null);
  const [error, setError] = useState<"invalid" | "missing" | "limited" | "unavailable" | null>(null);
  const [storageError, setStorageError] = useState(false), [busy, setBusy] = useState(false), [attempt, setAttempt] = useState(0);
  const [visible, setVisible] = useState(false), [tab, setTab] = useState<"recent" | "weekly" | "best" | "equipment" | "talents">("recent"), [expanded, setExpanded] = useState(false);
  const refreshed = useRef(0);
  const revision = useLiveRefresh(active && visible && !!target, WOW_CHARACTER_TTL);
  // An explicit lookup finishes even if surrounding asynchronous content moves
  // the form outside the viewport. Navigation still cancels the request.
  const enabled = active && (visible || attempt > 0);
  useEffect(() => {
    if (!active || !root.current) return;
    const observer = new IntersectionObserver(entries => setVisible(entries.some(entry => entry.isIntersecting)), { rootMargin: "240px" });
    observer.observe(root.current); return () => observer.disconnect();
  }, [active]);
  useEffect(() => {
    if (!enabled || !target || document.hidden) { setBusy(false); return; }
    const controller = new AbortController(), refresh = attempt !== refreshed.current; refreshed.current = attempt; setBusy(true); setError(null);
    void loadWowCharacter(target, season?.slug ?? null, controller.signal, refresh).then(value => {
      if (!controller.signal.aborted) { setResult(value); setBusy(false); }
    }, error => { if (!controller.signal.aborted) { setBusy(false); setError(error instanceof WowApiError && [400, 404].includes(error.status) ? "missing" : error instanceof WowApiError && error.status === 429 ? "limited" : "unavailable"); } });
    return () => controller.abort();
  }, [enabled, target, season?.slug, attempt, revision]);
  const data = result && target && result.data.key === wowCharacterKey(target) ? result.data : null;
  const currentSeason = data && (!season || data.season === season.slug);
  const runs = currentSeason && (tab === "recent" || tab === "best") ? data[tab] : null;
  const progress = data?.raids?.flatMap(value => { const raid = raids?.find(raid => raid.slug === value.slug); return raid ? [{ ...value, name: raid.name, image: raid.image }] : []; });
  const saved = !!data && !!remembered && wowCharacterKey(data.target) === wowCharacterKey(remembered);
  const date = (value: number) => new Date(value).toLocaleString(language, { dateStyle: "medium", timeStyle: "short" });
  const number = (value: number | null) => value === null ? "—" : value.toLocaleString(language, { maximumFractionDigits: 1 });
  const duration = (value: number) => `${Math.floor(value / 60_000)}:${String(Math.floor(value / 1000) % 60).padStart(2, "0")}`;
  const remember = () => {
    if (!data) return;
    try { if (saved) localStorage.removeItem(storageKey); else localStorage.setItem(storageKey, JSON.stringify(data.target)); setRemembered(saved ? null : data.target); setStorageError(false); }
    catch { setStorageError(true); }
  };
  return <section ref={root} className="games-wow-character" aria-labelledby="wow-character-title">
    <div className="games-wow-section-heading"><div><h3 id="wow-character-title">{t("games.wow.character.title")}</h3><p>{t("games.wow.character.intro")}</p></div>{data && <button className="games-button" disabled={busy} aria-label={t("games.wow.character.refresh")} onClick={() => setAttempt(value => value + 1)}><RefreshCw size={16}/></button>}</div>
    <form className="games-wow-character-search" onSubmit={event => {
      event.preventDefault(); if (busy) return;
      const next = wowCharacterTarget({ region, realm, name });
      if (!next) { setError("invalid"); return; }
      setTarget(next); setAttempt(value => value + 1); setError(null); setExpanded(false); setTab("recent");
    }}>
      <GameWowRealmField region={region} value={realm} onChange={setRealm} active={active && visible}/>
      <label><span>{t("games.wow.character.name")}</span><input value={name} onChange={event => setName(event.target.value)} autoComplete="off" spellCheck={false} maxLength={24} required/></label>
      <button type="submit" className="games-button" disabled={busy}><Search size={17}/>{t(busy ? "common.loading" : "games.wow.character.find")}</button>
    </form>
    {error && <p className="games-wow-status" role="status">{t(`games.wow.character.${error}`)} {error !== "invalid" && data && t("games.wow.character.previous")}</p>}
    {storageError && <p role="status" className="games-wow-status">{t("games.wow.character.saveError")}</p>}
    {!data && busy && <div className="games-wow-character-loading" aria-busy="true" aria-label={t("common.loading")}><i className="games-detail-skeleton"/><i className="games-detail-skeleton"/><i className="games-detail-skeleton"/></div>}
    {data && <>
      <header className="games-wow-character-identity"><GameArt src={data.image}/><div className="games-wow-character-name"><h4>{data.name}</h4><p>{[data.spec, data.className].filter(Boolean).join(" · ")}</p><small>{[data.realm, data.guild].filter(Boolean).join(" · ")}</small></div>
        <dl><div><dt>{t("games.wow.character.score")}</dt><dd>{number(currentSeason ? data.score : null)}</dd></div><div><dt>{t("games.wow.character.itemLevel")}</dt><dd>{number(data.itemLevel)}</dd></div></dl>
        <button className="games-button" aria-pressed={saved} onClick={remember}>{saved ? <Check size={16}/> : <Star size={16}/>} {t(saved ? "games.wow.character.forget" : "games.wow.character.remember")}</button>
      </header>
      <div className="games-wow-character-tabs" role="group" aria-label={t("games.wow.character.title")}>{(["recent", "weekly", "best", "equipment", "talents"] as const).map(value => <button key={value} aria-pressed={tab === value} onClick={() => { setTab(value); setExpanded(false); }}>{t(value === "weekly" ? "games.wow.weekly.title" : value === "talents" ? "games.wow.talents.title" : value === "equipment" ? "games.wow.equipment.title" : value === "best" ? "games.wow.progress.title" : `games.wow.character.${value}`)}</button>)}{season && currentSeason && <span>{season.name}</span>}</div>
      {tab === "weekly" ? <GameWowWeekly key={data.key} character={data} checkedAt={result!.at} season={season} region={region} reset={reset}/> : tab === "talents" ? <GameWowTalents key={`${data.key}:${data.talents?.code ?? data.talents?.specId}`} talents={data.talents} className={data.className} spec={data.spec} active={active}/> : tab === "equipment" ? <GameWowEquipment key={data.key} equipment={data.equipment}/> : <>
      {tab === "best" ? <GameWowSeasonProgress key={`${data.key}:${season?.slug}`} character={data} season={season} region={region} active={active}/> : runs?.length ? <><ul className="games-wow-character-runs">{(expanded ? runs : runs.slice(0, 5)).map(run => <li key={run.id}><a href={run.url} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); openUrl(run.url); }}>
        <GameArt src={run.image}/><div><strong>{run.dungeon}</strong><small>{new Date(run.completedAt).toLocaleDateString(language, { month: "short", day: "numeric", year: "numeric" })} · {t(run.timed ? "games.wow.character.timed" : "games.wow.character.overtime")}</small></div><span className="games-wow-character-level">+{run.level}</span><span className="games-wow-character-time">{duration(run.time)}</span><ArrowUpRight size={15}/>
      </a></li>)}</ul>{runs.length > 5 && <button className="games-wow-character-more" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{t(expanded ? "Show less" : "Show more")}</button>}</> : <p className="games-wow-status">{t(runs ? "games.wow.character.noRuns" : "games.wow.character.runsUnavailable")}</p>}
      <h4 className="games-wow-character-raid-title">{t("games.wow.character.raidProgress")}</h4>
      {progress?.length ? <div className="games-wow-character-progress">{progress.map(raid => <div key={raid.slug}><div className="games-wow-character-raid-name"><GameArt src={raid.image}/><strong>{raid.name}</strong></div><dl>{(["normal", "heroic", "mythic"] as const).map(difficulty => <div key={difficulty}><dt>{t(`games.wow.character.${difficulty}`)}</dt><dd>{raid[difficulty] === null ? "—" : `${number(raid[difficulty])} / ${number(raid.total)}`}</dd></div>)}</dl></div>)}</div> : <p className="games-wow-status">{t("games.wow.character.raidUnavailable")}</p>}
      </>}
      <div className="games-wow-character-source"><a href={data.url} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); openUrl(data.url); }}>Raider.IO <ArrowUpRight size={13}/></a>{data.crawledAt && <span>{t("games.wow.character.updated", { date: date(data.crawledAt) })}</span>}{data.gearAt && <span>{t("games.wow.character.gearUpdated", { date: date(data.gearAt) })}</span>}<p>{t("games.wow.character.sourceNote")}</p></div>
    </>}
  </section>;
}
