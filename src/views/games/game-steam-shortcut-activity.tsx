import { useEffect, useId, useMemo, useRef } from "react";
import { Trash2, X } from "lucide-react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useSectionBack } from "@/lib/section-back";
import { useT, useUiLanguage } from "@/lib/i18n";
import type { SteamShortcutsLibrary } from "@/hooks/use-steam-shortcuts";
import "./game-steam-shortcut-activity.css";

export function GameSteamShortcutActivity({ library, onClose }: { library: SteamShortcutsLibrary; onClose: () => void }) {
  const t = useT(), title = useId(), root = useRef<HTMLDivElement>(null), { closing, close } = useModalExit(onClose);
  const language = useUiLanguage(), today = new Date().toDateString();
  const dates = useMemo(() => ({
    time: new Intl.DateTimeFormat(language, { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    full: new Intl.DateTimeFormat(language, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  }), [language]);
  const { store, state } = library.activity;
  useSectionBack(close, true);
  useEffect(() => {
    const origin = document.activeElement as HTMLElement | null;
    root.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = [...root.current!.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled),[tabindex='0']")].filter(item => item.getClientRects().length);
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => { document.removeEventListener("keydown", trap); if (origin?.isConnected) origin.focus({ preventScroll: true }); };
  }, []);
  return <ModalShell closing={closing} onDismiss={close} labelledBy={title} width={700} backdropClassName="games-library-personal-backdrop">
    <div className="games-shortcut-activity" ref={root} inert={closing || undefined}>
      <header><div><h2 id={title}>{t("games.shortcuts.activity.title")}</h2><p>{t("games.shortcuts.activity.note")}</p></div><button className="games-icon-button" onClick={close} aria-label={t("common.close")}><X size={22}/></button></header>
      <div className="games-shortcut-activity-options">
        <label><span>{t("games.shortcuts.activity.remember")}</span><input type="checkbox" checked={state.remember} onChange={event => store.configure({ remember: event.target.checked })}/></label>
        <label><span>{t("games.shortcuts.activity.detailed")}</span><input type="checkbox" checked={state.detailed} onChange={event => store.configure({ detailed: event.target.checked })}/></label>
      </div>
      {state.storageError && <p className="games-shortcut-activity-error" role="alert">{t("games.shortcuts.activity.storageError")}</p>}
      <div className="games-shortcut-activity-scroll" tabIndex={0} role="region" aria-label={t("games.shortcuts.activity.title")}>
        {!state.entries.length ? <p className="games-shortcut-activity-empty">{t("games.shortcuts.activity.empty")}</p> : <ol>{state.entries.map(entry => <li key={entry.id} data-error={entry.kind === "error" || entry.kind === "scanError" || undefined}>
          <div className="games-shortcut-activity-line"><strong>{t(`games.shortcuts.activity.${entry.kind}`, { count: entry.count ?? 0, accounts: entry.accounts ?? 0, id: entry.accountId ?? "" })}</strong><time dateTime={new Date(entry.at).toISOString()} title={dates.full.format(entry.at)}>{(new Date(entry.at).toDateString() === today ? dates.time : dates.full).format(entry.at)}</time></div>
          {entry.name && <p dir="auto">{entry.name}</p>}
          {entry.accountId && entry.kind !== "account" && <small>{t("games.shortcuts.accountNumber", { id: entry.accountId })}</small>}
          {entry.code && <p>{t(entry.code)}</p>}
          {!!entry.warnings?.length && <p>{t("games.shortcuts.partial")}</p>}
          {state.detailed && <div className="games-shortcut-activity-detail">{entry.elapsed !== undefined && <small>{t("games.shortcuts.activity.duration", { ms: entry.elapsed })}</small>}{entry.root !== undefined && <small dir="auto">{entry.root || t("games.shortcuts.activity.defaultRoot")}</small>}{entry.warnings?.map(code => <code key={code}>{code}</code>)}</div>}
        </li>)}</ol>}
      </div>
      <footer><button className="games-button" disabled={!state.entries.length && !state.storageError} onClick={() => { if (store.clear()) root.current?.querySelector<HTMLElement>(".games-shortcut-activity-scroll")?.focus({ preventScroll: true }); }}><Trash2 size={18}/>{t("games.shortcuts.activity.clear")}</button></footer>
    </div>
  </ModalShell>;
}
