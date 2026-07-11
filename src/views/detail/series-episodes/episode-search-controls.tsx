import { ProviderLogo } from "@/components/ai-provider-logo";
import type { AiProvider } from "@/lib/ai-models";
import { useT } from "@/lib/i18n";
import { Search, X } from "lucide-react";

export function EpisodeSearchToggle({
  searchActive,
  aiMode,
  aiEnabled,
  aiProvider,
  onSearch,
  onAskAi,
}: {
  searchActive: boolean;
  aiMode: boolean;
  aiEnabled: boolean;
  aiProvider: AiProvider;
  onSearch: () => void;
  onAskAi: () => void;
}) {
  const t = useT();
  return (
    <>
      <button
        type="button"
        onClick={onSearch}
        aria-label={t("Search episodes")}
        title={t("Search episodes")}
        className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
          searchActive
            ? "border-accent/50 bg-accent/15 text-accent"
            : "border-edge-soft bg-canvas/90 text-ink-muted hover:text-ink"
        }`}
      >
        <Search size={16} />
      </button>
      {aiEnabled && (
        <button
          type="button"
          onClick={onAskAi}
          aria-label={t("Ask AI")}
          title={t("Ask AI")}
          className={`flex h-10 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors ${
            aiMode
              ? "border-accent/50 bg-accent/15 text-accent"
              : "border-edge-soft bg-canvas/90 text-ink-muted hover:text-ink"
          }`}
        >
          <ProviderLogo provider={aiProvider} size={16} />
          {t("Ask AI")}
        </button>
      )}
    </>
  );
}

export function EpisodeSearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useT();
  return (
    <div className="flex items-center gap-2.5 rounded-2xl bg-elevated px-3.5 ring-1 ring-edge-soft">
      <Search size={16} className="shrink-0 text-ink-subtle" />
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("Search episodes across all seasons")}
        className="h-12 flex-1 bg-transparent text-[14.5px] text-ink outline-none placeholder:text-ink-subtle"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          aria-label={t("Clear search")}
          className="shrink-0 text-ink-subtle transition-colors hover:text-ink"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
