import { ProviderLogo } from "@/components/ai-provider-logo";
import type { AiProvider } from "@/lib/ai-models";
import { useT } from "@/lib/i18n";
import { useEffect, useState, type CSSProperties } from "react";

function StatusLine({ phrases }: { phrases: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setI((v) => (v + 1) % phrases.length), 1400);
    return () => window.clearInterval(id);
  }, [phrases.length]);
  return (
    <span className="flex items-center text-[13px] text-ink-muted">
      <span key={i} className="animate-ai-status">
        {phrases[i]}
      </span>
      <span className="dots-anim ms-0.5" />
    </span>
  );
}

export function AiThinking({
  provider,
  label,
  phrases,
  rows = 4,
}: {
  provider: AiProvider;
  label: string;
  phrases: string[];
  rows?: number;
}) {
  const t = useT();
  return (
    <div className="animate-ai-entrance flex flex-col gap-4">
      <div className="flex items-center gap-3.5">
        <span className="relative flex h-11 w-11 items-center justify-center">
          <span className="ai-thinking-ring absolute inset-0" />
          <ProviderLogo provider={provider} size={22} round />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
            {label || t("AI search")}
          </span>
          <StatusLine phrases={phrases} />
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-2xl px-3 py-2.5">
            <div
              className="ai-skeleton h-[96px] w-[64px] shrink-0 rounded-xl bg-elevated/60"
              style={{ "--ai-delay": `${i * 120}ms` } as CSSProperties}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div
                className="ai-skeleton h-3.5 w-1/2 rounded-full bg-elevated/60"
                style={{ "--ai-delay": `${i * 120}ms` } as CSSProperties}
              />
              <div
                className="ai-skeleton h-3 w-2/3 rounded-full bg-elevated/50"
                style={{ "--ai-delay": `${i * 120 + 60}ms` } as CSSProperties}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
