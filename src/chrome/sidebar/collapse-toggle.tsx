import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";

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
      className={`flex h-12 items-center justify-center gap-2.5 rounded-lg text-ink-subtle transition-colors hover:bg-elevated/60 hover:text-ink-muted ${
        collapsed ? "w-12" : "w-full lg:justify-start lg:px-3"
      }`}
    >
      {collapsed ? (
        <PanelLeftOpen size={22} strokeWidth={1.8} className="dir-icon" />
      ) : (
        <PanelLeftClose size={22} strokeWidth={1.8} className="dir-icon" />
      )}
      {!collapsed && <span className="hidden text-[16px] font-medium lg:inline">{t("Collapse")}</span>}
    </button>
  );
}
