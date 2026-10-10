import { useState } from "react";
import { Loader2, X } from "lucide-react";
import type { AiProvider } from "@/lib/ai-models";
import { ProviderLogo } from "@/components/ai-provider-logo";
import { AiExampleHint } from "@/components/ai-example-hint";
import { useT } from "@/lib/i18n";

export function AnimeAiBar({
  provider,
  loading,
  onSubmit,
  onExit,
}: {
  provider: AiProvider;
  loading: boolean;
  onSubmit: (q: string) => void;
  onExit: () => void;
}) {
  const t = useT();
  const [input, setInput] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(input);
      }}
      className="animate-ai-morph relative flex items-center gap-2.5 overflow-hidden rounded-lg bg-canvas px-3.5 ring-1 ring-inset ring-edge-soft focus-within:ring-accent/50"
    >
      <span className="animate-ai-logo-swap relative shrink-0">
        <ProviderLogo provider={provider} size={18} round />
      </span>
      <div className="relative flex-1">
        <input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="h-12 w-full bg-transparent text-[14.5px] text-ink outline-none"
        />
        <AiExampleHint hidden={input.length > 0} />
      </div>
      {loading && <Loader2 size={16} className="shrink-0 animate-spin text-accent" />}
      <button
        type="button"
        onClick={onExit}
        aria-label={t("Exit AI mode")}
        className="shrink-0 text-ink-subtle transition-colors hover:text-ink"
      >
        <X size={16} />
      </button>
    </form>
  );
}
