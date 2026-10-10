import { useEffect, useRef, useState } from "react";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { useT } from "@/lib/i18n";
import {
  callGeminiApi,
  callOpenAiCompatibleChatApi,
  listGeminiModels,
  planChatResearch,
  type ChatMessage,
} from "@/lib/ai-chat";
import { resolveChatRecommendations } from "@/lib/ai-chat-catalog";
import {
  GEMINI_MODELS,
  DEFAULT_GEMINI_CHAT_MODEL,
  isSupportedGeminiChatModel,
  buildChatMediaContext,
  type ModelOption,
} from "@/lib/ai-chat-models";
import { AI_MODELS, DEFAULT_AI_MODEL, GROQ_MODELS } from "@/lib/ai-models";
import { useOpenRouterCatalog, useGroqCatalog, pruneToCatalog } from "@/lib/ai-live-models";
import {
  researchChat,
  isChatSearchProvider,
  type ChatSearchProvider,
} from "@/lib/ai-chat-research";
import { buildChatHistory } from "@/lib/ai-chat-prompts";

export type ChatAiProvider = "gemini" | "openrouter" | "groq";

type ChatModelOption = ModelOption & { provider: ChatAiProvider };

const CHAT_PROVIDER_KEY = "harbor.chat.ai-provider";
const CHAT_MODEL_KEY = "harbor.chat.ai-model";

function readChatProvider(): ChatAiProvider {
  try {
    const value = localStorage.getItem(CHAT_PROVIDER_KEY);
    return value === "openrouter" || value === "groq" ? value : "gemini";
  } catch {
    return "gemini";
  }
}

function readChatModel(): string {
  try {
    return localStorage.getItem(CHAT_MODEL_KEY) ?? "";
  } catch {
    return "";
  }
}

function persistChatSelection(provider: ChatAiProvider, model: string): void {
  try {
    localStorage.setItem(CHAT_PROVIDER_KEY, provider);
    localStorage.setItem(CHAT_MODEL_KEY, model);
  } catch {
    // Chat model selection is best-effort; the in-memory selection still applies.
  }
}

