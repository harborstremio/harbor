import { useT } from "@/lib/i18n";
import { Eye, EyeOff } from "lucide-react";

export function SectionEditBar({ name, hidden, onToggle }: { name: string; hidden: boolean; onToggle: () => void }) {
  const t = useT();
  return (
    <div className="mb-2 flex items-center gap-1.5 rounded-xl border border-edge-soft bg-canvas/60 px-2 py-1.5">
      <button
        onClick={onToggle}
        title={hidden ? t("Show section") : t("Hide section")}
        className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
          hidden ? "bg-danger/15 text-danger hover:bg-danger/25" : "text-ink-muted hover:bg-raised hover:text-ink"
        }`}
      >
        {hidden ? <EyeOff size={14} strokeWidth={2.2} /> : <Eye size={14} strokeWidth={2.2} />}
      </button>
      <span className="flex-1 truncate text-[13px] font-medium text-ink">{name}</span>
      {hidden && (
        <span className="rounded-md bg-danger/15 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-danger">
          {t("Hidden")}
        </span>
      )}
    </div>
  );
}
