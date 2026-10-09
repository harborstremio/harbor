import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { SquarePen, X } from "lucide-react";
import { ModalShell } from "@/components/modal-shell";
import "./game-notes.css";
import type { GameGuide, GuideArticle } from "@/lib/games/guides-data";
const Notebook = lazy(() => import("./game-notes").then(module => ({ default: module.GameNotes })));
export type NotebookGuide = { item: GameGuide; article: GuideArticle };
export function GameNotesDialog(props: { profile: string; gameId: string; name: string; guide?: NotebookGuide; onClose: () => void }) {
  return <Suspense fallback={<GameNotesLoading name={props.name} onClose={props.onClose}/>}><Notebook {...props}/></Suspense>;
}
export function GameNotesIcon() { return <SquarePen size={23} strokeWidth={1.7} aria-hidden="true"/>; }
function GameNotesLoading({ name, onClose }: { name: string; onClose: () => void }) {
  const t = useT(), title = useId();
  return <ModalShell closing={false} onDismiss={onClose} width={960} labelledBy={title} backdropClassName="games-notes-backdrop"><div className="games-notes">
    <header><div><h2 id={title}>{t("games.notes.title")}</h2><p dir="auto">{name}</p></div><button autoFocus className="games-icon-button" aria-label={t("common.close")} onKeyDown={event => { if (event.key === "Tab") event.preventDefault(); }} onClick={onClose}><X size={21}/></button></header>
    <div className="games-notes-content" role="status" aria-label={t("common.loading")} aria-busy="true"><div className="games-notes-workspace games-notes-loading" aria-hidden="true"><aside><i/><i/><i/></aside><section className="games-notes-editor"><i/><i/><i/></section></div></div>
    <footer aria-hidden="true"><i className="games-notes-loading-footer"/></footer>
  </div></ModalShell>;
}
export function GameNotesButton({ profile, gameId, name, active = true, compact = false, guide }: { profile: string; gameId: string; name: string; active?: boolean; compact?: boolean; guide?: NotebookGuide }) {
  const t = useT(), [open, setOpen] = useState(false), trigger = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true })); };
  useEffect(() => setOpen(false), [profile, gameId, active]);
  return <><button ref={trigger} type="button" className={compact ? "games-detail-icon-action" : "games-button"} title={t("games.notes.title")} aria-label={t(guide ? "games.notes.importGuide" : "games.notes.title")} onClick={() => setOpen(true)}><GameNotesIcon/>{!compact && t(guide ? "games.notes.importGuide" : "games.notes.title")}</button>{open && active && <GameNotesDialog key={`${profile}:${gameId}`} profile={profile} gameId={gameId} name={name} guide={guide} onClose={close}/>}</>;
}
