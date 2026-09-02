import { LayoutGrid, LayoutTemplate, Pencil, RotateCcw, Save, Undo2 } from "lucide-react";
import type { PlayerChromeConfig, ThemeId } from "@/lib/player-chrome";
import { useT } from "@/lib/i18n";
import { Segmented } from "../shared";
import { SettingRow } from "../kit";
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
      icon={<LayoutTemplate size={16} strokeWidth={1.9} />}
      label={t("Edit player layout")}
      desc={t("A live preview of your player. Open the editor to move, hide, or reorder any control.")}
      tip={t("The editor is a working copy of the player. Click any control on it to move, resize, restyle or hide that control.")}
    >
      <div className="flex w-full flex-col gap-3">
        <div className="relative h-[188px] w-full overflow-hidden rounded-md bg-canvas">
          <ChromeMiniPreview theme={theme} config={config} />
        </div>
        <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <span className="min-w-0 text-[12.5px] leading-relaxed text-ink-subtle">
            {activeProfileName ? (
              <>
                {t("Profile")} <span className="text-ink-muted">{activeProfileName}</span> ·{" "}
              </>
            ) : null}
            {visibleCount} {t("visible")}
            {hiddenCount > 0 ? t(", {hiddenCount} hidden", { hiddenCount: String(hiddenCount) }) : ""} ·{" "}
            {t("{themeName} theme", { themeName: themeName })}
          </span>
          <button
            type="button"
            onClick={onOpen}
            aria-label={t("Edit player layout")}
            className="harbor-press-pop flex h-9 shrink-0 items-center gap-2 rounded-md bg-ink px-4 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
          >
            <Pencil size={13} strokeWidth={2.4} />
            {t("Edit layout")}
          </button>
        </div>
      </div>
    </SettingRow>
  );
}

export function ThemeTabs({ value, onChange }: { value: ThemeId; onChange: (v: ThemeId) => void }) {
  const t = useT();
  return (
    <SettingRow
      icon={<LayoutGrid size={16} strokeWidth={1.9} />}
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

export function FooterBar({
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
  const t = useT();
  const status = justSaved
    ? t("Saved")
    : dirty
      ? t("Unsaved changes to your layout, time format and volume style.")
      : t("Layout, time format and volume style apply when you save.");
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-md bg-elevated px-4 py-3.5">
        <span
          className={`min-w-0 text-[12.5px] leading-relaxed ${
            justSaved ? "text-accent" : "text-ink-subtle"
          }`}
        >
          {status}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onDiscard}
            disabled={!dirty}
            className="harbor-press-pop flex h-9 items-center gap-2 rounded-md bg-canvas px-4 text-[12.5px] font-semibold text-ink-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Undo2 size={13} strokeWidth={2.4} />
            {t("Discard changes")}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!dirty}
            className={`harbor-press-pop flex h-9 items-center gap-2 rounded-md px-4 text-[12.5px] font-semibold transition-opacity ${
              justSaved
                ? "bg-canvas text-accent"
                : dirty
                  ? "bg-ink text-canvas hover:opacity-90"
                  : "cursor-not-allowed bg-canvas text-ink-subtle opacity-50"
            }`}
          >
            <Save size={13} strokeWidth={2.4} />
            {justSaved ? t("Saved") : t("Save changes")}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-md bg-elevated px-4 py-3.5">
        <span className="min-w-0 text-[12.5px] leading-relaxed text-ink-subtle">
          {t("Puts every control, icon and option on this player style back the way it shipped.")}
        </span>
        <button
          type="button"
          onClick={onResetAll}
          className={`harbor-press-pop flex h-9 shrink-0 items-center gap-2 rounded-md px-4 text-[12.5px] font-semibold transition-colors ${
            confirmingReset
              ? "bg-danger text-white"
              : "bg-canvas text-ink-muted hover:text-ink"
          }`}
        >
          <RotateCcw size={13} strokeWidth={2.4} />
          {confirmingReset ? t("Confirm full reset") : t("Reset all to default")}
        </button>
      </div>
    </div>
  );
}
