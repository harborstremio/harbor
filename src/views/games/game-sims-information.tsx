import { useEffect, useId, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { LoaderCircle, X } from "lucide-react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useSectionBack } from "@/lib/section-back";
import { useT } from "@/lib/i18n";
import { GameSimsMetadata } from "./game-sims-metadata";
import { simsCancel, simsError, simsMetadata, type SimsMetadataReport, type SimsMetadataTarget, type SimsProgress } from "@/lib/games/sims";

export function GameSimsInformation({ profile, path, target, title, trigger, onClose }: { profile: string; path: string; target: SimsMetadataTarget; title: string; trigger: HTMLElement | null; onClose: () => void }) {
  const t = useT(), id = useId(), root = useRef<HTMLDivElement>(null), alive = useRef(true), operation = useRef("");
  const [report, setReport] = useState<SimsMetadataReport | null>(null), [busy, setBusy] = useState(true), [error, setError] = useState("");
  const [file, setFile] = useState(""), [attempt, setAttempt] = useState(0);
  const { closing, close: animateClose } = useModalExit(onClose);
  const close = () => { alive.current = false; if (operation.current) void simsCancel(profile, operation.current).catch(() => {}); animateClose(); };
  useSectionBack(close, true);
  useEffect(() => {
    alive.current = true;
    root.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const nodes = [...(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]') ?? [])].filter(node => node.getClientRects().length);
      if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0]?.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => {
      alive.current = false;
      if (operation.current) void simsCancel(profile, operation.current).catch(() => {});
      document.removeEventListener("keydown", trap);
      requestAnimationFrame(() => { if (!alive.current && trigger?.isConnected && trigger.getClientRects().length) trigger.focus({ preventScroll: true }); });
    };
  }, [profile, trigger]);
  useEffect(() => {
    let current = true;
    const token = crypto.randomUUID(); operation.current = token;
    setBusy(true); setError(""); setFile("");
    void (async () => {
      let stop: (() => void) | undefined;
      try {
        stop = await listen<SimsProgress>("games:sims-progress", ({ payload }) => {
          if (payload.profile !== profile || payload.operationId !== token) return;
          // Closing can precede native registration; cancel again on its first event.
          if (!current || !alive.current) { if (payload.canCancel) void simsCancel(profile, token).catch(() => {}); }
          else setFile(payload.file ?? "");
        });
        if (!current || !alive.current) return;
        const value = await simsMetadata(profile, path, target, token);
        if (current && alive.current) setReport(value);
      } catch (reason) { if (current && alive.current) setError(simsError(reason)); }
      finally { stop?.(); if (operation.current === token) operation.current = ""; if (current && alive.current) setBusy(false); }
    })();
    return () => { current = false; if (operation.current === token) void simsCancel(profile, token).catch(() => {}); };
  }, [profile, path, target, attempt]);
  return <ModalShell closing={closing} onDismiss={close} labelledBy={id} width={640} backdropClassName="games-sims-scrim"><div className="games-sims-dialog games-sims-information" ref={root}>
    <header><div><small>The Sims 4 · {t("games.sims.info")}</small><h2 id={id} dir="auto">{title}</h2></div><button className="games-icon-button" aria-label={t("common.close")} onClick={close}><X size={20}/></button></header>
    <div className="games-sims-dialog-body" aria-busy={busy}>
      {busy ? <div className="games-sims-info-loading" role="status"><LoaderCircle size={24}/><p>{t("games.sims.checking")}</p>{file && <small dir="auto">{file}</small>}</div> : error ? <p role="alert">{t(error)} <button className="games-button" onClick={() => { root.current?.querySelector<HTMLElement>("button")?.focus(); setAttempt(n => n + 1); }}>{t("common.retry")}</button></p> : <>
        {report && <GameSimsMetadata report={report}/>}
      </>}
    </div>
    <footer><button className="games-button" onClick={close}>{t("common.close")}</button></footer>
  </div></ModalShell>;
}
