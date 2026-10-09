import { useEffect, useId, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PackageOpen, X } from "lucide-react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useT } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import { preparationError, preparationDraft, type PreparationChoice, type PreparationForm } from "@/lib/games/download-preparation";
import type { GamePreparations } from "@/hooks/use-game-preparations";
import { GamePreparationOptions } from "./game-preparation-options";

export function PreparationStatus({ choice, saved, review }: { choice: PreparationChoice; saved: boolean; review: () => void }) {
  const t = useT();
  if (choice.status === "started") return null;
  return <div className={`games-preparation-summary${choice.status === "failed" ? " is-failed" : ""}`}>
    <PackageOpen size={15} aria-hidden/><span role="status">{t(`games.preparation.${saved ? choice.status : "saving"}`)}</span>
    <button className="games-text-action" onClick={review}>{t("games.preparation.review")}</button>
  </div>;
}

export function GamePreparationReview({ choice, saved, preparations, onClose }: { choice: PreparationChoice; saved: boolean; preparations: GamePreparations; onClose: () => void }) {
  const t = useT(), title = useId(), root = useRef<HTMLDivElement>(null), live = useRef(true), pending = useRef(false);
  const { closing, close } = useModalExit(onClose);
  const [form, setForm] = useState<PreparationForm>({ enabled: true, archive: choice.target.archive, parent: choice.parent, name: choice.name });
  const [busy, setBusy] = useState(false), [browsing, setBrowsing] = useState(false), [error, setError] = useState("");
  const options = [{ archive: choice.target.archive, members: choice.target.members, complete: true }];
  const draft = preparationDraft(form, options, choice.parent, choice.target.engine);
  const blocked = busy || browsing || closing, editable = saved && !["dispatching", "started"].includes(choice.status);
  useEffect(() => { if (error || choice.error || preparations.error) root.current?.querySelector('[role="alert"]')?.scrollIntoView({ block: "nearest" }); }, [error, choice.error, preparations.error]);
  useSectionBack(() => { if (!blocked) close(); }, true);
  useEffect(() => {
    live.current = true;
    const previous = document.activeElement as HTMLElement | null, dialog = root.current;
    dialog?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialog || (event.target as Element)?.closest?.('[data-dropdown-menu]') || [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].at(-1) !== dialog.closest('[role="dialog"]')) return;
      const items = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(item => item.getClientRects().length);
      const index = items.indexOf(document.activeElement as HTMLElement);
      if (items.length && (index < 0 || event.shiftKey && index === 0 || !event.shiftKey && index === items.length - 1)) { event.preventDefault(); (event.shiftKey ? items.at(-1) : items[0])?.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => { live.current = false; document.removeEventListener("keydown", trap); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  const act = async (disable: boolean) => {
    if (pending.current || blocked || !editable || !disable && !draft) return;
    pending.current = true; setBusy(true); setError("");
    try {
      if (disable) await invoke("games_disable_preparation", { profile: choice.target.profile, id: choice.id });
      else {
        const updated = await invoke<PreparationChoice>("games_set_preparation", { request: { target: choice.target, parent: draft!.parent, name: draft!.name } });
        if (live.current) preparations.accept(updated);
      }
      if (live.current) { await preparations.refresh(); close(); }
    } catch (reason) { if (live.current) setError(preparationError(reason)); }
    finally { pending.current = false; if (live.current) setBusy(false); }
  };
  return <ModalShell labelledBy={title} width={540} closing={closing} onDismiss={() => { if (!blocked) close(); }} backdropClassName="games-source-link-backdrop">
    <div ref={root} className="games-preparation-review"><header><h2 id={title}>{t("games.preparation.review")}</h2><button className="games-icon-button" disabled={blocked} aria-label={t("common.close")} onClick={close}><X size={19}/></button></header>
      <div className="games-preparation-review-body"><p role="status">{t(`games.preparation.${saved ? choice.status : "saving"}`)}</p><p>{t("games.preparation.note")}</p>
        <GamePreparationOptions alwaysEnabled value={form} change={setForm} options={options} parent={choice.parent} disabled={blocked || !editable} onBrowsing={setBrowsing}/>
        {(error || choice.error || preparations.error) && <p role="alert">{t(error || (choice.error ? preparationError(choice.error) : preparations.error))}</p>}
      </div><footer>{editable ? <><button className="games-button" disabled={blocked || choice.status === "disabled"} onClick={() => void act(true)}>{t("games.preparation.stop")}</button><button className="games-button games-button-primary" disabled={blocked || !draft} onClick={() => void act(false)}>{t(busy ? "common.loading" : "games.preparation.save")}</button></> : <><button className="games-button" disabled={blocked} onClick={close}>{t("common.close")}</button>{!saved && <button className="games-button games-button-primary" disabled={preparations.loading} onClick={() => void preparations.refresh()}>{t("common.retry")}</button>}</>}</footer>
    </div>
  </ModalShell>;
}
