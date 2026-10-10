import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, ChevronDown, Copy, Plus, RefreshCw, Search } from "lucide-react";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { loadGw2Vault } from "@/lib/games/guild-wars2";
import { GW2_ACCLAIM_ICON, GW2_LOGO, GW2_VAULT_GUIDE, GW2_VAULT_TTL, gw2Budget, gw2Language, gw2Selected, gw2Total, readGw2Plan, type Gw2Plan, type Gw2Reward, type Gw2Vault } from "@/lib/games/guild-wars2-data";
import { GameArt } from "./game-art";
import { useLiveRefresh } from "./use-live-refresh";
import "./game-guild-wars2-companion.css";

export function GameGuildWars2Companion({ active, profile }: { active: boolean; profile: string }) {
  const t = useT(), language = useUiLanguage(), root = useRef<HTMLElement>(null), refreshed = useRef(0);
  const [visible, setVisible] = useState(false), [activated, setActivated] = useState(false), [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<Gw2Vault | null>(null), [busy, setBusy] = useState(false), [failed, setFailed] = useState(false), [now, setNow] = useState(Date.now);
  const revision = useLiveRefresh(active && visible, GW2_VAULT_TTL);
  useEffect(() => {
    if (!active) { setVisible(false); setActivated(false); return; }
    if (!root.current) return;
    const observer = new IntersectionObserver(entries => { const shown = entries.some(entry => entry.isIntersecting); setVisible(shown); if (shown) setActivated(true); }, { rootMargin: "240px" });
    observer.observe(root.current); return () => observer.disconnect();
  }, [active]);
  useEffect(() => {
    if (!active || !activated) return;
    const controller = new AbortController(), refresh = attempt !== refreshed.current; refreshed.current = attempt;
    setBusy(true); setFailed(false);
    void loadGw2Vault(language, controller.signal, refresh).then(value => {
      if (!controller.signal.aborted) { setData(value); setBusy(false); setNow(Date.now()); }
    }, () => { if (!controller.signal.aborted) { setFailed(true); setBusy(false); } });
    return () => controller.abort();
  }, [active, activated, language, attempt, revision]);
  useEffect(() => {
    if (!active || !visible) return;
    const tick = () => { if (!document.hidden) setNow(Date.now()); };
    tick(); const timer = setInterval(tick, 30_000); document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, [active, visible]);
  const shown = data?.language === gw2Language(language) ? data : null;
  const current = !!shown && shown.season.start <= now && now < shown.season.end;
  return <section ref={root} className="games-gw2 games-inset" aria-labelledby="gw2-vault-title">
    <header className="games-gw2-heading"><div><GameArt src={GW2_LOGO} className="games-gw2-logo" alt="Guild Wars 2"/><h2 id="gw2-vault-title">{t("games.gw2.title")}</h2><p>{t("games.gw2.intro")}</p></div><button className="games-button" aria-label={t("games.gw2.refresh")} disabled={busy} onClick={() => setAttempt(value => value + 1)}><RefreshCw size={18}/></button></header>
    {failed && <p role="status" className="games-gw2-status">{t("games.gw2.unavailable")} <button onClick={() => setAttempt(value => value + 1)}>{t("common.retry")}</button></p>}
    {!shown && !failed && <div className="games-gw2-loading" aria-busy="true" aria-label={t("common.loading")}>{Array.from({ length: 6 }, (_, index) => <i key={index} className="games-detail-skeleton"/>)}</div>}
    {shown && <>
      <div className="games-gw2-season"><strong dir="auto">{shown.season.title}</strong><time dateTime={new Date(shown.season.end).toISOString()}>{t("games.gw2.ends", { date: new Date(shown.season.end).toLocaleString(language, { dateStyle: "medium", timeStyle: "short" }) })}</time></div>
      {!current && <p role="status" className="games-gw2-status">{t("games.gw2.expired")}</p>}
      {shown.partial && <p role="status" className="games-gw2-status">{t("games.gw2.partial")}</p>}
      <VaultPlanner key={`${profile}:${shown.season.key}`} vault={shown} profile={profile} current={current && !failed}/>
    </>}
    <footer><a href={GW2_VAULT_GUIDE} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); void openUrl(GW2_VAULT_GUIDE); }}>ArenaNet · {t("games.gw2.guide")}<ArrowUpRight size={13}/></a>{shown && <span>{t("games.gw2.checked", { date: new Date(shown.at).toLocaleString(language, { dateStyle: "medium", timeStyle: "short" }) })}</span>}<p>{t("games.gw2.scope")}</p></footer>
  </section>;
}
function VaultPlanner({ vault, profile, current }: { vault: Gw2Vault; profile: string; current: boolean }) {
  const t = useT(), language = useUiLanguage(), storageKey = `harbor.games.gw2.vault:${profile}`;
  const [plan, setPlan] = useState<Gw2Plan>(() => { try { return readGw2Plan(localStorage.getItem(storageKey), vault.season); } catch { return readGw2Plan(null, vault.season); } });
  const [budget, setBudget] = useState(() => plan.budget === null ? "" : String(plan.budget));
  const [storageError, setStorageError] = useState(false), [filter, setFilter] = useState("Featured"), [query, setQuery] = useState(""), [limit, setLimit] = useState(12);
  const selected = gw2Selected(plan, vault.rewards), total = gw2Total(selected), amount = gw2Budget(budget), invalidBudget = budget !== "" && amount === null;
  const number = (value: number) => value.toLocaleString(language);
  const persist = (next: Gw2Plan) => {
    setPlan(next);
    try { localStorage.setItem(storageKey, JSON.stringify({ version: 1, season: vault.season.key, ...next })); setStorageError(false); } catch { setStorageError(true); }
  };
  const toggle = (reward: Gw2Reward) => {
    const next = selected.some(value => value.id === reward.id) ? selected.filter(value => value.id !== reward.id) : [...selected, reward];
    persist({ ...plan, selected: next.map(({ id, itemId }) => ({ id, itemId })) });
  };
  const matches = vault.rewards.filter(reward => (filter === "all" || filter === "planned" && selected.some(value => value.id === reward.id) || filter === reward.category) && (!query.trim() || reward.item?.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())));
  return <>
    <div className="games-gw2-plan">
      <div className="games-gw2-total"><GameArt src={GW2_ACCLAIM_ICON}/><div><span>{t("games.gw2.total")}</span><strong>{number(total)} <small>{t("games.gw2.currency")}</small></strong><p>{t("games.gw2.selected", { count: number(selected.length) })}</p></div></div>
      <label className="games-gw2-budget"><span>{t("games.gw2.budget")}</span><input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={7} value={budget} aria-invalid={invalidBudget} onChange={event => { const value = event.target.value; setBudget(value); const parsed = gw2Budget(value); if (value === "" || parsed !== null) persist({ ...plan, budget: parsed }); }}/>{invalidBudget ? <small role="status">{t("games.gw2.budgetInvalid")}</small> : amount !== null && <small>{t(amount >= total ? "games.gw2.remaining" : "games.gw2.over", { count: number(Math.abs(amount - total)) })}</small>}</label>
      <button className="games-button" disabled={!selected.length} onClick={() => persist({ ...plan, selected: [] })}>{t("games.gw2.clear")}</button>
    </div>
    {storageError && <p role="status" className="games-gw2-status">{t("games.gw2.saveFailed")}</p>}
    <div className="games-gw2-filters"><div role="group" aria-label={t("games.gw2.filter")}>{["Featured", "Normal", "Legacy", "all", "planned"].map(value => <button key={value} aria-pressed={filter === value} onClick={() => { setFilter(value); setLimit(12); }}>{t(`games.gw2.${value}`)}{value === "planned" && <span>{number(selected.length)}</span>}</button>)}</div><label className="games-gw2-search" data-tv-focus-container><Search size={16}/><input type="search" value={query} maxLength={100} aria-label={t("games.gw2.search")} placeholder={t("games.gw2.search")} autoComplete="off" onChange={event => { setQuery(event.target.value); setLimit(12); }}/></label></div>
    {matches.length ? <div className="games-gw2-rewards">{matches.slice(0, limit).map(reward => <Reward key={`${reward.id}:${reward.itemId}`} reward={reward} selected={selected.some(value => value.id === reward.id)} disabled={!current || !reward.item} toggle={() => toggle(reward)}/>)}</div> : <p className="games-gw2-status">{t("games.gw2.empty")}</p>}
    {matches.length > limit && <button className="games-gw2-more games-button" onClick={() => setLimit(value => value + 24)}>{t("games.gw2.more", { count: number(matches.length - limit) })}</button>}
  </>;
}
function Reward({ reward, selected, disabled, toggle }: { reward: Gw2Reward; selected: boolean; disabled: boolean; toggle: () => void }) {
  const t = useT(), language = useUiLanguage(), [copy, setCopy] = useState<"idle" | "busy" | "done" | "failed">("idle");
  const name = reward.item?.name || t("games.gw2.item", { id: String(reward.itemId) });
  return <article className="games-gw2-reward" data-listing={reward.id} data-selected={selected}>
    <div className="games-gw2-reward-title"><GameArt src={reward.item?.icon || ""}/><div><h3 dir="auto">{name}</h3><p>{t("games.gw2.quantity", { count: reward.count.toLocaleString(language) })}</p></div></div>
    <div className="games-gw2-reward-action"><span><GameArt src={GW2_ACCLAIM_ICON}/>{reward.cost.toLocaleString(language)}<span className="games-gw2-sr-only"> {t("games.gw2.currency")}</span></span><button className="games-button" disabled={disabled} aria-pressed={selected} aria-label={t(selected ? "games.gw2.remove" : "games.gw2.add", { name })} onClick={toggle}>{selected ? <Check size={16}/> : <Plus size={16}/>} {t(selected ? "games.gw2.planned" : "games.gw2.select")}</button></div>
    {reward.item && <details><summary>{t("games.gw2.details")}<ChevronDown size={14}/></summary>{reward.item.description && <p dir="auto">{reward.item.description}</p>}{reward.item.chatLink && <div className="games-gw2-chat"><code dir="ltr">{reward.item.chatLink}</code><button className="games-button" disabled={copy === "busy"} onClick={async () => { setCopy("busy"); try { await navigator.clipboard.writeText(reward.item!.chatLink); setCopy("done"); } catch { setCopy("failed"); } }}>{copy === "done" ? <Check size={14}/> : <Copy size={14}/>} {t(copy === "done" ? "games.gw2.copied" : "games.gw2.copy")}</button>{copy === "failed" && <small role="status">{t("games.gw2.copyFailed")}</small>}</div>}</details>}
  </article>;
}
