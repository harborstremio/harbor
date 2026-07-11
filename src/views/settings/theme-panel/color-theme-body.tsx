import { useT } from "@/lib/i18n";
import { CustomColors, DEFAULT_CUSTOM_COLORS, THEME_PRESETS, type ActiveThemeId, type FontPairId } from "@/lib/theme";
import { Check, Pencil, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { CustomEditor } from "./custom-editor";

const LAYOUT_PRESET_IDS = new Set(["crunch"]);

export function ColorThemeBody({
  activePreset,
  fontPair,
  customColors,
  onSelect,
  onSaveCustom,
  onClearCustom,
}: {
  activePreset: ActiveThemeId;
  fontPair: FontPairId;
  customColors: CustomColors | null;
  onSelect: (id: ActiveThemeId) => void;
  onSaveCustom: (c: CustomColors) => void;
  onClearCustom: () => void;
}) {
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const handler = () => {
      setEditing(true);
      const el = document.getElementById("harbor-theme-editor-anchor");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener("harbor:open-theme-editor", handler);
    return () => window.removeEventListener("harbor:open-theme-editor", handler);
  }, []);

  if (editing) {
    return (
      <div id="harbor-theme-editor-anchor">
        <CustomEditor
          seed={customColors ?? DEFAULT_CUSTOM_COLORS}
          fontPair={fontPair}
          onSave={(c) => {
            onSaveCustom(c);
            setEditing(false);
          }}
          canDelete={customColors != null}
          onDelete={() => {
            onClearCustom();
            setEditing(false);
          }}
        />
      </div>
    );
  }

  return (
    <div
      id="harbor-theme-editor-anchor"
      className="animate-fade-in grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4"
    >
      {Object.values(THEME_PRESETS)
        .filter((p) => !LAYOUT_PRESET_IDS.has(p.id))
        .map((p) => {
          const active = activePreset === p.id;
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className={`group relative flex h-[150px] flex-col justify-end overflow-hidden rounded-2xl border p-4 text-start transition-all ${
                active ? "border-ink" : "border-edge-soft hover:border-edge"
              }`}
              style={{ background: p.swatch[0] }}
            >
              <div
                className="absolute inset-x-0 top-0 h-2/5"
                style={{
                  background: `linear-gradient(180deg, ${p.swatch[1]}, ${p.swatch[0]})`,
                }}
              />
              <div
                className="absolute end-3 top-3 flex h-7 w-7 items-center justify-center rounded-full"
                style={{ background: p.swatch[2] }}
              >
                {active && <Check size={14} strokeWidth={3} style={{ color: p.swatch[0] }} />}
              </div>
              <div className="relative">
                <p className="text-[14.5px] font-semibold" style={{ color: p.swatch[2] }}>
                  {p.name}
                </p>
                <p className="mt-0.5 text-[11.5px]" style={{ color: p.swatch[2], opacity: 0.6 }}>
                  {p.blurb}
                </p>
              </div>
            </button>
          );
        })}
      <CustomTile
        active={activePreset === "custom"}
        custom={customColors}
        onApply={() => {
          if (customColors) onSelect("custom");
          else setEditing(true);
        }}
        onEdit={() => setEditing(true)}
      />
    </div>
  );
}

function CustomTile({
  active,
  custom,
  onApply,
  onEdit,
}: {
  active: boolean;
  custom: CustomColors | null;
  onApply: () => void;
  onEdit: () => void;
}) {
  const t = useT();
  if (!custom) {
    return (
      <button
        onClick={onApply}
        className="group flex h-[150px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-edge bg-elevated/20 p-4 text-ink-muted transition-all hover:border-edge hover:bg-elevated/40 hover:text-ink"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-elevated/60">
          <Plus size={18} strokeWidth={2.2} />
        </span>
        <p className="text-[14px] font-semibold">{t("Custom")}</p>
        <p className="text-[11.5px] text-ink-subtle">{t("Build your own palette")}</p>
      </button>
    );
  }
  return (
    <div
      className={`group relative flex h-[150px] flex-col justify-end overflow-hidden rounded-2xl border p-4 text-start transition-all ${
        active ? "border-ink" : "border-edge-soft hover:border-edge"
      }`}
      style={{ background: custom.canvas }}
    >
      <button onClick={onApply} className="absolute inset-0 z-0 cursor-pointer" aria-label={t("Apply custom theme")} />
      <div
        className="absolute inset-x-0 top-0 h-2/5"
        style={{ background: `linear-gradient(180deg, ${custom.raised}, ${custom.canvas})` }}
      />
      <div
        className="absolute end-3 top-3 flex h-7 w-7 items-center justify-center rounded-full"
        style={{ background: custom.ink }}
      >
        {active && <Check size={14} strokeWidth={3} style={{ color: custom.canvas }} />}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        className="absolute end-3 bottom-3 z-10 flex h-7 w-7 items-center justify-center rounded-full border transition-colors"
        style={{
          background: custom.elevated,
          borderColor: custom.edge + "8c",
          color: custom.ink,
        }}
        aria-label={t("Edit custom theme")}
      >
        <Pencil size={12} strokeWidth={2.2} />
      </button>
      <div className="relative">
        <p className="text-[14.5px] font-semibold" style={{ color: custom.ink }}>
          {t("Custom")}
        </p>
      </div>
    </div>
  );
}
