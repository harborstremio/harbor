import { useEffect, useId, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { ArrowUpRight, Check, ChevronDown, LoaderCircle, X } from "lucide-react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useSectionBack } from "@/lib/section-back";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { transferBytes } from "@/lib/games/transfers";
import { stardewApply, stardewCancel, stardewDiscard, stardewError, stardewRecover, stardewReview, type StardewAction, type StardewProgress, type StardewReview, type StardewWorkspace } from "@/lib/games/stardew";
export function GameStardewReview({ profile, path, action, trigger, fallback, onClose, changed }: { profile: string; path: string; action: StardewAction | { kind: "recover" }; trigger: HTMLElement | null; fallback: HTMLElement | null; onClose: () => void; changed: (value: StardewWorkspace) => void }) {
 const t = useT(), id = useId(), root = useRef<HTMLDivElement>(null); const text = (key: string) => t(`games.stardew.${key}`);
 const [review, setReview] = useState<StardewReview | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(""), [done, setDone] = useState(false), [canceling, setCanceling] = useState(false);
 const alive = useRef(true), applying = useRef(false), token = useRef(""); const task = useRef<{ id: string; canceled: boolean } | null>(null);
 const [progress, setProgress] = useState<StardewProgress | null>(null);
 const { closing, close: animateClose } = useModalExit(onClose);
 const cancel = () => { const own = task.current; if (!own) return; own.canceled = true; setCanceling(true); void stardewCancel(profile, own.id).catch(() => {}); };
 const close = () => { if (applying.current) return; alive.current = false; cancel(); if (token.current) void stardewDiscard(profile, token.current).catch(() => {}); animateClose(); };
 useSectionBack(close, true);
 const run = async (apply: boolean) => {
  if (task.current) return;
  const own = { id: crypto.randomUUID(), canceled: false }; task.current = own; applying.current = apply;
  setBusy(true); setError(""); setCanceling(false); setProgress(null); let stop: (() => void) | undefined;
  try {
   stop = await listen<StardewProgress>("games:stardew-progress", ({ payload }) => { if (payload.profile !== profile || payload.operationId !== own.id) return; if (own.canceled || !alive.current) void stardewCancel(profile, own.id).catch(() => {}); else setProgress(payload); });
   if (!alive.current || own.canceled) return;
   if (apply) {
    const value = action.kind === "recover" ? await stardewRecover(profile, path, own.id) : await stardewApply(profile, token.current, own.id);
    token.current = "";
    if (alive.current) { changed(value); setDone(true); }
   } else if (action.kind !== "recover") {
    const value = await stardewReview(profile, path, own.id, action);
    if (!alive.current || own.canceled) { void stardewDiscard(profile, value.token).catch(() => {}); return; }
    token.current = value.token; setReview(value);
   }
  } catch (e) { if (alive.current) { setError(stardewError(e)); if (apply) { token.current = ""; setReview(null); } } }
  finally { stop?.(); if (task.current === own) task.current = null; applying.current = false; if (alive.current) { setBusy(false); setCanceling(false); } }
 };
 useEffect(() => {
  let mounted = true; alive.current = true; root.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
  queueMicrotask(() => { if (mounted && action.kind !== "recover") void run(false); });
  const trap = (e: KeyboardEvent) => {
   if (e.key !== "Tab") return;
   const nodes = [...(root.current?.querySelectorAll<HTMLElement>("button:not(:disabled),summary") ?? [])].filter(n => n.getClientRects().length);
   if (!nodes.length) { e.preventDefault(); root.current?.focus(); }
   else if (e.shiftKey && document.activeElement === nodes[0]) { e.preventDefault(); nodes.at(-1)?.focus(); }
   else if (!e.shiftKey && document.activeElement === nodes.at(-1)) { e.preventDefault(); nodes[0].focus(); }
  };
  window.addEventListener("keydown", trap, true);
  return () => { mounted = false; alive.current = false; const own = task.current; if (own) { own.canceled = true; void stardewCancel(profile, own.id).catch(() => {}); } if (token.current) void stardewDiscard(profile, token.current).catch(() => {}); window.removeEventListener("keydown", trap, true); requestAnimationFrame(() => { if (!alive.current) (trigger?.isConnected ? trigger : fallback)?.focus({ preventScroll: true }); }); };
  // Each selection owns exactly one immutable review and restores its original trigger.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, []);
 const item = review?.after ?? review?.before;
 return <ModalShell closing={closing} onDismiss={close} labelledBy={id} width={560}><div className="games-stardew-review" ref={root} tabIndex={-1}>
  <header><h2 id={id}>{text(done ? "done" : action.kind === "recover" ? "recover" : "review")}</h2><button className="games-detail-text-button" aria-label={t("common.close")} disabled={busy && applying.current} onClick={close}><X size={20}/></button></header>
  <div className="games-stardew-review-body">
   {done ? <p className="games-stardew-working" role="status"><Check size={22}/>{text("doneNote")}</p> : <>
    {item && <div className="games-stardew-review-title"><h3 dir="auto">{item.title}</h3><p>{text(review!.action)} · {review?.before && review.after && review.before.version !== review.after.version ? `${review.before.version} → ${review.after.version}` : item.version}</p><code dir="ltr">{item.folder}</code></div>}
    {item?.origin && <div className="games-stardew-origin"><button className="games-detail-text-button" onClick={() => void openUrl(item.origin!.url)}>GitHub · Annosz/UIInfoSuite2<ArrowUpRight size={14}/></button><code dir="ltr">{item.origin.file}</code><details><summary>SHA-256<ChevronDown size={14}/></summary><code dir="ltr">{item.origin.sha256}</code></details></div>}
    <p>{text(action.kind === "recover" ? "recoveryNote" : review?.action === "remove" ? "removeNote" : "reviewNote")}</p>
    {review && <><p>{t("games.stardew.fileCount", { count: review.fileCount })}{review.bytes > 0 && ` · ${transferBytes(review.bytes)}`}</p>{!!review.files.length && <details><summary>{text("files")}<ChevronDown size={15}/></summary><ul>{review.files.map(file => <li key={file} dir="ltr">{file}</li>)}</ul>{review.fileCount > review.files.length && <p>{t("games.stardew.moreFiles", { count: review.fileCount - review.files.length })}</p>}</details>}
    {!!review.requirements.length && <div className="games-stardew-review-requirements"><h3>{text("requirements")}</h3>{review.requirements.map((r, i) => <p key={`${r.id}:${i}`}><span dir="auto">{r.id}{r.minimum ? ` ≥ ${r.minimum}` : ""}</span><span>{text(`requirement.${r.status}`)}</span></p>)}<p>{text("scope")}</p></div>}</>}
    {busy && <p className="games-stardew-working" role="status"><LoaderCircle size={19}/><span>{text(canceling ? "canceling" : applying.current ? "applying" : progress?.phase === "downloading" ? "downloading" : "preparing")}{progress?.phase === "downloading" && progress.current > 0 && <small> · {transferBytes(progress.current)}{progress.total > 0 ? ` / ${transferBytes(progress.total)}` : ""}</small>}</span></p>}
    {error && <p role="alert">{t(error)}</p>}
   </>}
  </div>
  <footer>{done ? <button className="games-button games-button-primary" onClick={close}>{t("common.done")}</button> : <><button className="games-button" disabled={canceling} onClick={() => busy && applying.current ? cancel() : close()}>{t("common.cancel")}</button><button className="games-button games-button-primary" disabled={busy} onClick={() => void run(Boolean(review) || action.kind === "recover")}>{text(action.kind === "recover" ? "recover" : review ? "apply" : "review")}</button></>}</footer>
 </div></ModalShell>;
}
