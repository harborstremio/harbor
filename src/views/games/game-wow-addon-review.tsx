import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, Check, X } from "lucide-react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useT } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import { openUrl } from "@/lib/window";
import { transferBytes } from "@/lib/games/transfers";
import { applyWowAddon, cancelWowAddon, discardWowAddon, onWowAddonProgress, recoverWowAddons, reviewWowAddon, wowAddonError, type WowAddonRequest, type WowAddonReview, type WowAddonWorkspace } from "@/lib/games/wow-addon-manager";
import { GameWowAddonMedia } from "./game-wow-addon-media";

export function GameWowAddonReview({ id, profile, title, addonId, request, available, unavailable, onClose, changed }: { id: string; profile: string; title: string; addonId?: number; request: WowAddonRequest | { action: "recover" }; available: boolean; unavailable: string; onClose: () => void; changed: (value: WowAddonWorkspace) => void }) {
  const t = useT(), heading = useId(), root = useRef<HTMLDivElement>(null), alive = useRef(true), pending = useRef(false), operation = useRef(""), token = useRef(""), generation = useRef(0);
  const [plan, setPlan] = useState<WowAddonReview | null>(null), [busy, setBusy] = useState(false), [phase, setPhase] = useState(""), [error, setError] = useState(""), [done, setDone] = useState(false);
  const { closing, close: animateClose } = useModalExit(onClose);
  const discard = () => { if (token.current) void discardWowAddon(profile, token.current); token.current = ""; };
  const cancel = () => { generation.current++; if (operation.current) void cancelWowAddon(profile, operation.current); discard(); setPlan(null); setError("games.wow.manager.cancelled"); };
  const close = () => { alive.current = false; cancel(); animateClose(); };
  useSectionBack(close, true);
  useEffect(() => {
    alive.current = true; const previous = document.activeElement as HTMLElement | null; root.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    const trap = (event: KeyboardEvent) => { if (event.key !== "Tab") return; const nodes = [...(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]') ?? [])].filter(node => node.getClientRects().length); if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1)?.focus(); } else if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0]?.focus(); } };
    document.addEventListener("keydown", trap);
    const off = onWowAddonProgress(profile, (operationId, value) => { if (alive.current && operation.current === operationId) setPhase(value); });
    return () => { alive.current = false; generation.current++; if (operation.current) void cancelWowAddon(profile, operation.current); discard(); document.removeEventListener("keydown", trap); void off.then(fn => fn()); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [profile]);
  useEffect(() => {
    if (!plan) return;
    const timer = window.setTimeout(() => { discard(); setPlan(null); setError("games.wow.manager.errorExpired"); }, Math.max(0, Math.min(900_000, plan.expiresAt - Date.now())));
    return () => window.clearTimeout(timer);
  }, [plan]);
  const run = async () => {
    if (pending.current || !available || !alive.current) return;
    pending.current = true; const own = ++generation.current; operation.current = crypto.randomUUID(); setBusy(true); setError(""); setPhase(plan ? "apply" : request.action === "recover" ? "recover" : "checking");
    try {
      if (plan || request.action === "recover") {
        const held = token.current; token.current = ""; setPlan(null);
        const value = request.action === "recover" ? await recoverWowAddons(profile, id, operation.current) : await applyWowAddon(profile, held, operation.current);
        // A cancellation may race a completed native commit. Its real success
        // still wins while mounted; closing re-reads the workspace on return.
        if (alive.current) { changed(value); setDone(true); setError(""); }
      } else {
        const value = await reviewWowAddon(profile, id, request, operation.current);
        if (alive.current && own === generation.current) { token.current = value.token; setPlan(value); }
        else void discardWowAddon(profile, value.token);
      }
    } catch (reason) { if (alive.current && own === generation.current) setError(wowAddonError(reason)); }
    finally { pending.current = false; operation.current = ""; if (alive.current) { setBusy(false); setPhase(""); } }
  };
  const phaseKey = ["download", "inspect", "stage", "compare", "checking", "ready"].includes(phase) ? "games.wow.manager.preparing" : "games.wow.manager.applying";
  return <ModalShell closing={closing} onDismiss={close} width={850} labelledBy={heading} backdropClassName="wow-addon-scrim"><div ref={root} className="wow-addon-dialog">
    <header><div><small>{addonId ? "WoWInterface" : t("games.wow.manager.managed")}</small><h2 id={heading} dir="auto">{title}</h2></div><button className="games-icon-button" aria-label={t("common.close")} onClick={close}><X size={20}/></button></header>
    <div className="wow-addon-dialog-body">
      {done ? <div className="wow-addon-success" role="status"><Check size={28}/><p>{t(request.action === "adopt" ? "games.wow.manager.importSuccess" : "games.wow.manager.success")}</p></div> : plan ? <>
        <h3>{t(plan.adopt ? "games.wow.manager.importInstalled" : "games.mods.changeTitle")}</h3><p className="wow-addon-caption">{t("games.wow.addons.client", { version: plan.clientVersion })}</p><p className="wow-addon-version">{plan.adopt ? t("games.wow.manager.keepVersion", { version: plan.version ?? "—" }) : <>{plan.fromVersion || "—"} → {plan.version || t("common.remove")}</>}</p>
        <ul className="wow-addon-folders">{plan.folders.map(folder => <li key={folder.name}><span>{folder.name}</span><small>{t(`games.wow.manager.${folder.action}`)}</small></li>)}</ul>
        <p className="wow-addon-caption">{t("games.wow.manager.fileSummary", { count: plan.files, size: transferBytes(plan.bytes) })}</p>
        {plan.adopt && <p className="wow-addon-caption">{t("games.wow.manager.importNote")}</p>}
        {plan.backupBytes > 0 && <p className="wow-addon-caption">{t("games.wow.manager.backupNote", { size: transferBytes(plan.backupBytes) })}</p>}
        {!!plan.dependencies.length && <p className="wow-addon-caption">{t("games.wow.addons.requires")}: {plan.dependencies.join(", ")}</p>}
      </> : <>
        <p className="wow-addon-caption">{t(request.action === "recover" ? "games.wow.manager.recovery" : request.action === "adopt" ? "games.wow.manager.importNote" : "games.wow.manager.reviewNote")}</p>
        {request.action === "remove" && <p>{t("common.remove")} · {title}</p>}
        {!!addonId && <GameWowAddonMedia id={addonId} active={!closing}/>}
      </>}
      {!available && !done && <p className="wow-addon-notice">{t(unavailable)}</p>}
      {busy && <p className="wow-addon-progress" role="status" aria-live="polite"><i/>{t(phaseKey)}</p>}
      {error && <p className="wow-addon-notice" role="alert">{t(error)}</p>}
    </div>
    <footer>{addonId ? <a href={`https://www.wowinterface.com/downloads/info${addonId}.html`} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); openUrl(`https://www.wowinterface.com/downloads/info${addonId}.html`); }}>{t("games.wow.addons.website")}<ArrowUpRight size={14}/></a> : <span/>}<div>{busy ? <button className="games-button" onClick={cancel}>{t("common.cancel")}</button> : done ? <button className="games-button games-button-primary" onClick={close}>{t("common.done")}</button> : <button className="games-button games-button-primary" disabled={!available} onClick={() => void run()}>{t(plan ? "games.mods.applyChanges" : request.action === "recover" ? "games.wow.manager.recover" : "games.mods.reviewChanges")}</button>}</div></footer>
  </div></ModalShell>;
}
