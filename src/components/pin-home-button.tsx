import { useT } from "@/lib/i18n";
import { togglePinnedCatalog, useIsPinned, type PinnedSource } from "@/lib/pinned-catalogs";
import { Home } from "lucide-react";

export function PinHomeButton({
  id,
  source,
  name,
  params,
}: {
  id: string;
  source: PinnedSource;
  name: string;
  params: Record<string, string>;
}) {
  const t = useT();
  const pinned = useIsPinned(id);
  return (
    <button
      type="button"
      onClick={() => togglePinnedCatalog({ id, source, name, params })}
      aria-pressed={pinned}
      aria-label={pinned ? t("Remove from Home") : t("Add to Home Screen")}
      title={pinned ? t("Remove from Home") : t("Add to Home Screen")}
      className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
        pinned
          ? "border-accent/50 bg-accent/15 text-accent"
          : "border-edge-soft bg-canvas/40 text-ink-subtle hover:border-edge hover:text-ink-muted"
      }`}
    >
      <Home size={14} strokeWidth={2.2} />
    </button>
  );
}
