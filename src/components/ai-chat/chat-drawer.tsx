import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ArrowUp, Trash2, Key, AlertCircle, Globe, ChevronDown, Check } from "lucide-react";
import { ProviderLogo } from "@/components/ai-provider-logo";
import { ThreeLiquidGlassSurface } from "@/components/ThreeLiquidGlassSurface";
import { useT } from "@/lib/i18n";
import { CHAT_SEARCH_OPTIONS, isChatSearchProvider } from "@/lib/ai-chat-research";
import { useChat, type ChatAiProvider } from "./use-chat";
import { positionChatModelPicker, buildChatQuickPrompts } from "./chat-context";
import { ChatSettings } from "./chat-settings";
import { ChatMessages } from "./chat-message";

export function ChatDrawer() {
  const t = useT();

  const [isOpen, setIsOpen] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const chat = useChat(() => setShowKeyModal(true));
  const {
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
    handleSend,
    handleClearHistory,
  } = chat;
  const launcherRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const modelButtonRef = useRef<HTMLButtonElement>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);
  const [modelPickerPosition, setModelPickerPosition] = useState<{
    top: number;
    left: number;
    maxHeight: number;
  } | null>(null);

  const resizeInput = useCallback(() => {
    const inputElement = inputRef.current;
    if (!inputElement) return;
    inputElement.style.height = "auto";
    inputElement.style.height = `${Math.min(inputElement.scrollHeight, 120)}px`;
  }, []);

  useEffect(() => {
    resizeInput();
  }, [input, resizeInput]);

  const { quickPromptContext, quickPrompts } = buildChatQuickPrompts(messages, currentMeta, t);

  const selectChatModel = (id: string, provider: ChatAiProvider) => {
    chat.selectChatModel(id, provider);
    setShowModelPicker(false);
  };

  useEffect(() => {
    if (!showModelPicker) {
      setModelPickerPosition(null);
      return;
    }

    const updatePosition = () => {
      const anchor = modelButtonRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      setModelPickerPosition(
        positionChatModelPicker(
          rect,
          { width: window.innerWidth, height: window.innerHeight },
          document.documentElement.dir === "rtl",
        ),
      );
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [showModelPicker]);

  useEffect(() => {
    if (!isOpen) setShowModelPicker(false);
  }, [isOpen]);

  useEffect(() => {
    if (!showModelPicker) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (modelButtonRef.current?.contains(target) || modelPickerRef.current?.contains(target))
        return;
      setShowModelPicker(false);
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [showModelPicker]);

  // Auto scroll messages to bottom
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [isOpen, messages, scrollToBottom]);

  const closeChat = () => {
    setIsOpen(false);
    requestAnimationFrame(() => launcherRef.current?.focus());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      e.key === "Enter" &&
      !e.shiftKey &&
      !e.nativeEvent.isComposing &&
      !e.currentTarget.readOnly
    ) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleOpenChat = () => setIsOpen(true);

  const openKeySettings = () => {
    setShowModelPicker(false);
    setShowKeyModal(true);
  };

  return (
    <>
      {/* Floating Action Button on the Right */}
      {!isOpen && (
        <button
          type="button"
          ref={launcherRef}
          onClick={handleOpenChat}
          aria-label={t("Open AI Assistant")}
          className="fixed end-5 bottom-20 z-40 flex items-center gap-2.5 rounded-full border border-edge-soft/90 bg-canvas/80 px-4 py-2.5 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:scale-105 hover:border-accent/60 hover:shadow-accent/20 active:scale-95 group"
        >
          <div className="relative flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 ring-1 ring-accent/30 overflow-hidden">
            <ProviderLogo
              provider={
                currentModel.provider === "groq"
                  ? "groq"
                  : currentModel.provider === "gemini"
                    ? "gemini"
                    : "openrouter"
              }
              size={20}
              round
            />
          </div>
          <span className="text-xs font-semibold text-ink tracking-wide">{t("Ask AI")}</span>
          <span className="flex h-2 w-2 rounded-full bg-accent animate-pulse" />
        </button>
      )}

      {/* Floating Side Chat Drawer */}
      {isOpen && (
        <div
          role="dialog"
          aria-label={t("Harbor AI Chat")}
          data-tv-focus-scope
          data-navigation-isolated
          className="fixed end-4 top-14 bottom-6 z-50 w-[430px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-3xl border border-edge-soft/80 shadow-2xl transition-all animate-in fade-in slide-in-from-right-8 duration-300"
        >
          <ThreeLiquidGlassSurface
            radius={24}
            className="h-full w-full rounded-3xl"
            contentClassName="flex h-full w-full flex-col overflow-hidden rounded-[inherit]"
            variant="overlay"
            style={{
              backgroundColor: "color-mix(in srgb, var(--color-canvas) 58%, transparent)",
              backdropFilter: "blur(24px) saturate(1.35)",
              WebkitBackdropFilter: "blur(24px) saturate(1.35)",
            }}
          >
            {/* Drawer Header */}
            <div className="relative flex items-center justify-between border-b border-edge-soft/60 bg-canvas/55 px-4 py-3 backdrop-blur-md">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 ring-1 ring-accent/30 overflow-hidden">
                  <ProviderLogo
                    provider={
                      currentModel.provider === "groq"
                        ? "groq"
                        : currentModel.provider === "gemini"
                          ? "gemini"
                          : "openrouter"
                    }
                    size={20}
                    round
                  />
                </div>
                <div className="min-w-0">
                  {/* Model selector toggle */}
                  <div className="relative">
                    <button
                      ref={modelButtonRef}
                      type="button"
                      aria-label={t("Select AI model")}
                      aria-expanded={showModelPicker}
                      onClick={() => setShowModelPicker((p) => !p)}
                      className="flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 -ms-1 text-xs font-bold text-ink hover:bg-elevated transition-colors"
                    >
                      <span>{currentModel.label}</span>
                      <span className="rounded bg-accent/15 px-1 py-0.5 text-[9.5px] font-semibold text-accent ring-1 ring-accent/25">
                        {t(currentModel.badge)}
                      </span>
                      <ChevronDown size={12} className="text-ink/80" />
                    </button>
                  </div>

                  <p className="text-[10px] text-ink/80 leading-none truncate mt-0.5">
                    {webSearchEnabled
                      ? t("{provider} + Live Web Search", { provider: providerName })
                      : t("Movie & Series Recommendations")}
                  </p>
                </div>
              </div>

              {/* Header controls */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label={t("AI keys & web search settings")}
                  onClick={openKeySettings}
                  title={t("AI keys & web search settings")}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-ink/85 hover:bg-elevated hover:text-ink transition-colors"
                >
                  <Key size={15} />
                </button>

                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    disabled={isLoading}
                    title={t("Clear Chat")}
                    aria-label={t("Clear Chat")}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-ink/85 hover:bg-elevated hover:text-rose-400 transition-colors disabled:pointer-events-none disabled:opacity-40"
                  >
                    <Trash2 size={15} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={closeChat}
                  title={t("Close")}
                  aria-label={t("Close")}
                  data-tv-modal-close
                  data-navigation-isolated-close
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-ink/85 hover:bg-elevated hover:text-ink transition-colors"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 border-b border-edge-soft/50 bg-canvas/65 px-4 py-2">
              <label htmlFor="chat-search-provider" className="shrink-0 text-xs text-ink/80">
                {t("Search source")}
              </label>
              <select
                id="chat-search-provider"
                value={searchProvider}
                disabled={isLoading || !webSearchEnabled}
                onChange={(event) => {
                  if (isChatSearchProvider(event.target.value))
                    setSearchProvider(event.target.value);
                }}
                className="min-w-0 flex-1 rounded-lg border border-edge-soft bg-canvas px-2 py-1 text-xs text-ink disabled:opacity-50"
              >
                {CHAT_SEARCH_OPTIONS.map((option) => (
                  <option
                    key={option.id}
                    value={option.id}
                    disabled={
                      (option.id === "tavily" && !tavilyKey) ||
                      (option.id.startsWith("sonar") && !openrouterKey)
                    }
                  >
                    {t(option.label)}
                  </option>
                ))}
              </select>
            </div>
            {searchProvider.startsWith("sonar") && (
              <p className="bg-canvas/65 px-4 py-1 text-[10px] text-ink/75">
                {t("Uses your OpenRouter key and balance for search.")}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-edge-soft/50 bg-canvas/70 px-4 py-2 text-[10px] text-ink/90 backdrop-blur-md">
              <span
                title={t(
                  "Session usage resets when you clear the conversation. Includes research planning and reported search-model tokens.",
                )}
              >
                {aiSessionUsage == null
                  ? t("AI session: 0 requests")
                  : t("AI session: {requests} requests · {tokens} reported tokens", {
                      requests: aiSessionUsage.requests,
                      tokens: aiSessionUsage.tokens,
                    })}
              </span>
              <a
                href={providerLimitsUrl}
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:underline"
              >
                {t("{provider} limits", { provider: providerName })}
              </a>
              <span
                className={tavilyKey ? "text-emerald-300" : "text-ink/75"}
                title={t(
                  "Harbor session usage only. Counts credits returned by successful Tavily search requests.",
                )}
              >
                {tavilyKey
                  ? t("Tavily session: {credits} credits", {
                      credits: tavilySessionCredits,
                    })
                  : t("Add a Tavily API key to track Harbor search usage.")}
                {tavilyLastSearchCredits != null &&
                  ` · ${t("Last request: {count} credits", { count: tavilyLastSearchCredits })}`}
                {tavilyKey && (
                  <a
                    href="https://app.tavily.com/billing"
                    target="_blank"
                    rel="noreferrer"
                    className="ms-1 text-accent hover:underline"
                  >
                    {t("Tavily limits")}
                  </a>
                )}
              </span>
            </div>

            {/* Missing Key Banner */}
            {!activeKey && (
              <div className="m-3 mb-0 flex flex-col gap-2 rounded-2xl border border-amber-500/40 bg-canvas/90 p-3 text-xs text-amber-100 shadow-sm backdrop-blur-md">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertCircle size={14} className="text-amber-400" />
                  <span>{t("AI provider key required")}</span>
                </div>
                <p className="text-[11.5px] text-amber-100/90 leading-relaxed">
                  {t("Add your {provider} API key to unlock this assistant.", {
                    provider: providerName,
                  })}
                </p>
                <button
                  type="button"
                  onClick={openKeySettings}
                  className="w-fit rounded-lg bg-amber-500/20 px-2.5 py-1 text-[11px] font-semibold text-amber-300 ring-1 ring-amber-500/40 hover:bg-amber-500/30 transition-colors"
                >
                  {t("Enter API Key")}
                </button>
              </div>
            )}

            <ChatMessages
              scrollRef={scrollRef}
              messages={messages}
              quickPrompts={quickPrompts}
              hasMedia={Boolean(quickPromptContext.media)}
              isLoading={isLoading}
              loadingStatus={loadingStatus}
              handleSend={handleSend}
            />

            {/* Drawer Input Bar */}
            <div className="border-t border-edge-soft/60 bg-canvas/65 p-3 backdrop-blur-md">
              <div data-tv-text-field className="relative flex items-center">
                <button
                  type="button"
                  onClick={() => setWebSearchEnabled((v) => !v)}
                  title={webSearchEnabled ? t("Web Search Enabled") : t("Web Search Disabled")}
                  aria-label={
                    webSearchEnabled ? t("Turn off live web search") : t("Turn on live web search")
                  }
                  aria-pressed={webSearchEnabled}
                  className={`absolute start-2 z-10 flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                    webSearchEnabled
                      ? "text-emerald-400 bg-emerald-500/15 ring-1 ring-emerald-500/30"
                      : "text-ink/85 hover:text-ink hover:bg-elevated"
                  }`}
                >
                  <Globe size={14} />
                </button>

                <textarea
                  ref={inputRef}
                  data-tv-initial-focus
                  rows={1}
                  aria-label={t("Chat message")}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    resizeInput();
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    webSearchEnabled
                      ? t("Ask for movies or upcoming release dates...")
                      : t("Ask for movies, series, or recommendations...")
                  }
                  disabled={isLoading}
                  className="max-h-[120px] min-h-10 w-full resize-none overflow-y-auto rounded-2xl border border-edge-soft bg-canvas/80 py-2.5 ps-10 pe-11 text-xs leading-relaxed text-ink placeholder:text-ink/75 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors disabled:opacity-50"
                />

                <button
                  type="button"
                  onClick={() => (isLoading ? chat.stopResponse() : handleSend())}
                  disabled={!isLoading && !input.trim()}
                  aria-label={isLoading ? t("Stop response") : t("Send")}
                  className="absolute end-1.5 flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-canvas shadow transition-all hover:brightness-110 disabled:opacity-30 disabled:pointer-events-none active:scale-95"
                >
                  {isLoading ? <X size={14} /> : <ArrowUp size={16} strokeWidth={2.5} />}
                </button>
              </div>
            </div>
          </ThreeLiquidGlassSurface>
        </div>
      )}

      {showKeyModal && <ChatSettings onClose={() => setShowKeyModal(false)} />}
      {isOpen &&
        showModelPicker &&
        modelPickerPosition &&
        createPortal(
          <div
            ref={modelPickerRef}
            role="dialog"
            aria-label={t("Select AI model")}
            data-tv-focus-scope
            data-navigation-isolated
            style={{
              position: "fixed",
              top: modelPickerPosition.top,
              left: modelPickerPosition.left,
              width: Math.min(256, window.innerWidth - 24),
              maxHeight: modelPickerPosition.maxHeight,
            }}
            className="z-[100] flex flex-col overflow-hidden rounded-2xl border border-edge-soft bg-canvas shadow-2xl ring-1 ring-black/20 backdrop-blur-2xl animate-in fade-in duration-150"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-edge-soft/60 bg-canvas px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-ink/90">
              <span>{t("Select AI model")}</span>
              <button
                type="button"
                data-navigation-isolated-close
                aria-label={t("Close")}
                onClick={() => setShowModelPicker(false)}
                className="grid h-6 w-6 place-items-center rounded-lg text-ink/80 hover:bg-elevated hover:text-ink"
              >
                <X size={13} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-1.5 [scrollbar-width:thin]">
              {pickerOptions.map((model) => {
                const isSelected =
                  model.id === currentModel.id && model.provider === currentModel.provider;
                return (
                  <button
                    key={`${model.provider}:${model.id}`}
                    type="button"
                    onClick={() => selectChatModel(model.id, model.provider)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-start transition-colors ${
                      isSelected ? "bg-accent/15 text-accent" : "text-ink hover:bg-elevated"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="text-xs font-semibold">{model.label}</span>
                        <span className="rounded bg-elevated px-1.5 py-0.5 text-[9px] text-ink/85 ring-1 ring-edge-soft">
                          {t(model.badge)}
                        </span>
                      </span>
                      <span className="mt-1 block truncate text-[10.5px] leading-snug text-ink/80">
                        {t(model.desc)}
                      </span>
                    </span>
                    {isSelected && <Check size={15} className="shrink-0 text-accent" />}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
