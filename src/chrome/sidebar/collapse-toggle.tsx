import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";

export function CollapseToggle({
  collapsed,
  retainLabels = false,
}: {
  collapsed: boolean;
  retainLabels?: boolean;
}) {
  const { update } = useSettings();
  const t = useT();
  const label = collapsed ? t("Expand sidebar") : t("Collapse sidebar");
  return (
    <button
      type="button"
      data-harbor-sidebar-toggle
      onClick={() => update({ sidebarCollapsed: !collapsed })}
      aria-label={label}
      aria-pressed={collapsed}
      title={label}
      className={`flex h-9 items-center justify-center gap-2.5 rounded-lg text-ink-subtle transition-colors hover:bg-elevated/60 hover:text-ink-muted ${
        collapsed ? "w-9" : "w-full lg:justify-start lg:px-3"
      }`}
    >
      <span data-harbor-sidebar-icon className="inline-flex shrink-0">
        {collapsed ? (
          <PanelLeftOpen size={17} strokeWidth={1.8} className="dir-icon" />
        ) : (
          <PanelLeftClose size={17} strokeWidth={1.8} className="dir-icon" />
        )}
      </span>
      {(!collapsed || retainLabels) && (
        <span
          data-harbor-sidebar-label
          aria-hidden={collapsed || undefined}
          className="hidden text-[13px] font-medium lg:inline"
        >
          {t("Collapse")}
        </span>
      )}
    </button>
  );
}
