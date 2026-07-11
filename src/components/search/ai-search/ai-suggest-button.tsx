import { ProviderLogo } from "@/components/ai-provider-logo";
import type { AiProvider } from "@/lib/ai-models";
import { useT } from "@/lib/i18n";
import { ArrowBigUp, CornerDownLeft } from "lucide-react";

export function AiSuggestButton({
  query,
  provider,
  onRun,
}: {
  query: string;
  provider: AiProvider;
  onRun: () => void;
}) {
  const t = useT();
  return (
    <button
      onClick={onRun}
      className="group animate-ai-entrance relative flex h-16 w-full items-center gap-3 overflow-hidden rounded-2xl border border-accent/40 bg-accent/10 px-4 text-start transition-colors hover:bg-accent/15"
    >
      <span className="ai-hover-sheen pointer-events-none absolute inset-0 -translate-x-full skew-x-[-16deg] bg-gradient-to-r from-transparent via-ink/10 to-transparent opacity-0" />
      <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-accent/20">
        <ProviderLogo provider={provider} size={20} round />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">{t("AI search")}</span>
        <span className="truncate text-[15px] font-semibold text-ink">
          {t('Ask AI to find titles for "{query}"', { query })}
        </span>
      </span>
      <span className="ms-auto flex shrink-0 items-center gap-1 text-accent/85">
        <kbd className="flex h-5 w-5 items-center justify-center rounded border border-edge-soft bg-elevated/70 text-ink-muted">
          <ArrowBigUp size={12} strokeWidth={2} />
        </kbd>
        <span className="text-ink-subtle/70">+</span>
        <kbd className="flex h-5 w-5 items-center justify-center rounded border border-edge-soft bg-elevated/70 text-ink-muted">
          <CornerDownLeft size={12} strokeWidth={2} />
        </kbd>
      </span>
    </button>
  );
}
