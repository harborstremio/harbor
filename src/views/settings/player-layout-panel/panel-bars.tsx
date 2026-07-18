import { Pencil, RotateCcw, Save, Undo2 } from "lucide-react";
import type { ThemeId } from "@/lib/player-chrome";
import { useT } from "@/lib/i18n";

export function EditLayoutCard({
  theme,
  visibleCount,
  hiddenCount,
  activeProfileName,
  onOpen,
}: {
  theme: ThemeId;
  visibleCount: number;
  hiddenCount: number;
  activeProfileName: string | null;
  onOpen: () => void;
}) {
  const t = useT();
  const themeName = theme === "stremio" ? t("Stremio") : t("Default");
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-edge-soft bg-canvas/40 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1.5">
        <h3 className="text-[14.5px] font-semibold text-ink">{t("Player layout")}</h3>
        <p className="text-[12.5px] leading-relaxed text-ink-muted">
          {t("Click any control in the live preview to move, hide, or reorder it.")}
        </p>
        <p className="text-[11.5px] text-ink-subtle">
          {activeProfileName ? (
            <>
              {t("Profile")} <span className="text-ink-muted">{activeProfileName}</span> ·{" "}
              {visibleCount} {t("visible")}
            </>
          ) : (
            <>
              {visibleCount} {t("visible")}
            </>
          )}
          {hiddenCount > 0 ? t(", {hiddenCount} hidden", { hiddenCount: String(hiddenCount) }) : ""}{" "}
          {t("on the {themeName} theme.", { themeName: themeName })}
        </p>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="flex shrink-0 items-center gap-2 self-start rounded-xl bg-ink px-5 py-3 text-[13.5px] font-semibold text-canvas transition-all duration-150 hover:scale-[1.02] active:scale-[0.97] sm:self-auto"
      >
        <Pencil size={14} strokeWidth={2.4} />
        {t("Edit player layout")}
      </button>
    </div>
  );
}

export function ThemeTabs({ value, onChange }: { value: ThemeId; onChange: (v: ThemeId) => void }) {
  const t = useT();
  const tabs: Array<{ id: ThemeId; label: string; sub: string }> = [
    { id: "default", label: t("Default"), sub: t("Harbor's native player chrome.") },
    { id: "stremio", label: t("Stremio"), sub: t("Familiar Stremio button order.") },
  ];
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-edge-soft bg-canvas/40 p-1.5">
      {tabs.map((t) => {
        const selected = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`flex flex-1 flex-col items-start gap-0.5 rounded-xl px-4 py-2.5 text-start transition-colors ${
              selected
                ? "bg-elevated text-ink shadow-[inset_0_0_0_1px_var(--color-edge)]"
                : "text-ink-muted hover:bg-elevated/60 hover:text-ink"
            }`}
          >
            <span className="text-[13.5px] font-semibold">{t.label}</span>
            <span className={`text-[11.5px] ${selected ? "text-ink-muted" : "text-ink-subtle"}`}>
              {t.sub}
            </span>
          </button>
        );
      })}
    </div>
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
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-edge-soft bg-canvas/40 px-5 py-4">
      <button
        type="button"
        onClick={onResetAll}
        className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition-colors ${
          confirmingReset ? "bg-danger text-white" : "text-ink-muted hover:bg-raised hover:text-ink"
        }`}
      >
        <RotateCcw size={12.5} strokeWidth={2.4} />
        {confirmingReset ? t("Confirm full reset") : t("Reset all to default")}
      </button>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onDiscard}
          disabled={!dirty}
          className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-semibold text-ink-muted transition-colors hover:bg-raised hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Undo2 size={12.5} strokeWidth={2.4} />
          {t("Discard changes")}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty}
          className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-semibold transition-all duration-150 active:scale-[0.97] ${
            justSaved
              ? "bg-accent/15 text-accent"
              : dirty
                ? "bg-ink text-canvas hover:scale-[1.02]"
                : "cursor-not-allowed bg-raised text-ink-subtle opacity-60"
          }`}
        >
          <Save size={12.5} strokeWidth={2.4} />
          {justSaved ? t("Saved") : t("Save changes")}
        </button>
      </div>
    </div>
  );
}
