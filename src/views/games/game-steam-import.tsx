import { useEffect, useId, useRef, useState } from "react";
import { FileUp, X } from "lucide-react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useT } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import { loadSteamImportSummary } from "@/lib/games/catalog";
import { initialSteamImportRows, parseSteamImportProfile, parseSteamImportText, reviewSteamImports, steamImportSummary, STEAM_PROFILE_BYTES, type SteamImportCandidate, type SteamImportRow } from "@/lib/games/steam-import";
import type { SteamImportLibrary } from "@/hooks/use-steam-imports";
import "./game-steam-import.css";

export function GameSteamImport({ library, existing, onClose }: { library: SteamImportLibrary; existing: Set<number>; onClose: () => void }) {
  const t = useT(), title = useId(), inputId = useId(), root = useRef<HTMLDivElement>(null), scroll = useRef<HTMLDivElement>(null), more = useRef<HTMLButtonElement>(null), file = useRef<HTMLInputElement>(null);
  const { closing, close } = useModalExit(onClose), controller = useRef<AbortController | null>(null), pending = useRef(false), live = useRef(true), known = useRef(existing); known.current = existing;
  const [text, setText] = useState(""), [rows, setRows] = useState<SteamImportRow[] | null>(null), [selected, setSelected] = useState<Set<number>>(new Set()), [busy, setBusy] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState(""), [done, setDone] = useState<number | null>(null), [limit, setLimit] = useState(50);
  const [ignoreOpen, setIgnoreOpen] = useState(false), [ignoreText, setIgnoreText] = useState(""), [ignoreSaved, setIgnoreSaved] = useState(false), ignoreBase = useRef<number[]>([]), ignoreId = useId();
  const dismiss = () => { if (saving) return; controller.current?.abort(); close(); }; useSectionBack(dismiss, true);
  useEffect(() => {
    live.current = true; const origin = document.activeElement as HTMLElement | null;
    root.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const targets = [...root.current!.querySelectorAll<HTMLElement>('button:not(:disabled),textarea:not(:disabled),input:not(:disabled):not([type=file])')].filter(item => item.getClientRects().length);
      if (event.shiftKey && (document.activeElement === targets[0] || !root.current?.contains(document.activeElement))) { event.preventDefault(); targets.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === targets.at(-1)) { event.preventDefault(); targets[0]?.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => { live.current = false; controller.current?.abort(); document.removeEventListener("keydown", trap); if (origin?.isConnected) origin.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => {
    // Replacing the input or progress footer must not leave keyboard focus behind the dialog.
    if (root.current && (!root.current.contains(document.activeElement) || (document.activeElement as HTMLButtonElement | null)?.disabled)) root.current.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
  }, [!!rows, busy, saving, done !== null]);
  useEffect(() => {
    if (!more.current || !scroll.current) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) setLimit(value => value + 50); }, { root: scroll.current, rootMargin: "120px" });
    observer.observe(more.current); return () => observer.disconnect();
  }, [rows?.length, limit]);
  const fail = (reason: unknown) => setError(reason instanceof Error && reason.message === "steam_import_limit" ? "games.steamImport.limit" : "games.steamImport.inputError");
  const review = async (items: SteamImportCandidate[], abort: AbortController) => {
    const excluded = new Set(library.data.excluded ?? []), initial = initialSteamImportRows(items, known.current, excluded);
    setRows(initial); setSelected(new Set(initial.filter(row => row.state === "ready").map(row => row.appId!))); setError(""); setDone(null); setLimit(50);
    try { await reviewSteamImports(items, known.current, loadSteamImportSummary, abort.signal, (index, row) => {
      if (!live.current || abort.signal.aborted) return;
      setRows(previous => previous!.map((item, i) => i === index ? row : item));
      if (row.state === "ready") setSelected(previous => new Set([...previous, row.appId!]));
    }, undefined, excluded); } catch (reason) { if (!abort.signal.aborted && live.current) fail(reason); }
  };
  const start = async (profile?: File) => {
    if (pending.current || !library.ready) return;
    pending.current = true; setBusy(true); setError(""); const abort = new AbortController(); controller.current = abort;
    try {
      if (profile && profile.size > STEAM_PROFILE_BYTES) throw Error("steam_import_limit");
      const value = profile ? await profile.text() : text; abort.signal.throwIfAborted();
      await review(profile ? parseSteamImportProfile(value) : parseSteamImportText(value), abort);
    } catch (reason) { if (!abort.signal.aborted && live.current) fail(reason); }
    finally { if (live.current && controller.current === abort) { pending.current = false; setBusy(false); } }
  };
  const add = async () => {
    if (pending.current || !rows) return; pending.current = true; setSaving(true); setError("");
    const abort = new AbortController(); controller.current = abort;
    try {
      const games = rows.filter(row => selected.has(row.appId!) && !row.issue && ["ready", "unavailable"].includes(row.state) && !known.current.has(row.appId!)).map(row => ({ game: row.game ?? steamImportSummary(row.appId!, t("games.steamImport.unknown", { id: row.appId! })), origin: row.origin ?? "manual" as const, addedAt: Date.now() }));
      const count = await library.update(games, [], abort.signal); if (live.current) setDone(count);
    } catch (reason) { if (live.current && !abort.signal.aborted) setError(reason instanceof Error && reason.message === "steam_import_limit" ? "games.steamImport.limit" : "games.steamImport.writeError"); }
    finally { if (live.current) { pending.current = false; setSaving(false); } }
  };
  const toggle = (id: number) => setSelected(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const saveIgnored = async () => {
    if (pending.current) return; pending.current = true; setSaving(true); setError(""); setIgnoreSaved(false);
    const abort = new AbortController(); controller.current = abort;
    try {
      const items = ignoreText.trim() ? parseSteamImportText(ignoreText) : [];
      if (items.some(item => item.issue && item.issue !== "duplicate")) throw Error("steam_import_record");
      const ids = new Set(items.flatMap(item => item.appId ? [item.appId] : [])), previous = new Set(ignoreBase.current);
      await library.update([], [], abort.signal, { add: [...ids].filter(id => !previous.has(id)), remove: [...previous].filter(id => !ids.has(id)) });
      if (live.current) { ignoreBase.current = [...ids]; setIgnoreSaved(true); setIgnoreOpen(false); }
    } catch (reason) { if (live.current && !abort.signal.aborted) setError(reason instanceof Error && reason.message === "steam_import_record" ? "games.steamImport.inputError" : "games.steamImport.writeError"); }
    finally { if (live.current) { pending.current = false; setSaving(false); } }
  };
  return <ModalShell closing={closing} onDismiss={dismiss} labelledBy={title} width={680} backdropClassName="games-steam-import-backdrop" dismissOnBackdrop={false}><div className="games-steam-import" ref={root}>
    <header><h2 id={title}>{t("games.steamImport.title")}</h2><button className="games-icon-button" aria-label={t("common.close")} disabled={saving} onClick={dismiss}><X size={22}/></button></header>
    <p className="games-steam-import-note">{t("games.steamImport.note")}</p>
    <div className="games-steam-import-scroll" ref={scroll}>
      {!rows ? <><label htmlFor={inputId}>{t("games.steamImport.input")}</label><textarea id={inputId} value={text} onChange={event => setText(event.target.value)} disabled={busy || saving} placeholder="730, 570, https://store.steampowered.com/app/281990/" maxLength={256 * 1024} spellCheck={false} dir="ltr"/><button className="games-button" disabled={busy || saving || ignoreOpen} onClick={() => file.current?.click()}><FileUp size={18}/>{t("games.steamImport.profile")}</button><input ref={file} type="file" accept=".profile,.xml" hidden onChange={event => { const selected = event.target.files?.[0]; event.target.value = ""; if (selected) void start(selected); }}/>
        <div className="games-steam-import-ignore"><button disabled={busy || saving} aria-expanded={ignoreOpen} onClick={() => { if (!ignoreOpen) { ignoreBase.current = [...library.data.excluded ?? []]; setIgnoreText(ignoreBase.current.join(", ")); setIgnoreSaved(false); } setIgnoreOpen(value => !value); }}>{t("games.steamImport.ignoreSettings", { count: library.data.excluded?.length ?? 0 })}</button>
          {ignoreOpen && <><label htmlFor={ignoreId}>{t("games.steamImport.ignoreLabel")}</label><p className="games-steam-import-note">{t("games.steamImport.ignoreNote")}</p><textarea id={ignoreId} value={ignoreText} onChange={event => setIgnoreText(event.target.value)} disabled={saving} maxLength={256 * 1024} dir="ltr"/><button className="games-button" disabled={saving || !library.ready} onClick={() => void saveIgnored()}>{t("games.steamImport.ignoreSave")}</button></>}
          {ignoreSaved && <p role="status" className="games-steam-import-success">{t("games.steamImport.ignoreSaved")}</p>}
        </div></> : <>
        <p className="games-steam-import-count" role="status">{t("games.steamImport.count", { selected: selected.size, total: rows.length })}{busy && ` · ${t("common.loading")}`}</p>
        <p className="games-steam-import-note">{t("games.steamImport.unavailableNote")}</p>
        <div className="games-steam-import-rows">{rows.slice(0, limit).map((row, index) => <label className="games-steam-import-row" key={index} data-import-state={row.state}>
          <input type="checkbox" disabled={busy || saving || done !== null || !["ready", "unavailable"].includes(row.state)} checked={!row.issue && selected.has(row.appId!)} onChange={() => toggle(row.appId!)} aria-label={row.game?.name ?? (row.appId ? t("games.steamImport.unknown", { id: row.appId }) : row.input)}/>
          <span><strong title={row.game?.name ?? row.input} dir="auto">{row.game?.name ?? (row.appId ? t("games.steamImport.unknown", { id: row.appId }) : row.input)}</strong><small>{row.appId ? `Steam · ${row.appId} · ` : ""}{t(`games.steamImport.${row.state === "ready" ? row.origin === "profile" ? "profileName" : "ready" : row.state}`)}</small></span>
        </label>)}</div>
        {limit < rows.length && <button className="games-button" ref={more} onClick={() => setLimit(value => value + 50)}>{t("games.library.showMore")}</button>}
      </>}
      {error && <p className="games-steam-import-error" role="alert">{t(error)}</p>}
      {done !== null && <p className="games-steam-import-success" role="status">{t("games.steamImport.done", { count: done })}</p>}
    </div>
    <footer>{done !== null ? <button className="games-button games-button-primary" onClick={dismiss}>{t("common.done")}</button> : busy ? <button className="games-button" onClick={() => controller.current?.abort()}>{t("games.steamImport.stop")}</button> : rows ? <><button className="games-button" disabled={saving} onClick={() => { setRows(null); setError(""); }}>{t("games.steamImport.restart")}</button><button className="games-button games-button-primary" disabled={saving || !selected.size || !library.ready} onClick={() => void add()}>{t(saving ? "common.loading" : "games.steamImport.add", { count: selected.size })}</button></> : <button className="games-button games-button-primary" disabled={!text.trim() || !library.ready || saving || ignoreOpen} onClick={() => void start()}>{t("games.steamImport.review")}</button>}</footer>
  </div></ModalShell>;
}
