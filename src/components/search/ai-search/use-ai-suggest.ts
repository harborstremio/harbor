import { keyForProvider, providerForModel } from "@/lib/ai-models";
import { aiSuggest, resolveAiSuggestions, type AiResult } from "@/lib/ai-search";
import { useT } from "@/lib/i18n";
import { enrichWithContent } from "@/lib/jina-search";
import { useSettings } from "@/lib/settings";
import { useEffect, useRef, useState } from "react";

export type AiStatus = "idle" | "loading" | "done" | "error";

export function useAiSuggest(query: string, runSignal = 0) {
  const { settings } = useSettings();
  const t = useT();
  const [status, setStatus] = useState<AiStatus>("idle");
  const [results, setResults] = useState<AiResult[]>([]);
  const [error, setError] = useState("");
  const [ranQuery, setRanQuery] = useState("");
  const reqRef = useRef(0);

  useEffect(() => {
    reqRef.current += 1;
    setStatus("idle");
    setResults([]);
    setError("");
    setRanQuery("");
  }, [query]);

  const provider = providerForModel(settings.aiSearchModel);
  const activeKey = keyForProvider(settings, provider);

  useEffect(() => {
    if (!runSignal || !query.trim() || !activeKey.trim()) return;
    void run();
  }, [runSignal]);

  const run = async () => {
    const id = ++reqRef.current;
    setStatus("loading");
    setError("");
    setRanQuery(query);
    try {
      let webContext: string | undefined;
      if (settings.aiWebSearch) {
        try {
          const { context } = await enrichWithContent(query, settings.jinaKey);
          webContext = context || undefined;
        } catch {
          webContext = undefined;
        }
      }
      const suggestions = await aiSuggest(activeKey, settings.aiSearchModel, query, webContext);
      if (id !== reqRef.current) return;
      if (suggestions.length === 0) {
        setResults([]);
        setStatus("done");
        return;
      }
      const metas = await resolveAiSuggestions(suggestions);
      if (id !== reqRef.current) return;
      setResults(metas);
      setStatus("done");
    } catch (e) {
      if (id !== reqRef.current) return;
      setError(e instanceof Error ? e.message : t("Something went wrong."));
      setStatus("error");
    }
  };

  return { status, results, error, ranQuery, run };
}
