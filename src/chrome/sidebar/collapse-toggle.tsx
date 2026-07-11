import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

export function CollapseToggle({ collapsed }: { collapsed: boolean }) {
  const { update } = useSettings();
  const t = useT();
  const label = collapsed ? t("Expand sidebar") : t("Collapse sidebar");
  return (
    <button
      type="button"
      onClick={() => update({ sidebarCollapsed: !collapsed })}
      aria-label={label}
      aria-pressed={collapsed}
      title={label}
      className={`flex h-9 items-center justify-center gap-2.5 rounded-lg text-ink-subtle transition-colors hover:bg-elevated/60 hover:text-ink-muted ${
        collapsed ? "w-9" : "w-full lg:justify-start lg:px-3"
      }`}
    >
      {collapsed ? (
        <PanelLeftOpen size={17} strokeWidth={1.8} className="dir-icon" />
      ) : (
        <PanelLeftClose size={17} strokeWidth={1.8} className="dir-icon" />
      )}
      {!collapsed && <span className="hidden text-[13px] font-medium lg:inline">{t("Collapse")}</span>}
    </button>
  );
}
