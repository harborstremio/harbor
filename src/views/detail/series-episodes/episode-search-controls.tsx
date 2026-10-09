import { X } from "lucide-react";
import { Search } from "@/components/icons/search-icon";
import type { AiProvider } from "@/lib/ai-models";
import { ProviderLogo } from "@/components/ai-provider-logo";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useT } from "@/lib/i18n";

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
      <HoverTooltip label={t("Search episodes")} align="center" className="shrink-0">
        <button
          type="button"
          onClick={onSearch}
          aria-label={t("Search episodes")}
          className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
            searchActive
              ? "bg-accent/15 text-accent"
              : "bg-white/[0.06] text-ink-muted hover:bg-white/[0.10] hover:text-ink"
          }`}
        >
          <Search size={16} />
        </button>
      </HoverTooltip>
      {aiEnabled && (
        <HoverTooltip
          label={t("Ask AI")}
          sublabel={t("Find episodes by describing them")}
          align="center"
          className="shrink-0"
        >
          <button
            type="button"
            onClick={onAskAi}
            aria-label={t("Ask AI")}
            className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-medium transition-colors xl:px-3 ${
              aiMode
                ? "bg-accent/15 text-accent"
                : "bg-white/[0.06] text-ink-muted hover:bg-white/[0.10] hover:text-ink"
            }`}
          >
            <ProviderLogo provider={aiProvider} size={16} />
            <span className="hidden xl:inline">{t("Ask AI")}</span>
          </button>
        </HoverTooltip>
      )}
    </>
  );
}

export function EpisodeSearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
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
