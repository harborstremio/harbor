import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, LoaderCircle } from "lucide-react";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { simsTrayPreview, type SimsTrayItem } from "@/lib/games/sims";
import homeIcon from "@/assets/nav-icons/home.svg";
import type { SimsSelection } from "./game-sims-review";
import { GameSimsContent } from "./game-sims-content";

function TrayPreview({ path, item, active }: { path: string; item: SimsTrayItem; active: boolean }) {
  const t = useT(), root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false), [src, setSrc] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!active || !root.current) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); } }, { rootMargin: "100px" });
    observer.observe(root.current); return () => observer.disconnect();
  }, [active]);
  useEffect(() => {
    if (!active || !visible) return;
    const controller = new AbortController(); setBusy(true); setSrc("");
    void simsTrayPreview(path, item.id, controller.signal).then(value => { if (!controller.signal.aborted) setSrc(value ?? ""); }, () => {}).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [active, visible, path, item.id, item.installed]);
  return <div ref={root} className="games-sims-tray-preview">
    {src ? <img src={src} alt="" onError={() => setSrc("")}/> : <span className="games-sims-tray-icon" style={{ maskImage: `url("${homeIcon}")` }} aria-hidden="true"/>}
    {busy && <span className="games-sims-preview-loading" role="status" aria-label={t("common.loading")}><LoaderCircle size={22}/></span>}
  </div>;
}

export function GameSimsTray({ profile, path, active, revision, items, disabled, choose, openCreator }: { profile: string; path: string; active: boolean; revision: string; items: SimsTrayItem[]; disabled: boolean; choose: (value: SimsSelection) => void; openCreator: (project: string, trigger: HTMLElement) => void }) {
  const t = useT();
  const [selection, setSelection] = useState<{ item: SimsTrayItem; trigger: HTMLElement } | null>(null);
  useEffect(() => { setSelection(null); }, [profile, path, revision, active, disabled]);
  return <div className="games-sims-tray">
    {items.map(item => <article key={item.id}>
      <TrayPreview key={`${path}:${revision}:${item.id}`} path={path} item={item} active={active}/>
      <div className="games-sims-tray-main"><h3 dir="auto">{item.title}</h3>
        <p>{t(`games.sims.tray${item.category === "household" ? "Household" : item.category === "room" ? "Room" : "Lot"}`)} · {t("games.sims.setFiles", { count: item.files.length })}</p>
        <small>{t(item.installed ? "games.sims.trayInstalled" : "games.sims.trayRemoved")}</small>
        {item.source?.provider === "mts" && <button className="games-detail-text-button" onClick={() => void openUrl(`https://modthesims.info/d/${item.source!.project}/`)}>Mod The Sims <ArrowUpRight size={12}/></button>}
        {item.ccGroup && <p>{t("games.sims.trayCc")}</p>}
        <button className="games-detail-text-button games-sims-info-button" disabled={disabled} onClick={event => setSelection({ item, trigger: event.currentTarget })}>{t("games.sims.ccCheck")}</button>
      </div>
      <button className="games-button" disabled={disabled} onClick={() => choose({ action: { kind: item.installed ? "trayRemove" : "trayRestore", id: item.id }, title: item.title, sources: [] })}>{t(item.installed ? "games.sims.trayRemove" : "games.sims.trayRestore")}</button>
    </article>)}
    {!!items.length && <p>{t("games.sims.trayPlayNote")}</p>}
    {selection && active && !disabled && <GameSimsContent key={`${profile}:${path}:${revision}:${selection.item.id}`} profile={profile} path={path} item={selection.item} trigger={selection.trigger} onClose={() => setSelection(null)} openCreator={openCreator}/>}
  </div>;
}