export function useChat(onMissingKey: () => void) {
  const { settings } = useSettings();
  const { meta: currentMeta } = useView();
  const t = useT();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>("");
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [searchProvider, setSearchProvider] = useState<ChatSearchProvider>(() => {
    try {
      const stored = localStorage.getItem("harbor.chat.search-provider");
      return isChatSearchProvider(stored) ? stored : "auto";
    } catch {
      return "auto";
    }
  });
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => requestRef.current?.abort(), []);
  useEffect(() => {
    try {
      localStorage.setItem("harbor.chat.search-provider", searchProvider);
    } catch {
      /* In-memory choice still works. */
    }
  }, [searchProvider]);
  const [aiSessionUsage, setAiSessionUsage] = useState<{
    requests: number;
    tokens: number;
  } | null>(null);
  const [tavilyLastSearchCredits, setTavilyLastSearchCredits] = useState<number | null>(null);
  const [tavilySessionCredits, setTavilySessionCredits] = useState(0);

  // The assistant keeps its own provider/model selection so AI search keeps
  // working exactly as before. Keys still live in Settings.
  const [chatProvider, setChatProvider] = useState<ChatAiProvider>(() => readChatProvider());
  const [chatModel, setChatModel] = useState<string>(() => readChatModel());
  const geminiKey = settings.geminiApiKey?.trim() ?? "";
  const openrouterKey = settings.aiSearchKey?.trim() ?? "";
  const groqKey = settings.aiGroqKey?.trim() ?? "";
  const tavilyKey = settings.tavilyApiKey?.trim() ?? "";
  const openrouterCatalog = useOpenRouterCatalog();
  const groqCatalog = useGroqCatalog(groqKey);

  // Live Gemini models available to this key (kills stale/fake IDs); the static
  // list is the fallback.
  const [listedModels, setListedModels] = useState<ModelOption[] | null>(null);
  useEffect(() => {
    if (!geminiKey) {
      setListedModels(null);
      return;
    }
    let cancelled = false;
    listGeminiModels(geminiKey)
      .then((m) => {
        if (!cancelled) {
          setListedModels(
            m.length > 0
              ? m.map((x) => ({ id: x.id, label: x.label, badge: "Gemini", desc: x.id }))
              : null,
          );
        }
      })
      .catch(() => {
        if (!cancelled) setListedModels(null);
      });
    return () => {
      cancelled = true;
    };
  }, [geminiKey]);

  const geminiOptions: ChatModelOption[] = (listedModels ?? GEMINI_MODELS).map((m) => ({
    ...m,
    provider: "gemini",
  }));
  const openrouterOptions: ChatModelOption[] = pruneToCatalog(AI_MODELS, openrouterCatalog).map(
    (m) => ({
      id: m.id,
      label: m.label,
      badge: "OpenRouter",
      desc: [m.recommended ? "Recommended" : null, m.free ? "Free" : null, m.id]
        .filter(Boolean)
        .join(" · "),
      provider: "openrouter",
    }),
  );
  const groqOptions: ChatModelOption[] = pruneToCatalog(GROQ_MODELS, groqCatalog).map((m) => ({
    id: m.id,
    label: m.label,
    badge: "Groq",
    desc: [m.recommended ? "Recommended" : null, m.free ? "Free" : null, m.id]
      .filter(Boolean)
      .join(" · "),
    provider: "groq",
  }));
  const pickerOptions: ChatModelOption[] = [
    ...(geminiKey ? geminiOptions : []),
    ...(openrouterKey ? openrouterOptions : []),
    ...(groqKey ? groqOptions : []),
  ];
  const defaultModelFor = (provider: ChatAiProvider): string => {
    if (provider === "groq") return GROQ_MODELS[0]?.id ?? "";
    if (provider === "openrouter") return DEFAULT_AI_MODEL;
    return isSupportedGeminiChatModel(settings.geminiAiModel)
      ? settings.geminiAiModel
      : DEFAULT_GEMINI_CHAT_MODEL;
  };
  const activeModelId = chatModel || defaultModelFor(chatProvider);
  const currentModel: ChatModelOption = pickerOptions.find(
    (m) => m.id === activeModelId && m.provider === chatProvider,
  ) ??
    pickerOptions.find((m) => m.provider === chatProvider) ??
    pickerOptions[0] ?? {
      id: activeModelId,
      label: activeModelId,
      badge: chatProvider === "groq" ? "Groq" : chatProvider === "gemini" ? "Gemini" : "OpenRouter",
      desc: activeModelId,
      provider: chatProvider,
    };
  const selectChatModel = (id: string, provider: ChatAiProvider) => {
    setChatProvider(provider);
    setChatModel(id);
    persistChatSelection(provider, id);
  };

  const effectiveProvider = currentModel.provider;
  const activeKey =
    effectiveProvider === "gemini"
      ? geminiKey
      : effectiveProvider === "groq"
        ? groqKey
        : openrouterKey;
  const providerName =
    effectiveProvider === "groq"
      ? "Groq"
      : effectiveProvider === "gemini"
        ? "Gemini"
        : "OpenRouter";
  const providerLimitsUrl =
    effectiveProvider === "groq"
      ? "https://console.groq.com/keys"
      : effectiveProvider === "gemini"
        ? "https://aistudio.google.com/"
        : "https://openrouter.ai/keys";

  // Handle send
  const handleSend = async (textToSend?: string) => {
    const query = (textToSend ?? input).trim();
    if (!query || requestRef.current) return;

    if (!activeKey) {
      onMissingKey();
      return;
    }

    const controller = new AbortController();
    requestRef.current = controller;
    const userMsg: ChatMessage = {
      id: `user-${crypto.randomUUID()}`,
      role: "user",
      text: query,
      timestamp: Date.now(),
    };

    const botMsgId = `bot-${crypto.randomUUID()}`;
    const initialBotMsg: ChatMessage = {
      id: botMsgId,
      role: "model",
      text: "",
      timestamp: Date.now(),
      loading: true,
    };

    const newHistory = [...messages, userMsg];
    setMessages([...newHistory, initialBotMsg]);
    setInput("");
    setIsLoading(true);
    setLoadingStatus(t("Thinking..."));

    try {
      const currentTitleContext = currentMeta ? buildChatMediaContext(currentMeta) : undefined;
      const history = buildChatHistory(newHistory);
      const plan = webSearchEnabled
        ? await planChatResearch(
            currentModel.provider,
            activeKey,
            currentModel.id,
            history,
            currentTitleContext,
            controller.signal,
          )
        : undefined;
      controller.signal.throwIfAborted();
      const shouldUseCurrentTitle = currentTitleContext && (plan?.useCurrentTitle ?? true);
      const searchNeeded = webSearchEnabled && plan?.needsSearch;
      let research: Awaited<ReturnType<typeof researchChat>> | undefined;
      if (searchNeeded) {
        setLoadingStatus(t("Searching live web..."));
        research = await researchChat(searchProvider, plan!.query, {
          tavilyKey,
          openrouterKey,
          fresh: plan!.fresh,
          signal: controller.signal,
        });
        controller.signal.throwIfAborted();
        if (research.creditsUsed != null) {
          setTavilyLastSearchCredits(research.creditsUsed);
          setTavilySessionCredits((used) => used + research!.creditsUsed!);
        }
      }
      const webContext = research?.context;
      const webSearchSource = research?.provider ?? null;
      const requestOptions = {
        signal: controller.signal,
        researchStatus: !webSearchEnabled
          ? ("disabled" as const)
          : !searchNeeded
            ? ("skipped" as const)
            : ("unavailable" as const),
      };
      setLoadingStatus(t("Generating recommendations..."));
      const apiHistory = history.map((message, index, history) => ({
        ...message,
        text:
          index === history.length - 1 && shouldUseCurrentTitle
            ? message.text + "\n\n" + currentTitleContext
            : message.text,
      }));

      const preferredModel = currentModel.id;
      const result =
        currentModel.provider === "gemini"
          ? await callGeminiApi(activeKey, apiHistory, preferredModel, webContext, requestOptions)
          : await callOpenAiCompatibleChatApi(
              currentModel.provider,
              activeKey,
              apiHistory,
              preferredModel,
              webContext,
              requestOptions,
            );
      controller.signal.throwIfAborted();
      setAiSessionUsage((usage) => ({
        requests:
          (usage?.requests ?? 0) + 1 + (plan ? 1 : 0) + (research?.totalTokens != null ? 1 : 0),
        tokens:
          (usage?.tokens ?? 0) +
          (result.usage?.totalTokens ?? 0) +
          (research?.totalTokens ?? 0) +
          (plan?.usage?.totalTokens ?? 0),
      }));

      setMessages((previous) =>
        previous.map((message) =>
          message.id === botMsgId
            ? {
                ...message,
                text: result.text,
                recommendations: result.recommendations,
                followUps: result.followUps,
                loading: false,
                webSearchSource,
                sources: research?.sources,
                researchUnavailable: research?.unavailable,
              }
            : message,
        ),
      );
      // Start Cinemeta resolution for recommendations if any
      let resolved = undefined;
      if (result.recommendations && result.recommendations.length > 0) {
        setLoadingStatus(t("Fetching media cards..."));
        resolved = await resolveChatRecommendations(result.recommendations, controller.signal);
      }

      controller.signal.throwIfAborted();
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMsgId
            ? {
                ...m,
                text: result.text,
                recommendations: result.recommendations,
                resolvedMeta: resolved,
                ...(result.recommendations.length > (resolved?.length ?? 0)
                  ? {
                      text: [
                        result.text,
                        t("{count} suggested titles couldn't be matched to the Harbor catalog.", {
                          count: result.recommendations.length - (resolved?.length ?? 0),
                        }),
                      ]
                        .filter(Boolean)
                        .join("\n\n"),
                    }
                  : {}),
                loading: false,
                webSearchSource,
              }
            : m,
        ),
      );
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        setMessages((previous) =>
          previous.map((message) =>
            message.id === botMsgId
              ? {
                  ...message,
                  loading: false,
                  text: message.text || t("Response stopped."),
                  followUps: [],
                }
              : message,
          ),
        );
        return;
      }
      const errMsg = err instanceof Error ? err.message : t("Failed to get recommendations.");
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMsgId
            ? {
                ...m,
                text: "",
                error: errMsg,
                loading: false,
              }
            : m,
        ),
      );
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      setIsLoading(false);
      setLoadingStatus("");
    }
  };

  const handleClearHistory = () => {
    setMessages([]);
    setAiSessionUsage(null);
    setTavilySessionCredits(0);
    setTavilyLastSearchCredits(null);
  };

  return {
    input,
    setInput,
    messages,
    isLoading,
    loadingStatus,
    webSearchEnabled,
    setWebSearchEnabled,
    searchProvider,
    setSearchProvider,
    aiSessionUsage,
    tavilyLastSearchCredits,
    tavilySessionCredits,
    currentMeta,
    currentModel,
    pickerOptions,
    activeKey,
    tavilyKey,
    openrouterKey,
    providerName,
    providerLimitsUrl,
    selectChatModel,
    handleSend,
    handleClearHistory,
    stopResponse: () => requestRef.current?.abort(),
  };
}
