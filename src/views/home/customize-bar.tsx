import type { HomeRowCustomization } from "@/lib/home-customization";
import { useT } from "@/lib/i18n";
import { Pencil, RotateCcw, Plus } from "lucide-react";

export function CustomizeBar({
  editMode,
  customization,
  onToggleEdit,
  onReset,
  onAddSource,
}: {
  editMode: boolean;
  customization: HomeRowCustomization;
  onToggleEdit: () => void;
  onReset: () => void;
  onAddSource?: () => void;
}) {
  const t = useT();
  const hasChanges =
    customization.order.length > 0 || customization.hidden.length > 0 || Object.keys(customization.renamed).length > 0;
  return (
    <div className="flex items-center justify-end gap-2">
      {editMode && hasChanges && (
        <button
          onClick={onReset}
          className="flex h-8 items-center gap-1.5 rounded-md border border-edge-soft/40 bg-canvas/80 px-2.5 text-[12px] font-medium text-ink-muted backdrop-blur-md transition-colors hover:bg-canvas hover:text-ink"
        >
          <RotateCcw size={12} strokeWidth={2.2} />
          {t("Reset")}
        </button>
      )}
      {editMode && onAddSource && (
        <button
          onClick={onAddSource}
          className="flex h-8 items-center gap-1.5 rounded-md border border-edge-soft/40 bg-canvas/80 px-2.5 text-[12px] font-medium text-ink-muted backdrop-blur-md transition-colors hover:bg-canvas hover:text-ink"
        >
          <Plus size={12} strokeWidth={2.2} />
          {t("Add Source")}
        </button>
      )}
      <button
        onClick={onToggleEdit}
        className={`flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium backdrop-blur-md transition-colors ${
          editMode
            ? "border-ink bg-ink text-canvas hover:opacity-90"
            : "border-edge-soft/40 bg-canvas/80 text-ink-muted hover:bg-canvas hover:text-ink"
        }`}
      >
        <Pencil size={12} strokeWidth={2.4} />
        {editMode ? t("Done editing") : t("Customize home")}
      </button>
    </div>
  );
}
