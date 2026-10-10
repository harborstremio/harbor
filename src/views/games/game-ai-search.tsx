import { useEffect, useRef, useState } from "react";
import { Globe, Search, Settings2, X } from "lucide-react";
import { useSettings } from "@/lib/settings";
import { useT, useUiLanguage } from "@/lib/i18n";
import { AiSearchError, type AiErrorDescriptor } from "@/lib/ai-search";
import { aiKey, aiIsGroq, AI_MODELS, GROQ_MODELS, DEFAULT_AI_MODEL, modelLabelFor, providerTabFor } from "@/lib/ai-models";
import { pruneToCatalog, useGroqCatalog, useOpenRouterCatalog } from "@/lib/ai-live-models";
import { Dropdown } from "@/components/dropdown";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useSectionBack } from "@/lib/section-back";
import { AiSearchSection } from "@/views/settings/ai-search-section";
import { findGamesWithAi, type GameSearchMatch } from "@/lib/games/ai-search";
import type { CatalogFilters } from "@/lib/games/catalog-filters";
import type { GameSummary } from "@/lib/games/types";
import { GameSearchResults } from "./game-search-results";

function AiSettings({ onClose }: { onClose: () => void }) {
  const t = useT(), { closing, close } = useModalExit(onClose), root = useRef<HTMLDivElement>(null);
  useSectionBack(close, true);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    root.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const nodes = [...root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,a[href],[tabindex="0"]') ?? []].filter(el => el.getClientRects().length);
      if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0]?.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => { document.removeEventListener("keydown", trap); previous?.focus({ preventScroll: true }); };
  }, []);
  return <ModalShell width={780} closing={closing} onDismiss={close} labelledBy="games-ai-settings-title"><div ref={root} className="games-ai-settings"><header><h2 id="games-ai-settings-title">{t("AI search")}</h2><button aria-label={t("common.close")} onClick={close}><X size={22}/></button></header><div><AiSearchSection/></div></div></ModalShell>;
}

export function GameAiSearch({ query, filters, active, runSignal, open, onResults, resultView = "grid" }: { query: string; filters: CatalogFilters; active: boolean; runSignal: number; open: (game: GameSummary) => void; onResults: (games: GameSummary[]) => void; resultView?: "grid" | "rows" }) {
  const t = useT(), language = useUiLanguage(), { settings, update } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false), [status, setStatus] = useState<"idle"|"loading"|"done"|"error">("idle");
  const [results, setResults] = useState<GameSearchMatch[]>([]), [error, setError] = useState<AiErrorDescriptor|null>(null);
  useEffect(() => { onResults(results.map(result => result.game)); }, [results, onResults]);
  const request = useRef<AbortController|null>(null), lastSignal = useRef(runSignal);
  const key = aiKey(settings), groq = aiIsGroq(settings), model = settings.aiSearchModel || (groq ? GROQ_MODELS[0].id : DEFAULT_AI_MODEL);
  const orCatalog = useOpenRouterCatalog(), groqCatalog = useGroqCatalog(settings.aiGroqKey);
  const models = [...(settings.aiGroqKey.trim() ? pruneToCatalog(GROQ_MODELS, groqCatalog) : []), ...pruneToCatalog(AI_MODELS, orCatalog)];
  if (!models.some(item => item.id === model)) models.push({ id: model, label: modelLabelFor(model) || model, provider: groq ? "groq" : "openai" });
  const fingerprint = JSON.stringify([query, filters, model, key, settings.aiWebSearch, language]);
  useEffect(() => { request.current?.abort(); request.current = null; setStatus("idle"); setResults([]); setError(null); }, [fingerprint]);
  useEffect(() => { if (!active) { request.current?.abort(); request.current = null; setSettingsOpen(false); setStatus(value => value === "loading" ? "idle" : value); } }, [active]);
  useEffect(() => () => { request.current?.abort(); request.current = null; }, []);
  const run = async () => {
    if (!active || !query.trim() || !key.trim()) return;
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    const timeout = window.setTimeout(() => controller.abort(new Error("timeout")), 60000);
    setStatus("loading"); setResults([]); setError(null);
    try {
      let context: string | undefined;
      if (settings.aiWebSearch) {
        try { const { enrichWithContent } = await import("@/lib/jina-search"); context = (await enrichWithContent(`${query.trim()} video games Steam`, settings.jinaKey)).context; } catch { /* The configured model can still search without web context. */ }
      }
      controller.signal.throwIfAborted();
      const matches = await findGamesWithAi({ key, model, groq, query, filters, language, context, signal: controller.signal });
      if (request.current === controller && !controller.signal.aborted) { setResults(matches); setStatus("done"); }
    } catch (cause) {
      if (request.current === controller && (!controller.signal.aborted || controller.signal.reason?.message === "timeout")) { setError(cause instanceof AiSearchError ? { messageKey: cause.messageKey, values: cause.values } : { messageKey: "AI search failed." }); setStatus("error"); }
    } finally { clearTimeout(timeout); }
  };
  useEffect(() => { if (runSignal !== lastSignal.current) { lastSignal.current = runSignal; void run(); } }, [runSignal]);
  return <div className="games-ai-search">
    <div className="games-ai-options"><label><span>{t("AI model")}</span><Dropdown value={model} onChange={id => update({ aiSearchModel: id, aiSearchProvider: providerTabFor(id) })} ariaLabel={t("AI model")} options={models.map(item => ({ value: item.id, label: item.label }))}/></label><button aria-pressed={settings.aiWebSearch} onClick={() => update({ aiWebSearch: !settings.aiWebSearch })}><Globe size={18}/>{t("games.searchUi.web")}</button><button onClick={() => setSettingsOpen(true)}><Settings2 size={18}/>{t("games.searchUi.settings")}</button></div>
    {!key.trim() ? <div className="games-ai-message"><h3>{t("games.searchUi.setup")}</h3><p>{t("games.searchUi.setupNote")}</p><button className="games-button" onClick={() => setSettingsOpen(true)}>{t("games.searchUi.settings")}</button></div> : status === "idle" ? <p className="games-ai-hint">{t("games.searchUi.aiHint")}</p> : null}
    {status === "loading" && <><div className="games-ai-status" role="status"><span className="games-search-spinner"/>{t("games.searchUi.thinking")}<button onClick={() => { request.current?.abort(); request.current = null; setStatus("idle"); }}>{t("common.cancel")}</button></div><div className="games-grid" aria-busy="true">{[0,1,2,3].map(index => <div className="games-card-skeleton" key={index}/>)}</div></>}
    {status === "error" && <div className="games-catalog-error" role="alert"><p>{t(error?.messageKey ?? "AI search failed.", error?.values)}</p><button className="games-button" onClick={() => void run()}>{t("common.retry")}</button></div>}
    {status === "done" && <><p className="games-ai-hint" role="status">{t("games.searchUi.verified", { count: results.length })}</p>{results.length ? <GameSearchResults view={resultView} games={results.map(item => item.game)} active={active} open={open} reasons={Object.fromEntries(results.map(item => [item.game.id, item.reason]))}/> : <div className="games-state"><Search size={28}/><h3>{t("games.noResults")}</h3><p>{t("games.searchUi.noAiResults")}</p></div>}</>}
    {settingsOpen && <AiSettings onClose={() => setSettingsOpen(false)}/>}
  </div>;
}
