import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Eye, EyeOff, LockKeyhole, RefreshCw, Search, X } from "lucide-react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useT, useUiLanguage } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import { openUrl } from "@/lib/window";
import { loadPublicAchievements } from "@/lib/games/detail-extras";
import type { PublicGameAchievement } from "@/lib/games/detail-extras-data";
import type { SteamAccount } from "@/hooks/use-steam-account";
import { useAchievementProgress } from "@/hooks/use-achievement-progress";
import { achievementProgressRows } from "@/lib/games/achievement-progress";
import { achievementRewards } from "@/lib/games/achievement-rewards";
import { AchievementRewardCatalog } from "./game-achievement-rewards";
import { DetailLoading } from "./game-detail-loading";
import { GameArt } from "./game-art";
import "./game-public-achievements.css";

export function PublicAchievementsModal({ appId, profile, account, total, onClose, onManage }: {
  appId: number; profile: string; account?: SteamAccount; total: number; onClose: () => void; onManage: (id?: string) => void;
}) {
  const t = useT(), language = useUiLanguage(), id = useId(), root = useRef<HTMLDivElement>(null);
  const destination = useRef<{ id?: string } | null>(null), actions = useRef({ onClose, onManage });
  actions.current = { onClose, onManage };
  const finish = useCallback(() => { if (destination.current) actions.current.onManage(destination.current.id); else actions.current.onClose(); }, []);
  const { closing, close } = useModalExit(finish);
  const manage = (id?: string) => { destination.current = { id }; close(); };
  const [items, setItems] = useState<PublicGameAchievement[] | null>(null), [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0), [query, setQuery] = useState(""), [filter, setFilter] = useState("all");
  const [revealed, setRevealed] = useState(false);
  const { personal, reading, reason: progressReason } = useAchievementProgress(appId, profile, account, true, attempt);
  const [rewards, setRewards] = useState(false), hasRewards = achievementRewards(appId).length > 0;
  const linkedId = account?.status.connected ? account.status.snapshot?.steamId : undefined;
  useSectionBack(close, true);
  useEffect(() => {
    const request = new AbortController(); setFailed(false);
    void loadPublicAchievements(appId, request.signal).then(value => { if (!request.signal.aborted) setItems(value); }, () => { if (!request.signal.aborted) setFailed(true); });
    return () => request.abort();
  }, [appId, attempt]);
  useEffect(() => { setFilter("all"); }, [appId, profile, linkedId, attempt]);
  useEffect(() => { setRevealed(false); }, [appId, profile, linkedId]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    root.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !root.current) return;
      const nodes = [...root.current.querySelectorAll<HTMLElement>('button:not(:disabled),input,a[href]')].filter(node => node.getClientRects().length);
      const first = nodes[0], last = nodes.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", trap); return () => { document.removeEventListener("keydown", trap); previous?.focus({ preventScroll: true }); };
  }, []);
  const rows = achievementProgressRows(items ?? [], personal);
  const hasSecrets = rows.some(item => item.hidden && !item.unlocked);
  const secret = (item: typeof rows[number]) => item.hidden && !item.unlocked && !revealed;
  const shown = rows.filter(item => (filter === "all" || (filter === "earned" ? item.unlocked === true : item.unlocked === false)) &&
    (!query.trim() || (!secret(item) && `${item.name} ${item.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))));
  const earned = personal?.items.filter(item => item.unlocked).length ?? 0;
  const ownedIds = useMemo(() => new Set((personal?.items ?? []).filter(item => item.unlocked).map(item => item.id)), [personal]);
  return <ModalShell closing={closing} onDismiss={close} width={740} labelledBy={id} backdropClassName="games-achievements-backdrop">
    <div className="games-public-achievements" ref={root} inert={closing}>
      <header><div><h2 id={id}>{t("games.details.publicAchievements")} <span>{personal?.items.length ?? items?.length ?? total}</span></h2><p>{personal ? t("games.achievementManager.account", { id: personal.steamId }) : t("games.details.achievementNote")}</p></div><button aria-label={t("common.close")} onClick={close}><X size={20}/></button></header>
      <div className="games-personal-achievement-summary" aria-live="polite">
        {personal ? <><strong><Check size={18}/>{t("games.achievementManager.progressCount", { count: earned, total: personal.items.length })}</strong><progress value={earned} max={personal.items.length || 1} aria-label={t("games.achievementManager.progressCount", { count: earned, total: personal.items.length })}/></> : <span>{t(reading ? "games.achievementManager.progressLoading" : "games.achievementManager.progressUnavailable")}{!reading && progressReason && <small className="games-achievement-progress-reason">{t(progressReason)}</small>}</span>}
        <button disabled={reading} aria-label={t("games.achievementManager.refresh")} onClick={() => setAttempt(value => value + 1)}><RefreshCw size={16}/></button>
      </div>
      {hasRewards && <div className="gam-public-tabs"><button aria-pressed={!rewards} onClick={() => setRewards(false)}>{t("games.details.publicAchievements")}</button><button aria-pressed={rewards} onClick={() => setRewards(true)}>{t("games.achievementManager.rewards")}</button></div>}
      <div className="games-achievement-list-tools">
        <label className="games-achievement-search"><Search size={17}/><input aria-label={t("games.details.achievementSearch")} placeholder={t("games.details.achievementSearch")} value={query} onChange={event => setQuery(event.target.value)}/></label>
        {!rewards && hasSecrets && <button className="games-achievement-reveal" aria-pressed={revealed} aria-controls={`${id}-list`} onClick={() => setRevealed(value => !value)}>{revealed ? <EyeOff size={16}/> : <Eye size={16}/>}<span>{t(revealed ? "games.achievementManager.hideLockedDetails" : "games.achievementManager.showLockedDetails")}</span></button>}
      </div>
      {personal && !rewards && <div className="games-personal-achievement-filters" role="group" aria-label={t("games.achievementManager.filter")}>{["all", "earned", "locked"].map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{t(`games.achievementManager.${value}`)} <span>{value === "all" ? personal.items.length : value === "earned" ? earned : personal.items.length - earned}</span></button>)}</div>}
      <div className="games-public-achievement-list" id={`${id}-list`}>
        {rewards ? <AchievementRewardCatalog appId={appId} query={query} unlock={manage} unlocked={ownedIds}/> : !personal && failed ? <div className="games-achievement-message" role="alert"><p>{t("games.details.achievementError")}</p><button className="games-button" onClick={() => setAttempt(n => n + 1)}>{t("common.retry")}</button></div> : !personal && !items ? <div className="games-public-achievements-loading" aria-busy="true" aria-label={t("common.loading")}>{[0,1,2,3,4,5,6,7].map(n => <article key={n} aria-hidden="true"><i className="games-detail-skeleton"/><DetailLoading kind="copy"/></article>)}</div> : !shown.length ? <p className="games-achievement-message">{t("games.details.achievementEmpty")}</p> : shown.map(item => <article className="games-personal-achievement-row" data-progress={item.unlocked === undefined ? "unknown" : item.unlocked ? "earned" : "locked"} key={item.key}>
          {secret(item) ? <span className="games-personal-achievement-secret"><LockKeyhole size={22}/></span> : <GameArt src={item.icon} alt=""/>}
          <div className="games-achievement-copy"><h3>{secret(item) ? t("games.account.secretAchievement") : item.name}</h3><p>{secret(item) ? t("games.account.secretNote") : item.description || t("games.details.achievementHidden")}</p>{item.unlocked && !!item.unlockedAt && <time>{new Date(item.unlockedAt * 1000).toLocaleDateString(language)}</time>}</div>
          <div className="games-personal-achievement-state">{item.unlocked === undefined && reading && <span className="games-achievement-state-pending" aria-hidden="true"/>}{item.unlocked !== undefined && <strong>{item.unlocked ? <Check size={15}/> : <LockKeyhole size={14}/>}<span>{t(item.unlocked ? "games.achievementManager.earned" : "games.achievementManager.locked")}</span></strong>}{item.percent !== undefined && <span className="games-achievement-rate">{t("games.details.achievementRate", { percent: item.percent.toLocaleString(language, { maximumFractionDigits: 1 }) })}</span>}</div>
        </article>)}
      </div>
      <footer><p>{personal ? t("games.achievementManager.progressReadOnly") : t("games.achievementManager.progressPublic")}</p><button className="gam-unlock-entry" onClick={() => manage()}>{t("games.achievementManager.open")}</button><button onClick={() => openUrl(`https://steamcommunity.com/stats/${appId}/achievements/`)}>{t("games.details.achievementSource")}</button></footer>
    </div>
  </ModalShell>;
}
