import { useEffect, useId, useRef } from "react";
import { FolderOpen, RefreshCw, X } from "lucide-react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useT } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import { simsDisplayPath, type SimsFolder } from "@/lib/games/sims";
import { ModGameMark } from "./mod-identity";

export function ModSimsSetup({ folders, loading, error, choose, scan, select, close: onClose }: { folders: SimsFolder[]; loading: boolean; error: string; choose: () => void; scan: () => void; select: (path: string) => void; close: () => void }) {
  const t = useT(), id = useId(), root = useRef<HTMLDivElement>(null), { close, closing } = useModalExit(onClose);
  useSectionBack(close, true);
  useEffect(() => { const origin = document.activeElement as HTMLElement | null; root.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true }); return () => { if (origin?.isConnected) origin.focus({ preventScroll: true }); }; }, []);
  return <ModalShell labelledBy={id} width={640} backdropClassName="games-sims-scrim" closing={closing} onDismiss={close}><div className="mod-setup-dialog" ref={root} onKeyDown={event => {
    if (event.key !== "Tab") return;
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
    if (document.activeElement === (event.shiftKey ? buttons[0] : buttons.at(-1))) { event.preventDefault(); (event.shiftKey ? buttons.at(-1) : buttons[0])?.focus(); }
  }}><header><ModGameMark game="sims4"/><h2 id={id}>{t("games.sims.connect")}</h2><button className="games-icon-button" aria-label={t("common.close")} onClick={close}><X size={22}/></button></header>
    <p>{t("games.sims.folderNote")}</p><code dir="ltr">Documents / Electronic Arts / The Sims 4</code>
    {loading ? <p role="status">{t("common.loading")}</p> : error ? <p role="alert">{t(error)}</p> : <h3>{t(folders.length ? "games.modHub.detectedFolders" : "games.modHub.noFolderFound")}</h3>}
    <div className="mod-setup-folders">{folders.map(folder => <button key={folder.path} disabled={loading} onClick={() => select(folder.path)}><FolderOpen size={24}/><span><strong dir="auto">{simsDisplayPath(folder.path)}</strong><small>{t("games.sims.version", { version: folder.gameVersion })}</small></span></button>)}</div>
    <footer><button className="games-button" disabled={loading} onClick={scan}><RefreshCw size={19}/>{t("games.modHub.scanFolders")}</button><button className="games-button games-button-primary" disabled={loading} onClick={choose}><FolderOpen size={19}/>{t("games.sims.choose")}</button></footer>
  </div></ModalShell>;
}
