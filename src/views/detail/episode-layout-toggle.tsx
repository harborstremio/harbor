import { useT } from "@/lib/i18n";
import { GalleryHorizontal, LayoutGrid, List } from "lucide-react";

type Layout = "list" | "strip" | "grid";

export function EpisodeLayoutToggle({ value, onChange }: { value: Layout; onChange: (v: Layout) => void }) {
  const t = useT();
  const options: { key: Layout; label: string; icon: typeof List }[] = [
    { key: "list", label: t("List view"), icon: List },
    { key: "strip", label: t("Horizontal view"), icon: GalleryHorizontal },
    { key: "grid", label: t("Grid view"), icon: LayoutGrid },
  ];
  return (
    <div className="flex h-10 items-center gap-0.5 rounded-full border border-edge-soft bg-canvas/90 p-1">
      {options.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          aria-label={label}
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
            value === key ? "bg-ink text-canvas" : "text-ink-muted hover:text-ink"
          }`}
        >
          <Icon size={15} strokeWidth={2.2} />
        </button>
      ))}
    </div>
  );
}
