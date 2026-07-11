import { ProviderLogo } from "@/components/ai-provider-logo";
import type { AiProvider } from "@/lib/ai-models";
import { PROVIDER_NAME } from "@/lib/ai-models";
import { useT } from "@/lib/i18n";

export function AiPicksHeader({ provider, label, count }: { provider: AiProvider; label: string; count: number }) {
  const t = useT();
  return (
    <div className="animate-ai-entrance mb-3 flex items-center gap-2.5">
      <ProviderLogo provider={provider} size={19} round />
      <span className="text-[12px] font-semibold uppercase tracking-[0.2em] text-ink-subtle">{t("AI picks")}</span>
      <span className="text-[12px] text-ink-subtle">
        {label} · {PROVIDER_NAME[provider]}
      </span>
      <span className="ms-auto text-[12px] tabular-nums text-ink-subtle">{count}</span>
    </div>
  );
}
