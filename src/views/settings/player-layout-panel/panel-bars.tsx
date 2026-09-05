import { LayoutGrid, LayoutTemplate, Pencil, RotateCcw, Save, Undo2 } from "lucide-react";
import type { PlayerChromeConfig, ThemeId } from "@/lib/player-chrome";
import { useT } from "@/lib/i18n";
import { Segmented } from "../shared";
import { ROW_DESC, SettingRow } from "../kit";
import { usePageActions } from "../page-actions";
import { SButton } from "../ui";
import { ChromeMiniPreview } from "./chrome-mini-preview";

export function EditLayoutCard({
  theme,
  config,
  visibleCount,
  hiddenCount,
  activeProfileName,
  onOpen,
}: {
  theme: ThemeId;
  config: PlayerChromeConfig;
  visibleCount: number;
  hiddenCount: number;
  activeProfileName: string | null;
  onOpen: () => void;
}) {
  const t = useT();
  const themeName = theme === "stremio" ? t("Stremio") : t("Default");
  return (
    <SettingRow
      wide
      icon={<LayoutTemplate size={18} strokeWidth={1.9} />}
      label={t("Edit player layout")}
      desc={t("A live preview of your player. Open the editor to move, hide, or reorder any control.")}
      tip={t("The editor is a working copy of the player. Click any control on it to move, resize, restyle or hide that control.")}
    >
      <div className="flex w-full flex-col gap-3">
        <div className="relative h-[188px] w-full overflow-hidden rounded-md bg-canvas">
          <ChromeMiniPreview theme={theme} config={config} />
        </div>
        <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
          <span className={`min-w-0 max-w-[66ch] ${ROW_DESC}`}>
            {activeProfileName ? (
              <>
                {t("Profile")} <span className="text-ink">{activeProfileName}</span> ·{" "}
              </>
            ) : null}
            {visibleCount} {t("visible")}
            {hiddenCount > 0 ? t(", {hiddenCount} hidden", { hiddenCount: String(hiddenCount) }) : ""} ·{" "}
            {t("{themeName} theme", { themeName: themeName })}
          </span>
          <SButton variant="primary" onClick={onOpen}>
            <Pencil size={16} strokeWidth={2.4} />
            {t("Edit layout")}
          </SButton>
        </div>
      </div>
    </SettingRow>
  );
}

export function ThemeTabs({ value, onChange }: { value: ThemeId; onChange: (v: ThemeId) => void }) {
  const t = useT();
  return (
    <SettingRow
      icon={<LayoutGrid size={18} strokeWidth={1.9} />}
      label={t("Player style")}
      desc={
        value === "stremio" ? t("Familiar Stremio button order.") : t("Harbor's native player chrome.")
      }
      tip={t("Each style keeps its own arrangement, icons and profiles, so switching back and forth never loses work.")}
    >
      <Segmented
        value={value}
        options={[
          { value: "default", label: "Default" },
          { value: "stremio", label: "Stremio" },
        ]}
        onChange={onChange}
      />
    </SettingRow>
  );
}

export function usePlayerLayoutPageActions({
  dirty,
  justSaved,
  confirmingReset,
  onSave,
  onDiscard,
  onResetAll,
}: {
  dirty: boolean;
  justSaved: boolean;
  confirmingReset: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onResetAll: () => void;
}) {
  const note = justSaved
    ? "Saved"
    : dirty
      ? "Unsaved changes to your layout, time format and volume style."
      : "Layout, time format and volume style apply when you save.";

  usePageActions(
    [
      {
        id: "player-layout-reset",
        label: confirmingReset ? "Confirm full reset" : "Reset all to default",
        tone: "danger",
        onSelect: onResetAll,
        icon: <RotateCcw size={16} strokeWidth={2.4} />,
      },
      {
        id: "player-layout-discard",
        label: "Discard changes",
        tone: "quiet",
        disabled: !dirty,
        onSelect: onDiscard,
        icon: <Undo2 size={16} strokeWidth={2.4} />,
      },
      {
        id: "player-layout-save",
        label: justSaved ? "Saved" : "Save changes",
        tone: "primary",
        disabled: !dirty,
        onSelect: onSave,
        icon: <Save size={16} strokeWidth={2.4} />,
      },
    ],
    note,
  );
}
