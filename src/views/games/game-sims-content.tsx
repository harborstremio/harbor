import { useCallback, useEffect, useId, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { ChevronDown, File, LoaderCircle, X } from "lucide-react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useSectionBack } from "@/lib/section-back";
import { useT, useUiLanguage } from "@/lib/i18n";
import { simsCancel, simsError, simsTrayPreview, type SimsProgress, type SimsTrayItem } from "@/lib/games/sims";
import { simsTrayContent, type SimsContentMatch, type SimsContentReport } from "@/lib/games/sims-content";
import { simsPackName } from "@/lib/games/sims-packs";
import { SimsPackCheckActions, useSimsPackSelection } from "./game-sims-packs";

export function GameSimsContent({ profile, path, item, trigger, onClose, openCreator }: { profile: string; path: string; item: SimsTrayItem; trigger: HTMLElement; onClose: () => void; openCreator: (project: string, trigger: HTMLElement) => void }) {
  const t = useT(), language = useUiLanguage(), titleId = useId(), root = useRef<HTMLDivElement>(null);
  const build = item.category !== "household";
  const packs = useSimsPackSelection(), selectionKey = JSON.stringify(packs.selection);
  const selection = useRef(packs.selection); selection.current = packs.selection;
  const [report, setReport] = useState<SimsContentReport | null>(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(true), [file, setFile] = useState(""), [attempt, setAttempt] = useState(0), [cover, setCover] = useState("");
  const [limit, setLimit] = useState(12);
  const alive = useRef(true), operation = useRef("");
  const afterClose = useRef<(() => void) | null>(null);
  const { closing, close: animateClose } = useModalExit(() => { onClose(); afterClose.current?.(); });
  const cancel = useCallback(() => { if (operation.current) void simsCancel(profile, operation.current).catch(() => {}); }, [profile]);
  const close = () => { alive.current = false; cancel(); animateClose(); };
  const retry = () => { root.current?.querySelector<HTMLButtonElement>("header button")?.focus({ preventScroll: true }); setAttempt(n => n + 1); };
  useSectionBack(close, true);
  useEffect(() => {
    if (alive.current && root.current && !root.current.contains(document.activeElement)) root.current.querySelector<HTMLButtonElement>("header button")?.focus({ preventScroll: true });
  }, [busy, error]);
  useEffect(() => {
    alive.current = true;
    const backdrop = root.current?.closest('[role="dialog"]')?.parentElement;
    const background = [...document.body.children].filter((node): node is HTMLElement => node instanceof HTMLElement && node !== backdrop);
    const previous = background.map(node => node.inert);
    background.forEach(node => { node.inert = true; });
    root.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const controls = [...(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],summary,input:not(:disabled),[tabindex="0"]') ?? [])].filter(e => e.getClientRects().length);
      if (!controls.length) return;
      const active = document.activeElement;
      if (event.shiftKey && (active === controls[0] || !root.current?.contains(active))) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && (active === controls.at(-1) || !root.current?.contains(active))) { event.preventDefault(); controls[0].focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => {
      alive.current = false; cancel(); document.removeEventListener("keydown", trap);
      background.forEach((node, index) => { node.inert = previous[index]; });
      requestAnimationFrame(() => { if (!alive.current && trigger.isConnected && trigger.getClientRects().length) trigger.focus({ preventScroll: true }); });
    };
  }, [cancel, trigger]);
  useEffect(() => {
    const controller = new AbortController(); setCover("");
    void simsTrayPreview(path, item.id, controller.signal).then(value => { if (!controller.signal.aborted) setCover(value ?? ""); }, () => {});
    return () => controller.abort();
  }, [path, item.id, item.installed]);
  useEffect(() => {
    let current = true;
    setReport(null); setError(""); setFile(""); setLimit(12); setBusy(true);
    if (packs.busy) return;
    const token = crypto.randomUUID(); operation.current = token;
    void (async () => {
      let stop: (() => void) | undefined;
      try {
        stop = await listen<SimsProgress>("games:sims-progress", ({ payload }) => {
          if (payload.profile !== profile || payload.operationId !== token) return;
          if (!current || !alive.current) { if (payload.canCancel) void simsCancel(profile, token).catch(() => {}); }
          else setFile(payload.file ?? "");
        });
        if (!current || !alive.current) return;
        const value = await simsTrayContent(profile, path, item.id, token, selection.current);
        if (current && alive.current) setReport(value);
      } catch (reason) { if (current && alive.current) setError(["sims_cc_unsupported", "sims_tray_format"].includes(String(reason)) ? "games.sims.ccUnsupported" : simsError(reason)); }
      finally { stop?.(); if (operation.current === token) operation.current = ""; if (current && alive.current) setBusy(false); }
    })();
    return () => { current = false; void simsCancel(profile, token).catch(() => {}); };
  }, [profile, path, item.id, item.installed, selectionKey, packs.busy, attempt]);
  const show = (entry: SimsContentMatch, index: number) => <article className="games-sims-content-file" key={`${entry.area}:${entry.path}:${index}`}>
    <File size={19} aria-hidden="true"/>
    <div><h3 dir="auto">{entry.title ?? entry.path.split("/").at(-1)}</h3>
      <small className="games-sims-info-source" dir="auto">{entry.path}</small>
      {!build && <p dir="auto">{report?.sims.filter(sim => entry.sims.includes(sim.id)).map(sim => sim.name || sim.id).join(" · ")}</p>}
      <small>{t("games.sims.ccMatches", { count: entry.references })}{entry.area === "disabled" && ` · ${t("games.mods.disabled")}`}</small>
      {entry.pack && <p>{simsPackName(entry.pack) ?? entry.pack}{entry.packAvailable !== true && <> · {t(entry.packAvailable === false ? "games.sims.ccPackUnavailable" : "games.sims.packsUnchecked")}</>}</p>}
      {entry.ambiguous && <small>{t("games.sims.ccOverlap")}</small>}
    </div>
  </article>;
  const mods = report?.matches.filter(m => m.area !== "game") ?? [], game = report?.matches.filter(m => m.area === "game") ?? [];
  return <ModalShell closing={closing} onDismiss={close} labelledBy={titleId} width={720} backdropClassName="games-sims-scrim">
    <div className="games-sims-dialog games-sims-content" ref={root}>
      <header>{cover && <img className="games-sims-content-cover" src={cover} alt="" onError={() => setCover("")}/>}<div><small>{t(build ? "games.sims.ccBuildTitle" : "games.sims.ccTitle")}</small><h2 id={titleId} dir="auto">{item.title}</h2></div><button className="games-icon-button" aria-label={t("common.close")} onClick={close}><X size={20}/></button></header>
      <div className="games-sims-dialog-body" aria-busy={busy}>
        {busy ? <div className="games-sims-info-loading" role="status"><LoaderCircle size={24}/><p>{t("games.sims.checking")}</p>{file && <small dir="auto">{file}</small>}</div> : error ? <p role="alert">{t(error)} <button className="games-button" onClick={retry}>{t("common.retry")}</button></p> : report && <>
          <p className="games-sims-info-note">{t(build ? "games.sims.ccBuildNote" : "games.sims.ccNote")}</p>
          {build && report.objects != null && <p>{t("games.sims.ccBuildObjects", { count: report.objects })}</p>}
          <p role="status">{t("games.sims.ccCoverage", { files: report.checkedFiles, references: report.references })}</p>
          {build && report.otherData && <p className="games-sims-notice">{t("games.sims.ccBuildPartial")}</p>}
          {report.partial && <p className="games-sims-notice">{t("games.sims.ccPartial")}</p>}
          {report.unresolved > 0 && <p>{t("games.sims.ccUnresolved", { count: report.unresolved })}</p>}
          {report.modsEnabled !== true && <p className="games-sims-notice">{t("games.sims.settingsNote")}</p>}
          {!report.resourceReady && <p>{t("games.sims.resourceNote")}</p>}
          <section aria-label={t("games.sims.ccLocal")}><h3 className="games-sims-content-heading">{t("games.sims.ccLocal")}</h3>
            {mods.length ? mods.slice(0, limit).map(show) : <p>{t("games.sims.ccNoMods")}</p>}
            {mods.length > limit && <button className="games-button" onClick={() => setLimit(n => n + 12)}>{t("games.details.showMore")}</button>}
          </section>
          {game.length > 0 && <details className="games-sims-content-game"><summary>{t("games.sims.ccGame", { count: game.length })}<ChevronDown size={16}/></summary>{game.map(show)}</details>}
          {report.gameError && <p role="alert">{t("games.sims.depsPackError")}</p>}
          {item.source?.provider === "mts" && <button className="games-detail-text-button games-sims-content-source" onClick={() => { afterClose.current = () => openCreator(item.source!.project!, trigger); close(); }}>{t("games.sims.ccCreator")}</button>}
          <small className="games-sims-content-date">{t("games.sims.packsChecked", { date: new Date(report.checkedAt * 1000).toLocaleString(language, { dateStyle: "medium", timeStyle: "short" }) })}</small>
        </>}
        <details className="games-sims-content-game"><summary>{t("games.sims.packsTitle")}<ChevronDown size={16}/></summary>
          {!packs.selection && !packs.busy && <p>{t("games.sims.ccNoGame")}</p>}<SimsPackCheckActions/>
        </details>
      </div>
      <footer>{report && !busy && <button className="games-button" onClick={retry}>{t("games.sims.duplicatesAgain")}</button>}<button className="games-button" onClick={close}>{t(busy ? "common.cancel" : "common.close")}</button></footer>
    </div>
  </ModalShell>;
}
