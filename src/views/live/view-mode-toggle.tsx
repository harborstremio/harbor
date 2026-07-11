import { useT } from "@/lib/i18n";
import { isWindowsDesktop } from "@/lib/platform";
import { Grid2x2, Home, LayoutGrid, ListTree } from "lucide-react";

export type ViewMode = "home" | "grid" | "guide" | "multiview";

export function ViewModeToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  const t = useT();
  return (
    <div className="flex h-11 shrink-0 items-center gap-0.5 rounded-xl border border-edge-soft/55 bg-elevated p-1">
      <ToggleButton
        active={mode === "home"}
        onClick={() => onChange("home")}
        icon={<Home size={14} strokeWidth={2} />}
        label={t("Home")}
      />
      <ToggleButton
        active={mode === "grid"}
        onClick={() => onChange("grid")}
        icon={<LayoutGrid size={14} strokeWidth={2} />}
        label={t("Grid")}
      />
      <ToggleButton
        active={mode === "guide"}
        onClick={() => onChange("guide")}
        icon={<ListTree size={14} strokeWidth={2} />}
        label={t("Guide")}
      />
      {isWindowsDesktop() && (
        <ToggleButton
          active={mode === "multiview"}
          onClick={() => onChange("multiview")}
          icon={<Grid2x2 size={14} strokeWidth={2} />}
          label={t("Multiview")}
        />
      )}
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-full items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition-colors ${
        active ? "bg-ink text-canvas" : "text-ink-muted hover:bg-raised hover:text-ink"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
