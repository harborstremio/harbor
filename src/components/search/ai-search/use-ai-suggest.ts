import { useEffect, useRef, useState } from "react";
import {
  AiSearchError,
  aiSuggest,
  resolveAiSuggestions,
  type AiErrorDescriptor,
  type AiResult,
} from "@/lib/ai-search";
import { useSettings } from "@/lib/settings";
import { aiIsGroq, aiKey } from "@/lib/ai-models";
import { enrichWithContent } from "@/lib/jina-search";

export type AiStatus = "idle" | "loading" | "done" | "error";

export function useAiSuggest(query: string, runSignal = 0) {
  const { settings } = useSettings();
  const [status, setStatus] = useState<AiStatus>("idle");
  const [results, setResults] = useState<AiResult[]>([]);
  const [error, setError] = useState<AiErrorDescriptor | null>(null);
  const [ranQuery, setRanQuery] = useState("");
  const reqRef = useRef(0);

  useEffect(() => {
    reqRef.current += 1;
    setStatus("idle");
    setResults([]);
    setError(null);
    setRanQuery("");
  }, [query]);

  const activeKey = aiKey(settings);

  useEffect(() => {
    if (!runSignal || !query.trim() || !activeKey.trim()) return;
    void run();
  }, [runSignal]);

  const run = async () => {
    const id = ++reqRef.current;
    setStatus("loading");
    setError(null);
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
      const suggestions = await aiSuggest(
        activeKey,
        settings.aiSearchModel,
        aiIsGroq(settings),
        query,
        webContext,
      );
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
      if (e instanceof AiSearchError) {
        setError({
          messageKey: e.messageKey,
          ...(e.values ? { values: e.values } : {}),
          ...(e.detail ? { detail: e.detail } : {}),
        });
      } else {
        const detail = e instanceof Error ? e.message : typeof e === "string" ? e : undefined;
        setError({
          messageKey: "AI search failed.",
          ...(detail ? { detail } : {}),
        });
      }
      setStatus("error");
    }
  };

  return { status, results, error, ranQuery, run };
}
