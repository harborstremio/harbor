import { useEffect, useId, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { useSectionBack } from "@/lib/section-back";
import { osClass } from "@/lib/platform";
import { loadAtlasGame, queryIgdb } from "@/lib/games/atlas";
import { metadataImportRows, runMetadataImport, type MetadataImportResult } from "@/lib/games/automatic-metadata";
import { libraryMetadataTarget } from "@/lib/games/library-metadata-import";
import { artworkImportPolicy, reviewImportedArtwork } from "@/lib/games/imported-artwork";
import type { UnifiedLibraryGame } from "@/lib/games/unified-library";
import { LAUNCHER_NAMES } from "@/lib/games/launchers";
import type { GameSummary } from "@/lib/games/types";
import type { useGameAccess } from "./game-access";
import { GameMatch } from "./game-match";
import { GameArtworkPicker } from "./game-artwork-picker";
import "./game-library-metadata.css";

type Access = Pick<ReturnType<typeof useGameAccess>, "profile" | "libraryPreferences" | "customLibrary" | "emulation">;
export function GameLibraryMetadata({ items, selectedIds, access, onClose }: { items: UnifiedLibraryGame[]; selectedIds: string[]; access: Access; onClose: () => void }) {
  const t = useT(), title = useId(), { settings } = useSettings(), { closing, close } = useModalExit(onClose);
  const initial = useRef({ items, selectedIds: new Set(selectedIds), preferences: access.libraryPreferences.data });
  const current = useRef({ access, items }); current.current = { access, items };
  const root = useRef<HTMLDivElement>(null), controller = useRef<AbortController | null>(null), mounted = useRef(true);
  const [scope, setScope] = useState(selectedIds.length ? "selected" : "all");
  const [rows, setRows] = useState<MetadataImportResult[]>([]), held = useRef(rows);
  const [running, setRunning] = useState(false), [review, setReview] = useState<string | null>(null), [reviewError, setReviewError] = useState(false), [limit, setLimit] = useState(60);
  const desktop = osClass() === "windows" ? 6 : osClass() === "macos" ? 14 : osClass() === "linux" ? 3 : undefined;
  const targets = initial.current.items.filter(item => scope === "all" || initial.current.selectedIds.has(item.id)).map(item => libraryMetadataTarget(item, initial.current.preferences, desktop));
  const displayed = rows.length ? rows : metadataImportRows(targets);
  const policy = useRef(artworkImportPolicy(settings));
  const progress = (row: MetadataImportResult) => {
    held.current = held.current.map(previous => previous.id === row.id ? row : previous);
    if (mounted.current) setRows(held.current);
  };
  const save = async (id: string, game: GameSummary, signal: AbortSignal) => {
    const { access: live, items: available } = current.current, original = initial.current.items.find(item => item.id === id), item = available.find(item => item.id === id);
    if (signal.aborted || !mounted.current || live.profile !== access.profile || !original || !item || (original.originalName ?? original.name) !== (item.originalName ?? item.name)) return false;
    const quick = item.quick;
    if (quick?.source === "custom") return live.customLibrary.matchMissing(quick.custom.id, quick.custom.name, game, signal);
    if (quick?.source === "retro") return live.emulation.matchMissing(quick.local, game, signal);
    return live.libraryPreferences.updateMetadata(id, game, undefined, signal);
  };
  const start = async () => {
    if (controller.current) return;
    const abort = new AbortController(); controller.current = abort; setRunning(true);
    if (!held.current.length) { held.current = metadataImportRows(targets); setRows(held.current); policy.current = artworkImportPolicy(settings); }
    try { await runMetadataImport(targets, held.current, policy.current, abort.signal, { query: queryIgdb, detail: loadAtlasGame, save, progress }); }
    finally { controller.current = null; if (mounted.current) setRunning(false); }
  };
  const dismiss = () => { controller.current?.abort(); close(); };
  useSectionBack(dismiss, !review);
  useEffect(() => {
    mounted.current = true;
    const previous = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true }));
    const trap = (event: KeyboardEvent) => {
      const dialog = root.current?.closest('[role="dialog"]');
      if (event.key !== "Tab" || !root.current || [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].at(-1) !== dialog) return;
      const controls = [...root.current.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")].filter(button => button.getClientRects().length);
      if (!root.current.contains(document.activeElement) || event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); (event.shiftKey ? controls.at(-1) : controls[0])?.focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => { mounted.current = false; controller.current?.abort(); cancelAnimationFrame(frame); document.removeEventListener("keydown", trap); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  const reviewEntry = useRef<MetadataImportResult | null>(null);
  const row = review ? reviewEntry.current : null, target = targets.find(target => target.id === review), item = initial.current.items.find(item => item.id === review);
  const closeReview = () => { const id = review; setReview(null); setReviewError(false); requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(`[data-metadata-review="${CSS.escape(id ?? "")}"]`)?.focus({ preventScroll: true })); };
  const reviewed = async (game: GameSummary | null) => {
    if (!game || !review) return false;
    const abort = new AbortController(); controller.current = abort;
    try { const ok = await save(review, game, abort.signal); if (ok) progress({ id: review, state: "saved", game }); else setReviewError(true); return ok; }
    finally { controller.current = null; }
  };
  const canRun = displayed.some(row => row.state === "pending" || row.state === "failed");
  const processed = displayed.filter(row => !["pending", "searching"].includes(row.state)).length;
  const sourceName = (item: UnifiedLibraryGame) => item.source === "steam" ? "Steam" : item.source === "shortcut" ? t("games.dock.shortcut") : item.source in LAUNCHER_NAMES ? LAUNCHER_NAMES[item.source as keyof typeof LAUNCHER_NAMES] : t(item.source === "custom" ? "games.custom.nav" : "games.emulation.library");
  const done = displayed.filter(row => row.state === "saved").length;
  return <><ModalShell closing={closing} onDismiss={dismiss} labelledBy={title} width={740} backdropClassName="games-library-personal-backdrop"><div className="games-metadata-import" ref={root}>
    <header><div><h2 id={title}>{t("games.metadataImport.title")}</h2><p>{t("games.metadataImport.note")}</p></div><button className="games-icon-button" aria-label={t("common.close")} onClick={dismiss}><X size={22}/></button></header>
    <div className="games-metadata-import-scroll">
      <div className="games-metadata-import-scope" role="group" aria-label={t("games.metadataImport.scope")}><button disabled={!!rows.length} aria-pressed={scope === "all"} onClick={() => setScope("all")}>{t("games.sidebar.allGames")} · {initial.current.items.length}</button>{!!selectedIds.length && <button disabled={!!rows.length} aria-pressed={scope === "selected"} onClick={() => setScope("selected")}>{t("games.selection.count", { count: selectedIds.length })}</button>}</div>
      <div className="games-metadata-import-progress" role="status"><span>{t("games.metadataImport.progress", { count: processed, total: displayed.length })}</span><strong>{t("games.metadataImport.savedCount", { count: done })}</strong></div>
      <progress max={Math.max(1, displayed.length)} value={processed} aria-label={t("games.metadataImport.title")}/>
      <div className="games-metadata-import-rows">{displayed.slice(0, limit).map(result => { const game = initial.current.items.find(item => item.id === result.id)!; return <div key={result.id} className="games-metadata-import-row" data-state={result.state}><span className="games-metadata-import-mark">{result.state === "saved" || result.state === "skipped" ? <Check size={19}/> : <Search size={19}/>}</span><div><strong dir="auto">{game.name}</strong><span>{sourceName(game)} · {t(`games.metadataImport.${result.reason ?? result.state}`)}</span></div>{["review", "failed"].includes(result.state) && <button className="games-button" disabled={running} data-metadata-review={result.id} onClick={() => { reviewEntry.current = result; setReview(result.id); setReviewError(false); }}>{t("games.metadataImport.reviewAction")}</button>}</div>; })}</div>
      {displayed.length > limit && <button className="games-button" onClick={() => setLimit(value => value + 60)}>{t("games.library.showMore")}</button>}
      <p className="games-metadata-import-footnote">{t("games.metadataImport.stopNote")}</p>
    </div><footer><button className="games-button" onClick={dismiss}>{t("common.done")}</button>{running ? <button className="games-button games-button-primary" onClick={() => controller.current?.abort()}>{t("games.metadataImport.stop")}</button> : <button className="games-button games-button-primary" disabled={!canRun || !access.libraryPreferences.ready || access.libraryPreferences.busy} onClick={() => void start()}>{t(rows.length ? "games.metadataImport.resume" : "games.metadataImport.start")}</button>}</footer>
  </div></ModalShell>
  {row && target && item && (row.reason === "artwork" && row.game?.importedArtwork ? <GameArtworkPicker game={row.game} binding={`igdb:${row.game.igdbId}`} screenshots={policy.current.screenshots} allowReset={false} localCover={!!access.libraryPreferences.get(item.id).cover || !!(item.quick?.source === "custom" && item.quick.custom.artwork)} error={reviewError ? "games.metadataImport.failed" : undefined} onSave={choice => reviewed({ ...row.game!, importedArtwork: reviewImportedArtwork(row.game!.importedArtwork!, choice) })} onClose={closeReview}/> : <GameMatch game={{ path: item.id, name: target.request.name, system: item.quick?.source === "retro" ? item.quick.local.system : 0 }} platform={desktop && item.quick?.source !== "retro" ? { id: desktop, name: desktop === 6 ? "Windows" : desktop === 14 ? "macOS" : "Linux", short: "PC" } : undefined} metadataOnly error={reviewError ? "games.metadataImport.failed" : undefined} localCover={!!access.libraryPreferences.get(item.id).cover || !!(item.quick?.source === "custom" && item.quick.custom.artwork)} onMatch={reviewed} onClose={closeReview}/>)}
  </>;
}
