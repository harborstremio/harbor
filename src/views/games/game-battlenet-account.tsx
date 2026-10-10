import { useEffect, useId, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useT } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import type { BattleNetAccount } from "@/hooks/use-battlenet-account";
import { GameLauncherLogo } from "./game-launcher-logo";
import { useAccountDialogFocus } from "./game-steam-account";
import "./game-battlenet-account.css";
import "./game-library-accounts.css";

export function GameBattleNetAccountControl({ account, active }: { account: BattleNetAccount; active: boolean }) {
  const t = useT(), [open, setOpen] = useState(false), origin = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (!active) setOpen(false); }, [active]);
  useEffect(() => setOpen(false), [account.profile]);
  if (!account.available) return null;
  const close = () => { setOpen(false); requestAnimationFrame(() => origin.current?.focus({ preventScroll: true })); };
  return <div className="games-library-account-control"><button ref={origin} className="games-button games-library-account-button" onClick={() => setOpen(true)}><GameLauncherLogo launcher="battlenet" size={22}/>Battle.net<span className="games-library-account-action">{t(account.status.connection ? "games.account.manage" : "games.battlenet.connect")}</span></button>
    {open && active && <AccountDialog account={account} onClose={close}/>}
  </div>;
}
function AccountDialog({ account, onClose }: { account: BattleNetAccount; onClose: () => void }) {
  const t = useT(), id = useId(), root = useAccountDialogFocus(), { closing, close } = useModalExit(onClose);
  const [removing, setRemoving] = useState(false), [signing, setSigning] = useState(false);
  const cancelRef = useRef(account.cancel); cancelRef.current = account.cancel;
  useEffect(() => () => cancelRef.current(), []);
  const dismiss = () => { account.cancel(); close(); }; useSectionBack(dismiss, true);
  const { status } = account, snapshot = status.snapshot;
  const count = snapshot ? new Set([...snapshot.modern.games, ...snapshot.classic.games].map(game => game.id)).size : 0;
  const date = snapshot ? new Date(Math.min(snapshot.modern.updatedAt, snapshot.classic.updatedAt) * 1000).toLocaleString() : "";
  const connect = async () => { setSigning(true); await account.connect(); setSigning(false); };
  return <ModalShell width={550} closing={closing} onDismiss={dismiss} labelledBy={id} backdropClassName="games-account-backdrop"><div ref={root} className="games-account-dialog games-battlenet-dialog">
    <header><GameLauncherLogo launcher="battlenet" size={34}/><div><h2 id={id}>Battle.net</h2></div><button className="games-icon-button" aria-label={t("common.close")} onClick={dismiss}><X size={22}/></button></header>
    <div className="games-account-dialog-scroll"><p className="games-account-intro">{t("games.battlenet.intro")}</p>
      {snapshot && <p className="games-battlenet-status">{t("games.battlenet.cached", { count, date })}</p>}
      <label className="games-battlenet-choice"><input type="checkbox" checked={status.importInstalled} disabled={account.busy || !account.loaded} onChange={event => void account.preferences(event.target.checked, status.importUninstalled)}/><span>{t("games.battlenet.installed")}</span></label>
      <label className="games-battlenet-choice"><input type="checkbox" checked={status.importUninstalled} disabled={account.busy || !account.loaded} onChange={event => void account.preferences(status.importInstalled, event.target.checked)}/><span>{t("games.battlenet.uninstalled")}</span></label>
      {status.warnings.some(warning => warning === "modern" || warning === "classic") && <p className="games-battlenet-status" role="status">{t("games.battlenet.partial")}</p>}
      {status.warnings.includes("unresolved") && <p className="games-battlenet-status" role="status">{t("games.battlenet.unresolved")}</p>}
      {account.error && <div className="games-account-error" role="alert"><span>{t(account.error)}</span><button className="games-text-action" disabled={account.busy} onClick={() => void account.reload()}>{t("common.retry")}</button></div>}
      {signing && account.busy && <p className="games-battlenet-status" role="status">{t("games.battlenet.signing")}</p>}
      {status.connection && <div className="games-battlenet-remove">{removing ? <><p>{t("games.battlenet.removeNote")}</p><button className="games-button" disabled={account.busy} onClick={() => void account.disconnect().then(done => { if (done) setRemoving(false); })}>{t("games.battlenet.disconnect")}</button><button className="games-text-action" disabled={account.busy} onClick={() => setRemoving(false)}>{t("common.cancel")}</button></> : <button className="games-text-action" disabled={account.busy} onClick={() => setRemoving(true)}>{t("games.battlenet.disconnect")}</button>}</div>}
    </div>
    <footer>{account.busy ? <><span role="status">{t("common.loading")}</span><button className="games-button" onClick={account.canCancel ? account.cancel : dismiss}>{t(account.canCancel ? "common.cancel" : "common.close")}</button></> : <><button className="games-button" onClick={() => void connect()}>{t("games.battlenet.connect")}</button>{status.connection && <button className="games-button" onClick={() => void account.refresh()}><RefreshCw size={19}/>{t("games.cache.refresh")}</button>}</>}</footer>
  </div></ModalShell>;
}
