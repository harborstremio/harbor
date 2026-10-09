import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Info, ChevronDown, Eraser, Gamepad2, LockKeyhole, RefreshCw, Search, X, Unlock, Gift } from "lucide-react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useT, useUiLanguage } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import { applyLocalAchievements, discardLocalAchievements, localAchievementError, localAchievementsAvailable, readLocalAchievements, type LocalAchievementApplied, type LocalAchievementReview } from "@/lib/games/local-achievements";
import { acceptAchievementNotice, editAchievementDraft, hasAchievementNotice, type AchievementEdit } from "@/lib/games/achievement-editor";
import { achievementReward, achievementRewards } from "@/lib/games/achievement-rewards";
import { useSteamLibrary } from "@/hooks/use-steam-library";
import type { SteamAccount } from "@/hooks/use-steam-account";
import { openUrl } from "@/lib/window";
import { AchievementRewardPreview } from "./game-achievement-rewards";
import { AchievementStatus } from "./game-achievement-status";
import { GameArt } from "./game-art";
import { LibrarySourceMark } from "./game-library-marks";
import { useAccountDialogFocus } from "./game-steam-account";
import "./game-achievement-manager.css";

type PickRow = { appId: number; name: string; capsule: string; installed: boolean; lastPlayed: number };
const steamHeader = (appId: number) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`;

export function GameAchievementManager({ profile, appId: requestedAppId, gameName: requestedName, initialAchievementId, account, onClose }: {
  profile: string; appId: number; gameName: string; initialAchievementId?: string; account?: SteamAccount; onClose: () => void;
}) {
  const t = useT(), language = useUiLanguage(), title = useId(), root = useAccountDialogFocus();
  const { closing, close } = useModalExit(onClose);
  const [review, setReview] = useState<LocalAchievementReview | null>(null);
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState(""), [limit, setLimit] = useState(60), [revealed, setRevealed] = useState(false);
  const [accepted, setAccepted] = useState(() => hasAchievementNotice(profile));
  const available = localAchievementsAvailable();
  const [step, setStep] = useState<"consent" | "edit" | "review" | "result">(() => accepted ? "edit" : "consent");
  const [filter, setFilter] = useState<"all" | "locked" | "earned" | "pending" | "managed" | "rewards">("all");
  const [busy, setBusy] = useState<"read" | "apply" | null>(accepted && available ? "read" : null), [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LocalAchievementApplied | null>(null), [expired, setExpired] = useState(false);
  const [chosen, setChosen] = useState<{ appId: number; name: string } | null>(null);
  const [picking, setPicking] = useState(false), [pickQuery, setPickQuery] = useState(""), [discarding, setDiscarding] = useState(false);
  const appId = chosen?.appId ?? requestedAppId, gameName = chosen?.name ?? requestedName;
  const library = useSteamLibrary(picking && available);
  const generation = useRef(0), operation = useRef<"read" | "apply" | null>(null);
  const previousStep = useRef(step);
  const initialChoice = useRef(initialAchievementId);
  const scroller = useRef<HTMLDivElement>(null), keptScroll = useRef(0);
  const token = useRef<{ profile: string; token: string } | null>(null);
  const dismiss = useCallback(() => { if (operation.current !== "apply") close(); }, [close]);
  useSectionBack(dismiss, true);
  const release = useCallback(() => {
    const held = token.current; token.current = null;
    if (held) void discardLocalAchievements(held.profile, held.token).catch(() => {});
  }, []);
  const refresh = useCallback(async () => {
    if (operation.current) return;
    const current = ++generation.current;
    release(); operation.current = "read"; setBusy("read"); setError(null); setReview(null);
    setDraft({}); setStep("edit"); setResult(null); setExpired(false); setDiscarding(false); setPicking(false);
    try {
      const value = await readLocalAchievements(profile, appId);
      if (current !== generation.current) { void discardLocalAchievements(profile, value.token).catch(() => {}); return; }
      token.current = { profile, token: value.token }; setReview(value);
      const requested = initialChoice.current; initialChoice.current = undefined;
      const item = value.snapshot.items.find(item => item.id === requested);
      if (item) {
        setQuery(item.name || item.id);
        if (item.editable && !item.unlocked) setDraft({ [item.id]: true });
      }
    } catch (reason) { if (current === generation.current) setError(localAchievementError(reason)); }
    finally { if (current === generation.current) { operation.current = null; setBusy(null); } }
  }, [profile, appId, release]);
  useEffect(() => {
    if (!accepted || !available) return;
    operation.current = null;
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => { clearTimeout(timer); generation.current++; release(); };
  }, [refresh, release, accepted, available]);
  useEffect(() => {
    if (!review) return;
    const timer = window.setTimeout(() => setExpired(true), review.expiresIn * 1000);
    return () => clearTimeout(timer);
  }, [review]);
  useEffect(() => { setLimit(60); if (scroller.current) scroller.current.scrollTop = 0; }, [query, filter, pickQuery]);
  const items = result?.snapshot?.items ?? review?.snapshot.items;
  const selected = review?.snapshot.items.filter(item => Object.hasOwn(draft, item.id)) ?? [];
  const secret = (item: NonNullable<typeof items>[number]) => item.hidden && !item.unlocked && !revealed;
  const rewards = achievementRewards(appId);
  const shown = items?.filter(item => {
    const reward = achievementReward(appId, item.id), changed = Object.hasOwn(draft, item.id);
    return (filter !== "locked" || !item.unlocked) && (filter !== "earned" || item.unlocked) && (filter !== "pending" || changed) && (filter !== "managed" || !item.editable) && (filter !== "rewards" || !!reward) && (!query.trim() || `${item.id} ${secret(item) ? "" : item.name + " " + item.description} ${reward?.name ?? ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  });
  const schemaMissing = !!review && review.snapshot.items.length > 0 && review.snapshot.items.every(item => !item.editable && !item.icon && !item.lockedIcon);
  const empty = !!review && !items?.length;
  const blocked = !picking && step !== "consent" && !busy && (!available || (!!error && !review) || empty);
  const view = picking ? "picker" : step !== "edit" ? step : !available ? "blocked" : busy === "read" ? "loading" : empty ? "empty" : review ? "list" : error ? "error" : "empty";
  const previousView = useRef(view), mountFocus = useRef(true);
  useEffect(() => {
    const wasPicker = previousView.current === "picker"; previousView.current = view;
    const first = mountFocus.current; mountFocus.current = false;
    if (view === "picker") root.current?.querySelector<HTMLElement>(".gam-search input")?.focus({ preventScroll: true });
    else if (wasPicker) root.current?.querySelector<HTMLElement>(".gam-switch")?.focus({ preventScroll: true });
    else if (step !== "edit") root.current?.querySelector<HTMLElement>("[data-step-focus]")?.focus({ preventScroll: true });
    else if (first || previousStep.current !== "edit") (root.current?.querySelector<HTMLElement>('.gam-items [data-changed="true"] button') ?? root.current?.querySelector<HTMLElement>(".gam-close"))?.focus({ preventScroll: true });
    else if (root.current && !root.current.contains(document.activeElement)) root.current.querySelector<HTMLElement>(".gam-close")?.focus({ preventScroll: true });
    previousStep.current = step;
  }, [step, view, root]);
  useEffect(() => {
    const pane = scroller.current;
    if (!pane) return;
    if (view === "list" && keptScroll.current) { pane.scrollTop = keptScroll.current; keptScroll.current = 0; }
    else pane.scrollTop = 0;
  }, [view]);
  useEffect(() => { if (busy === "apply") root.current?.focus({ preventScroll: true }); }, [busy, root]);
  const edit = (rows: NonNullable<typeof items>, mode: AchievementEdit) => {
    if (busy || expired) return;
    try { setDraft(editAchievementDraft(rows, draft, mode)); setError(null); } catch { setError("games.achievementManager.error.invalid"); }
  };
  const earned = items?.filter(item => item.unlocked).length ?? 0;
  const submit = async () => {
    if (!accepted || !review || !token.current || operation.current || expired || (step !== "review" && step !== "edit") || !selected.length) return;
    const current = generation.current;
    operation.current = "apply"; setBusy("apply"); setError(null);
    const held = token.current; token.current = null;
    try {
      const value = await applyLocalAchievements(profile, held.token, selected.map(item => ({ id: item.id, unlocked: draft[item.id] })));
      if (current !== generation.current) return;
      setResult(value); if (value.error) setError(localAchievementError(value.error));
    } catch (reason) { if (current === generation.current) setError(localAchievementError(reason)); }
    finally { if (current === generation.current) { operation.current = null; setBusy(null); setStep("result"); } }
  };
  const verified = result?.results.filter(item => item.verified).length ?? 0;
  const installs = library.scan?.games, owned = account?.status.snapshot?.games;
  const pickRows = useMemo(() => {
    const rows = new Map<number, PickRow>();
    for (const game of installs ?? []) rows.set(game.appId, { appId: game.appId, name: game.name, capsule: game.artwork?.capsule || steamHeader(game.appId), installed: game.state !== "missing", lastPlayed: game.lastPlayed });
    for (const game of owned ?? []) if (!rows.has(game.appId)) rows.set(game.appId, { appId: game.appId, name: game.name, capsule: steamHeader(game.appId), installed: false, lastPlayed: game.lastPlayed });
    return [...rows.values()].sort((a, b) => Number(b.installed) - Number(a.installed) || b.lastPlayed - a.lastPlayed || a.name.localeCompare(b.name));
  }, [installs, owned]);
  const pickShown = pickRows.filter(game => !pickQuery.trim() || `${game.name} ${game.appId}`.toLocaleLowerCase().includes(pickQuery.trim().toLocaleLowerCase()));
  const choose = (game: PickRow) => {
    setPicking(false); setPickQuery("");
    if (game.appId === appId) return;
    initialChoice.current = undefined; setQuery(""); setFilter("all"); setRevealed(false); setDiscarding(false);
    setReview(null); setResult(null); setError(null); setDraft({}); setExpired(false); setStep("edit"); setBusy("read");
    setChosen({ appId: game.appId, name: game.name });
  };
  const pickGame = () => { setPickQuery(""); setPicking(true); };
  const errorKind = error?.split(".").at(-1) ?? "unavailable";
  const refreshAction = <button className="gam-action" disabled={!!busy} onClick={() => { if (selected.length) { setStep("edit"); setDiscarding(true); } else void refresh(); }}><RefreshCw size={16}/>{t("games.achievementManager.refresh")}</button>;
  // The header id comes from the signed-in Steam client, the avatar from the connected Web API account: show it only when both resolve to the same person.
  const snapshot = account?.status.snapshot;
  const persona = snapshot && review && snapshot.steamId === review.snapshot.steamId && (snapshot.name || snapshot.avatar) ? snapshot : null;
  return <ModalShell closing={closing} onDismiss={dismiss} width={740} labelledBy={title} backdropClassName="games-achievement-manager-backdrop">
    <div className="games-achievement-manager" data-step={picking ? "picker" : step} data-status-page={blocked || undefined} ref={root} tabIndex={-1} inert={closing}>
      <header><div>{step !== "consent" && available && !picking ? <button className="gam-game gam-switch" aria-label={`${t("games.achievementManager.pickGame")}: ${gameName}`} disabled={busy === "apply"} onClick={() => { setPickQuery(""); setPicking(true); }}><Gamepad2 size={14} /><span>{gameName}</span><ChevronDown size={14} /></button> : <p className="gam-game">{gameName}</p>}<h2 id={title}>{t(picking ? "games.achievementManager.pickTitle" : step === "consent" ? "games.achievementManager.consentTitle" : step === "review" ? "games.achievementManager.reviewTitle" : "games.achievementManager.title")}</h2></div><button className="gam-close" aria-label={t("common.close")} disabled={busy === "apply"} onClick={dismiss}><X size={20} /></button></header>
      {step !== "consent" && available && !picking && (review || busy === "read") && <div className="gam-account">{persona ? <span className="gam-avatar">{persona.avatar ? <GameArt src={persona.avatar} /> : <LibrarySourceMark source="steam" size={18} />}</span> : <img src="/games/brands/steam.svg" alt="Steam" />}<span className="gam-identity">{persona ? <><strong className="gam-persona">{persona.name || persona.steamId}</strong><small>{t("games.achievementManager.account", { id: persona.steamId })}</small></> : review ? t("games.achievementManager.account", { id: review.snapshot.steamId }) : <i className="gam-bar games-detail-skeleton" />}</span><strong dir="ltr">{review ? <>{earned}<span> / {items?.length}</span></> : <i className="gam-bar games-detail-skeleton" />}</strong></div>}
      {picking && <label className="gam-search" key="pick"><Search size={17} /><input aria-label={t("games.achievementManager.pickSearch")} placeholder={t("games.achievementManager.pickSearch")} value={pickQuery} onChange={event => setPickQuery(event.target.value)} /></label>}
      {!picking && step === "edit" && ((!empty && review) || busy === "read") && <label className="gam-search" key="find"><Search size={17} /><input aria-label={t("games.details.achievementSearch")} placeholder={t("games.details.achievementSearch")} value={query} disabled={!review || !!busy} onChange={event => setQuery(event.target.value)} /></label>}
      {!picking && step === "edit" && ((!empty && review) || busy === "read") && <div className="gam-tools"><div className="gam-filters" role="group" aria-label={t("games.achievementManager.filter")}>{(["all", "locked", "earned", "pending", "managed", ...(rewards.length ? ["rewards" as const] : [])] as const).map(value => <button key={value} aria-pressed={filter === value} disabled={!review || !!busy} onClick={() => setFilter(value)}>{t(`games.achievementManager.${value}`)}</button>)}</div><div className="gam-bulk"><button disabled={!review || !!busy || expired} onClick={() => edit(shown ?? [], "unlock")}><Unlock size={15}/>{t(query || filter !== "all" ? "games.achievementManager.unlockFiltered" : "games.achievementManager.unlockAll")}</button><button disabled={!review || !!busy || expired} onClick={() => edit(shown ?? [], "relock")}>{t("games.achievementManager.relockAll")}</button><button disabled={!review || !!busy || expired} onClick={() => edit(shown ?? [], "invert")}>{t("games.achievementManager.invert")}</button><button disabled={!review || !!busy || !selected.length} onClick={() => { setDraft({}); setDiscarding(false); setError(null); }}><Eraser size={15}/>{t("games.achievementManager.clear")}</button><button disabled={!review || !!busy} onClick={() => { if (selected.length) setDiscarding(true); else void refresh(); }}><RefreshCw size={15}/>{t("games.achievementManager.refresh")}</button></div></div>}
      {!picking && step === "edit" && discarding && <div className="gam-discard" role="alert"><span>{t("games.achievementManager.discardConfirm", { count: selected.length })}</span><button className="gam-action" disabled={!!busy} onClick={() => void refresh()}>{t("games.achievementManager.refresh")}</button><button className="gam-text" onClick={() => setDiscarding(false)}>{t("common.cancel")}</button></div>}
      <div className="gam-scroll" ref={scroller} aria-busy={!!busy}>
        <div className="gam-step" key={view}>
        {step === "consent" && <div className="gam-consent"><div className="gam-consent-mark"><Unlock size={34}/></div><p data-step-focus tabIndex={-1}>{t("games.achievementManager.consentBody")}</p><p>{t("games.achievementManager.consentRules")}</p><SamAttribution/><small>{t("games.achievementManager.consentOnce")}</small></div>}
        {step !== "consent" && !available && <AchievementStatus kind="platform" message={t("games.achievementManager.desktopOnly")}><button className="gam-action" onClick={dismiss}>{t("common.close")}</button></AchievementStatus>}
        {picking && <div className="gam-picker">{library.error && <AchievementStatus kind="library" message={t("games.achievementManager.status.libraryNote")} compact={!!pickRows.length} alert><button className="gam-action" disabled={library.loading} onClick={() => void library.refresh()}><RefreshCw size={16}/>{t("games.achievementManager.refresh")}</button></AchievementStatus>}{!pickRows.length && (library.loading || (library.available && !library.scan && !library.error)) ? <ul className="gam-picker-grid" aria-busy="true">{[0, 1, 2, 3, 4, 5, 6, 7].map(n => <li key={n} aria-hidden="true"><i className="gam-bar games-detail-skeleton" /></li>)}</ul> : !pickShown.length ? (!library.error || !!pickRows.length) && <AchievementStatus kind={pickRows.length ? "filtered" : "noGames"} message={t(pickRows.length ? "games.achievementManager.pickEmpty" : "games.achievementManager.pickUnavailable")}>{pickQuery ? <button className="gam-action" onClick={() => setPickQuery("")}><X size={16}/>{t("games.guides.clearFilters")}</button> : <button className="gam-action" disabled={library.loading} onClick={() => void library.refresh()}><RefreshCw size={16}/>{t("games.achievementManager.refresh")}</button>}</AchievementStatus> : <><ul className="gam-picker-grid">{pickShown.slice(0, limit).map(game => <li key={game.appId}><button aria-current={game.appId === appId ? "true" : undefined} onClick={() => choose(game)}><GameArt src={game.capsule} /><span><strong>{game.name}</strong>{game.installed && <small>{t("games.achievementManager.pickInstalled")}</small>}</span></button></li>)}</ul>{pickShown.length > limit && <button className="gam-action gam-more" onClick={() => setLimit(n => n + 60)}>{t("games.achievementManager.pickMore")}</button>}</>}</div>}
        {!picking && busy === "read" && <div className="gam-loading" role="status"><p>{t("games.achievementManager.reading")}</p>{[0, 1, 2, 3, 4, 5, 6, 7].map(n => <div className="gam-skeleton" key={n}><i className="games-detail-skeleton" /><span><i className="games-detail-skeleton" /><i className="games-detail-skeleton" /></span><i className="games-detail-skeleton" /></div>)}</div>}
        {!picking && !busy && error && <AchievementStatus kind={errorKind} message={t(error)} compact={!!review || !!result} alert>
          {available && <>{errorKind === "notOwned" ? <><button className="gam-action gam-confirm" onClick={pickGame}><Gamepad2 size={16}/>{t("games.achievementManager.pickGame")}</button><button className="gam-action" onClick={() => openUrl(`https://store.steampowered.com/app/${appId}/`)}><LibrarySourceMark source="steam" size={16}/>{t("games.achievementManager.status.store")}</button><span className="gam-status-secondary">{refreshAction}</span></> : <>{errorKind === "noClient" && <button className="gam-action gam-confirm" onClick={() => openUrl("https://store.steampowered.com/about/")}><LibrarySourceMark source="steam" size={16}/>{t("games.achievementManager.status.getSteam")}</button>}{refreshAction}{!review && errorKind !== "noClient" && <button className="gam-action" onClick={pickGame}><Gamepad2 size={16}/>{t("games.achievementManager.pickGame")}</button>}</>}</>}
        </AchievementStatus>}
        {!picking && step === "edit" && !busy && schemaMissing && <p className="gam-message gam-notice" role="status">{t("games.achievementManager.schemaMissing")}</p>}
        {!picking && step === "edit" && !busy && empty && <AchievementStatus kind="empty" message={t("games.achievementManager.status.emptyNote", { game: gameName })}><button className="gam-action" onClick={pickGame}><Gamepad2 size={16}/>{t("games.achievementManager.pickGame")}</button>{refreshAction}</AchievementStatus>}
        {!picking && step === "edit" && !busy && !empty && shown && <><ul className="gam-items">{shown.slice(0, limit).map(item => {
          const changed = Object.hasOwn(draft, item.id), value = changed ? draft[item.id] : item.unlocked;
          const display = secret(item) ? t("games.account.secretAchievement") : item.name || item.id;
          const reward = achievementReward(appId, item.id);
          return <li key={item.id} data-achievement={item.id} data-changed={changed} data-progress={value ? "earned" : "locked"}>
            <span className="gam-icon">{secret(item) ? <LockKeyhole size={22} /> : <GameArt src={value ? item.icon : item.lockedIcon || item.icon} />}{!value && !secret(item) && <i className="games-achievement-lock" aria-hidden="true"><LockKeyhole size={13} /></i>}</span>
            <div className="gam-copy"><h3>{display}</h3><p>{secret(item) ? t("games.account.secretNote") : item.description}</p><span>{t(changed ? value ? "games.achievementManager.pendingUnlock" : "games.achievementManager.pendingRelock" : item.unlocked ? "games.achievementManager.earned" : "games.achievementManager.locked")}{item.unlocked && item.unlockedAt > 0 && <> · <time>{new Date(item.unlockedAt * 1000).toLocaleDateString(language)}</time></>}{!secret(item) && !!item.name && item.name !== item.id && <> · <code className="gam-api-id" dir="ltr">{item.id}</code></>}</span>{reward && <AchievementRewardPreview reward={reward}/>}</div>
            {item.editable ? <button className="gam-choice" aria-pressed={value} aria-label={`${t(changed ? "games.achievementManager.undo" : item.unlocked ? "games.achievementManager.lock" : "games.achievementManager.unlock")}: ${display}`} disabled={expired || !!busy} onClick={() => edit([item], "invert")}><span className="gam-checkbox">{value && <Check size={14} />}</span><span>{t(changed ? "games.achievementManager.undo" : item.unlocked ? "games.achievementManager.lock" : "games.achievementManager.unlock")}</span></button> : <HoverTooltip label={t("games.achievementManager.protected")}><span className="gam-protected" tabIndex={0} aria-label={t("games.achievementManager.protected")}><LockKeyhole size={17} /></span></HoverTooltip>}
          </li>;
        })}</ul>{!shown.length && <AchievementStatus kind="filtered" message={t("games.details.achievementEmpty")}><button className="gam-action" onClick={() => { setQuery(""); setFilter("all"); }}><X size={16}/>{t("games.guides.clearFilters")}</button></AchievementStatus>}{shown.length > limit && <button className="gam-action gam-more" onClick={() => setLimit(n => n + 60)}>{t("games.account.moreAchievements")}</button>}</>}
        {!picking && step === "review" && review && <><p className="gam-message">{busy === "apply" ? t("games.achievementManager.applying") : t("games.achievementManager.reviewNote", { game: gameName, id: review.snapshot.steamId })}</p>
        <p className="gam-message gam-recent-note"><Info size={15}/>{t("games.achievementManager.recentGamesNote", { game: gameName })}</p><ul className="gam-review-list">{selected.map(item => <li key={item.id} data-pending={busy === "apply" ? "true" : undefined}><GameArt src={item.icon} /><strong>{item.name || item.id}</strong><span>{t(item.unlocked ? "games.achievementManager.earned" : "games.achievementManager.locked")}</span><b className={busy === "apply" ? "games-detail-skeleton" : undefined}>{t(draft[item.id] ? "games.achievementManager.unlock" : "games.achievementManager.lock")}</b></li>)}</ul></>}
        {step === "result" && result && <div className="gam-message" role="status"><p>{t(result.confirmed && verified === result.results.length ? "games.achievementManager.applied" : "games.achievementManager.partial", { count: verified, total: result.results.length })}</p><ul className="gam-review-list">{result.results.map(item => <li key={item.id}><strong>{review?.snapshot.items.find(a => a.id === item.id)?.name || item.id}</strong><span>{item.verified ? t(item.actual ? "games.achievementManager.earned" : "games.achievementManager.locked") : t("games.achievementManager.unconfirmed")}</span>{item.verified && <Check size={16} />}</li>)}</ul></div>}
        </div>
        {step !== "consent" && !picking && !blocked && review && rewards.length > 0 && <p className="gam-reward-note"><Gift size={18}/>{t("games.achievementManager.rewardNote")}</p>}
      </div>
      {expired && step !== "result" && !picking && <div className="gam-expired"><AchievementStatus kind="expired" message={t("games.achievementManager.error.expired")} compact>{refreshAction}</AchievementStatus></div>}
      {!blocked && <footer><div>{!picking && step === "edit" && review ? <><span aria-live="polite">{t("games.achievementManager.changes", { count: selected.length })}</span><button className="gam-text" aria-pressed={revealed} onClick={() => setRevealed(v => !v)}>{t(revealed ? "games.account.hideSecrets" : "games.account.revealSecrets")}</button></> : <span>{picking ? t("games.achievementManager.pickNote") : step === "review" ? t("games.achievementManager.note") : ""}</span>}</div><div className="gam-footer-actions gam-step" key={view}>
        {step === "consent" && <button data-step-focus className="gam-action gam-confirm" onClick={() => { acceptAchievementNotice(profile); setAccepted(true); setStep("edit"); if (available) setBusy("read"); }}>{t("games.achievementManager.consentAccept")}</button>}
        {picking && <button className="gam-action" onClick={() => { setPicking(false); setPickQuery(""); }}>{t("common.cancel")}</button>}
        {!picking && step === "edit" && review && !expired && <><button className="gam-action" disabled={!selected.length || !!busy} onClick={() => { keptScroll.current = scroller.current?.scrollTop ?? 0; setStep("review"); }}>{t("games.achievementManager.review")}</button><button className="gam-action gam-confirm" disabled={!selected.length || !!busy} onClick={() => void submit()}>{t(busy === "apply" ? "games.achievementManager.applying" : "games.achievementManager.commit")}</button></>}
        {!picking && step === "review" && <><button className="gam-action" disabled={!!busy} onClick={() => setStep("edit")}>{t("games.achievementManager.back")}</button><button data-step-focus className="gam-action gam-confirm" disabled={!!busy || expired} onClick={() => void submit()}>{t(busy === "apply" ? "games.achievementManager.applying" : "games.achievementManager.apply")}</button></>}
        {!picking && step === "result" && <><button data-step-focus className="gam-action" onClick={() => void refresh()}>{t("games.achievementManager.back")}</button><button className="gam-action gam-confirm" onClick={dismiss}>{t("common.close")}</button></>}
        
      </div></footer>}
      {step !== "consent" && <div className="gam-credit"><SamAttribution/></div>}
    </div>
  </ModalShell>;
}

function SamAttribution() {
  const t = useT();
  return <a className="gam-sam" href="https://github.com/gibbed/SteamAchievementManager" target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); openUrl("https://github.com/gibbed/SteamAchievementManager"); }}><img src="/games/brands/sam.ico" alt=""/><span><strong>Steam Achievement Manager</strong><small>{t("games.achievementManager.consentSam")}</small></span></a>;
}
