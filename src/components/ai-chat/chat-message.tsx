import type { RefObject } from "react";
import { Sparkles, Star, Users, Globe, AlertCircle, Loader2 } from "lucide-react";
import { ChatCardDeck } from "./chat-card-deck";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "@/lib/ai-chat";
import { safeChatSourceUrl } from "@/lib/ai-chat-research";
import { useT } from "@/lib/i18n";

function ChatMessageView({ message }: { message: ChatMessage }) {
  const t = useT();
  const sources = message.sources ?? [];
  const text = message.text.replace(/\[(\d+)\](?!\()/g, (citation, number: string) => {
    const source = sources[Number(number) - 1];
    return source
      ? `[${number}](${source.url.replaceAll("(", "%28").replaceAll(")", "%29")})`
      : citation;
  });
  return (
    <div dir="auto" className="min-w-0 break-words space-y-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) =>
            safeChatSourceUrl(href) ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline underline-offset-2"
              >
                {children}
              </a>
            ) : (
              <span>{children}</span>
            ),
          img: () => null,
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc ps-5 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal ps-5 space-y-1">{children}</ol>,
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-lg bg-elevated p-2 text-xs">{children}</pre>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="text-xs">{children}</table>
            </div>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
      {message.researchUnavailable && (
        <p className="text-xs text-amber-400">
          {t("Live search was unavailable. Current facts could not be verified.")}
        </p>
      )}
      {sources.length > 0 && (
        <details className="border-t border-edge-soft pt-2 text-xs">
          <summary className="cursor-pointer text-ink/80">
            {t("Sources ({count})", { count: sources.length })}
          </summary>
          <ol className="mt-2 list-decimal space-y-1 ps-5">
            {sources.map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  {source.title}
                </a>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

const QUICK_PROMPT_ICONS = [Sparkles, Users, Star];

export function ChatMessages({
  scrollRef,
  messages,
  quickPrompts,
  hasMedia,
  isLoading,
  loadingStatus,
  handleSend,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  messages: ChatMessage[];
  quickPrompts: string[];
  hasMedia: boolean;
  isLoading: boolean;
  loadingStatus: string;
  handleSend: (text?: string) => Promise<void>;
}) {
  const t = useT();
  return (
    <>
      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center px-4 py-8">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 ring-1 ring-accent/30 shadow-inner">
              <Sparkles size={24} className="text-accent" />
            </div>
            <h4 className="text-base font-bold text-ink mb-1">
              {t("What would you like to watch?")}
            </h4>
            <p className="text-xs text-ink/85 max-w-[280px] leading-relaxed mb-5">
              {t(
                "Ask for movie recommendations, release dates, or questions about upcoming films.",
              )}
            </p>

            {/* Quick prompt suggestions */}
            <div className="grid w-full max-w-[340px] grid-cols-2 gap-2">
              {quickPrompts.map((prompt, index) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleSend(prompt)}
                  className="flex min-h-10 min-w-0 items-center gap-2 rounded-xl border border-edge-soft/70 bg-canvas/70 px-2.5 py-2 text-start text-[11px] leading-snug text-ink/90 shadow-sm backdrop-blur-sm transition-all hover:border-accent/40 hover:bg-canvas/90 hover:text-ink active:scale-[0.99]"
                >
                  {hasMedia && (
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-accent/12 text-accent">
                      {(() => {
                        const PromptIcon = QUICK_PROMPT_ICONS[index];
                        return PromptIcon ? <PromptIcon size={13} /> : null;
                      })()}
                    </span>
                  )}
                  <span className="line-clamp-2 min-w-0">{prompt}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              {/* Web search utilized badge */}
              {msg.webSearchSource && (
                <div
                  className={`flex items-center gap-1.5 mb-1 text-[11px] font-semibold px-2 py-0.5 rounded-md ring-1 backdrop-blur-sm ${
                    msg.webSearchSource === "tavily"
                      ? "text-emerald-400 bg-emerald-500/10 ring-emerald-500/20"
                      : "text-sky-400 bg-sky-500/10 ring-sky-500/20"
                  }`}
                >
                  <Globe size={11} />
                  <span>
                    {t("Live Web Search")} ·{" "}
                    {msg.webSearchSource === "tavily"
                      ? "Tavily"
                      : msg.webSearchSource.startsWith("sonar")
                        ? "Perplexity"
                        : t("Free web search")}
                  </span>
                </div>
              )}

              {/* Message Bubble */}
              <div
                className={`relative max-w-[90%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm ${
                  msg.role === "user"
                    ? "bg-accent text-canvas rounded-ee-sm"
                    : "border border-edge-soft/80 bg-canvas/85 text-ink rounded-es-sm backdrop-blur-sm"
                }`}
              >
                {msg.loading ? (
                  <div className="flex items-center gap-2 py-1 text-ink/90">
                    <Loader2 size={15} className="animate-spin text-accent" />
                    <span className="text-xs">{loadingStatus || t("Thinking...")}</span>
                  </div>
                ) : msg.error ? (
                  <div className="flex items-center gap-2 text-rose-400">
                    <AlertCircle size={15} />
                    <span>{msg.error}</span>
                  </div>
                ) : (
                  <ChatMessageView message={msg} />
                )}
              </div>

              {/* Recommendation Card Deck (Centered) */}
              {msg.resolvedMeta && msg.resolvedMeta.length > 0 && (
                <div className="w-full mt-2">
                  <ChatCardDeck items={msg.resolvedMeta} />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {messages.length > 0 && !isLoading && quickPrompts.length > 0 && (
        <div className="grid shrink-0 grid-cols-2 gap-1.5 border-t border-edge-soft/50 bg-canvas/65 px-3 py-2 backdrop-blur-md">
          {quickPrompts.slice(0, 3).map((prompt, index) => {
            const PromptIcon = QUICK_PROMPT_ICONS[index];
            return (
              <button
                key={prompt}
                type="button"
                dir="auto"
                disabled={isLoading}
                onClick={() => handleSend(prompt)}
                className="flex min-h-8 min-w-0 items-center gap-1.5 rounded-xl border border-edge-soft bg-canvas/90 px-2 py-1.5 text-start text-[10.5px] font-medium leading-tight text-ink shadow-sm transition-colors hover:border-accent/50 hover:text-accent disabled:opacity-50"
              >
                {hasMedia && <PromptIcon size={12} className="shrink-0" />}
                <span className="line-clamp-2 min-w-0">{prompt}</span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
