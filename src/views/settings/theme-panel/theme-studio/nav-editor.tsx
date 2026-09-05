import { RotateCcw } from "lucide-react";
import { useState } from "react";
import {
  NAV_ITEMS,
  effectiveNavOrder,
  moveNavItem,
  renameNavItem,
  resetNavCustomization,
  toggleNavHidden,
  type NavItem,
} from "@/chrome/nav-items";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import type { ThemeLayout } from "@/lib/theme";
import { NavRow } from "./nav-editor/nav-row";

const ICON_ONLY: ReadonlySet<ThemeLayout> = new Set(["minui"]);

export function NavEditor({ layout }: { layout: ThemeLayout }) {
  const { settings, update } = useSettings();
  const t = useT();
  const cfg = settings.navCustomization;
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; pos: "before" | "after" } | null>(null);

  const byId = new Map<string, NavItem>(NAV_ITEMS.map((it) => [it.id, it]));
  const rows = effectiveNavOrder(cfg).map((id) => byId.get(id)!);
  const renamable = !ICON_ONLY.has(layout);
  const hasChanges =
    cfg.order.length > 0 || cfg.hidden.length > 0 || Object.keys(cfg.renamed).length > 0;

  const moveTo = (id: string, targetId: string, pos: "before" | "after") =>
    update({ navCustomization: moveNavItem(cfg, id, targetId, pos) });

  const commitDrop = (targetId: string, pos: "before" | "after") => {
    if (dragId && dragId !== targetId) {
      update({ navCustomization: moveNavItem(cfg, dragId, targetId, pos) });
    }
    setDragId(null);
    setDrop(null);
  };

  return (
    <div className="flex flex-col gap-2.5">
      {!renamable && (
        <p className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-subtle">
          {t(
            "This layout shows icons only, so renaming is off here. Reorder and hide still apply.",
          )}
        </p>
      )}
      {hasChanges && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => update({ navCustomization: resetNavCustomization() })}
            className="flex h-11 items-center gap-1.5 rounded-md bg-canvas px-3 text-[15.5px] font-medium text-ink-muted transition-colors hover:bg-surface hover:text-ink"
          >
            <RotateCcw size={16} strokeWidth={2.2} />
            {t("Reset")}
          </button>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        {rows.map((item, i) => (
          <NavRow
            key={item.id}
            item={item}
            name={cfg.renamed[item.id] ?? t(item.label)}
            hidden={cfg.hidden.includes(item.id)}
            renamable={renamable}
            isRenamed={item.id in cfg.renamed}
            dragging={dragId === item.id}
            dropBefore={drop?.id === item.id && drop.pos === "before" && dragId !== item.id}
            dropAfter={drop?.id === item.id && drop.pos === "after" && dragId !== item.id}
            isFirst={i === 0}
            isLast={i === rows.length - 1}
            onRename={(label) => update({ navCustomization: renameNavItem(cfg, item.id, label) })}
            onToggleHidden={() => update({ navCustomization: toggleNavHidden(cfg, item.id) })}
            onMoveUp={() => moveTo(item.id, rows[i - 1].id, "before")}
            onMoveDown={() => moveTo(item.id, rows[i + 1].id, "after")}
            onDragStart={() => setDragId(item.id)}
            onOver={(pos) => setDrop({ id: item.id, pos })}
            onDropItem={(pos) => commitDrop(item.id, pos)}
            onDragEnd={() => {
              setDragId(null);
              setDrop(null);
            }}
          />
        ))}
      </div>
    </div>
  );
}
