import { useEffect } from "react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { aiKey, modelLabelFor, providerForModel } from "@/lib/ai-models";
import { AiResultList } from "./ai-search/ai-result-list";
import { useAiSuggest } from "./ai-search/use-ai-suggest";
import { AiThinking } from "./ai-search/ai-thinking";
import { AiPicksHeader } from "./ai-search/ai-picks-header";

export function AiSearchSection({
  query,
  aiMode = false,
  onClose,
  onActive,
  runSignal,
}: {
  query: string;
  aiMode?: boolean;
  onClose: () => void;
  onActive?: (active: boolean) => void;
  runSignal?: number;
}) {
  const { settings } = useSettings();
  const t = useT();
  const { status, results, error, ranQuery, run } = useAiSuggest(query, runSignal);
  const provider = providerForModel(settings.aiSearchModel);
  const hasKey = !!aiKey(settings).trim();

  const active =
    status === "loading" || (status === "done" && ranQuery === query && results.length > 0);
  useEffect(() => {
    onActive?.(active);
    return () => onActive?.(false);
  }, [active, onActive]);

  useEffect(() => {
    if (!aiMode || !hasKey || status !== "idle") return;
    const q = query.trim();
    if (q.length < 6) return;
    const id = window.setTimeout(() => void run(), 1600);
    return () => window.clearTimeout(id);
  }, [aiMode, hasKey, status, query]);

  if (!query.trim()) return null;
  if (!hasKey) {
    if (!aiMode) return null;
    return (
      <div className="mb-8">
        <div className="animate-ai-entrance rounded-2xl border border-edge-soft bg-elevated/30 px-5 py-4 text-[13px] leading-relaxed text-ink-muted">
          {settings.aiSearchProvider === "groq"
            ? t("Add your Groq API key in Settings, AI search to use this model.")
            : t("Add your OpenRouter API key in Settings, AI search to use this model.")}
        </div>
      </div>
    );
  }

  const label = modelLabelFor(settings.aiSearchModel);
  const shortQ = query.trim().length > 26 ? `${query.trim().slice(0, 25)}…` : query.trim();
  const thinkingPhrases = [
    t("Reading your search"),
    t('Looking for "{q}"', { q: shortQ }),
    t("Scanning the catalog"),
    t("Cross-referencing titles and episodes"),
    t("Checking plots, cast, and scenes"),
    t("Matching the details"),
    t("Ranking the best matches"),
    t("Pulling posters and ratings"),
    t("Almost there"),
  ];

  return (
    <div className="mb-8">
      {status === "idle" && aiMode && (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <span className="ai-text-shimmer text-[17px] font-medium tracking-tight">
            {t("Searches when you stop typing")}
          </span>
          <span className="flex items-center gap-1.5 text-[12.5px] text-ink-subtle">
            <kbd className="rounded-md border border-edge-soft bg-canvas/60 px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
              Enter
            </kbd>
            {t("to search now")}
          </span>
        </div>
      )}

      {status === "loading" && (
        <AiThinking provider={provider} label={label} phrases={thinkingPhrases} />
      )}

      {status === "error" && (
        <button
          onClick={run}
          className="animate-ai-entrance flex w-full flex-col gap-1 rounded-2xl border border-danger/40 bg-danger/10 px-5 py-3 text-start transition-colors hover:bg-danger/15"
        >
          <span className="text-[13px] font-semibold text-ink">
            {t("AI search failed. Tap to retry.")}
          </span>
          <span className="line-clamp-2 text-[12px] text-ink-muted">{error}</span>
        </button>
      )}

      {status === "done" &&
        ranQuery === query &&
        (results.length > 0 ? (
          <div>
            <AiPicksHeader provider={provider} label={label} count={results.length} />
            <AiResultList results={results} onClose={onClose} />
          </div>
        ) : (
          <div className="animate-ai-entrance rounded-2xl border border-edge-soft bg-elevated/30 px-5 py-4 text-[13px] text-ink-muted">
            {t("AI didn't find anything for that. Try rephrasing.")}
          </div>
        ))}
    </div>
  );
}
