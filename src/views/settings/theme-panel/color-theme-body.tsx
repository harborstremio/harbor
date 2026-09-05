import { Check, Pencil, Plus } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { tvFocus } from "@/lib/keyboard-navigation";
import { navOwnsFocus } from "@/lib/keyboard-navigation/geometry";
import {
  CustomColors,
  DEFAULT_CUSTOM_COLORS,
  THEME_PRESETS,
  type ActiveThemeId,
  type FontPairId,
} from "@/lib/theme";
import { useT } from "@/lib/i18n";
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
  const editorRef = useRef<HTMLDivElement>(null);
  const tileRef = useRef<HTMLButtonElement>(null);
  const ringRef = useRef(false);

  const showEditor = (next: boolean) => {
    const active = document.activeElement;
    ringRef.current = active instanceof HTMLElement && navOwnsFocus(active);
    setEditing(next);
  };

  useLayoutEffect(() => {
    if (!ringRef.current) return;
    const el = editing
      ? editorRef.current?.querySelector<HTMLElement>("button")
      : tileRef.current;
    if (el) tvFocus(el);
  }, [editing]);

  useEffect(() => {
    const handler = () => {
      showEditor(true);
      const el = document.getElementById("harbor-theme-editor-anchor");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener("harbor:open-theme-editor", handler);
    return () => window.removeEventListener("harbor:open-theme-editor", handler);
  }, []);

  if (editing) {
    return (
      <div id="harbor-theme-editor-anchor" ref={editorRef}>
        <CustomEditor
          seed={customColors ?? DEFAULT_CUSTOM_COLORS}
          fontPair={fontPair}
          onSave={(c) => {
            onSaveCustom(c);
            showEditor(false);
          }}
          canDelete={customColors != null}
          onDelete={() => {
            onClearCustom();
            showEditor(false);
          }}
        />
      </div>
    );
  }

  return (
    <div id="harbor-theme-editor-anchor" className="animate-fade-in grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      {Object.values(THEME_PRESETS).filter((p) => !LAYOUT_PRESET_IDS.has(p.id)).map((p) => {
        const active = activePreset === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={`group relative flex min-h-[168px] flex-col justify-end overflow-hidden rounded-[10px] border p-4 text-start transition ${
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
              <p className="text-[16.5px] font-semibold leading-[24px]" style={{ color: p.swatch[2] }}>
                {p.name}
              </p>
              <p
                className="mt-0.5 text-[15.5px] leading-[22px]"
                style={{ color: p.swatch[2], opacity: 0.7 }}
              >
                {p.blurb}
              </p>
            </div>
          </button>
        );
      })}
      <CustomTile
        active={activePreset === "custom"}
        custom={customColors}
        triggerRef={tileRef}
        onApply={() => {
          if (customColors) onSelect("custom");
          else showEditor(true);
        }}
        onEdit={() => showEditor(true)}
      />
    </div>
  );
}

function CustomTile({
  active,
  custom,
  triggerRef,
  onApply,
  onEdit,
}: {
  active: boolean;
  custom: CustomColors | null;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onApply: () => void;
  onEdit: () => void;
}) {
  const t = useT();
  if (!custom) {
    return (
      <button
        ref={triggerRef}
        onClick={onApply}
        className="group flex min-h-[168px] flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-edge bg-elevated p-4 text-ink-muted transition hover:border-edge hover:bg-elevated hover:text-ink"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-raised">
          <Plus size={20} strokeWidth={2.2} />
        </span>
        <p className="text-[16.5px] font-semibold leading-[24px]">{t("Custom")}</p>
        <p className="text-[15.5px] leading-[22px] text-ink-subtle">{t("Build your own palette")}</p>
      </button>
    );
  }
  return (
    <div
      className={`group relative flex min-h-[168px] flex-col justify-end overflow-hidden rounded-[10px] border p-4 text-start transition ${
        active ? "border-ink" : "border-edge-soft hover:border-edge"
      }`}
      style={{ background: custom.canvas }}
    >
      <button
        onClick={onApply}
        className="absolute inset-0 z-0 cursor-pointer"
        aria-label={t("Apply custom theme")}
      />
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
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        className="absolute end-2 bottom-2 z-10 flex h-11 w-11 items-center justify-center rounded-full border transition-colors"
        style={{
          background: custom.elevated,
          borderColor: custom.edge + "8c",
          color: custom.ink,
        }}
        aria-label={t("Edit custom theme")}
      >
        <Pencil size={16} strokeWidth={2.2} />
      </button>
      <div className="relative">
        <p className="text-[16.5px] font-semibold leading-[24px]" style={{ color: custom.ink }}>
          {t("Custom")}
        </p>
      </div>
    </div>
  );
}
