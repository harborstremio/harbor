import { RotateCcw, Trash2 } from "../icons";
import { useEffect, useRef, useState } from "react";
import { applyCustomColorsPreview, CustomColors, type FontPairId } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { SettingGroup, SettingRow } from "../kit";
import { ROW_DESC } from "../shared";
import { usePageActions } from "../page-actions";
import { ColorPopoverTrigger } from "../color-picker";

const COLOR_FIELDS: Array<{ key: keyof CustomColors; label: string; hint: string; group: string }> = [
  { key: "canvas", label: "Background", hint: "Page base.", group: "Surfaces" },
  { key: "surface", label: "Surface", hint: "Slightly lighter than background.", group: "Surfaces" },
  { key: "elevated", label: "Elevated", hint: "Cards, panels.", group: "Surfaces" },
  { key: "raised", label: "Raised", hint: "Highlighted blocks.", group: "Surfaces" },
  { key: "ink", label: "Text", hint: "Primary copy.", group: "Text" },
  { key: "inkMuted", label: "Muted text", hint: "Secondary copy.", group: "Text" },
  { key: "inkSubtle", label: "Subtle text", hint: "Captions, eyebrows.", group: "Text" },
  { key: "edge", label: "Border", hint: "Used at 55% / 25% alpha.", group: "Lines" },
  { key: "accent", label: "Accent", hint: "Highlight, progress.", group: "Accents" },
  { key: "danger", label: "Danger", hint: "Errors, destructive.", group: "Accents" },
];

export function CustomEditor({
  seed,
  fontPair,
  onSave,
  canDelete,
  onDelete,
}: {
  seed: CustomColors;
  fontPair: FontPairId;
  onSave: (c: CustomColors) => void;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState<CustomColors>(seed);
  const live = useRef({ draft, seed, onSave, onDelete });
  live.current = { draft, seed, onSave, onDelete };

  useEffect(() => {
    applyCustomColorsPreview(draft, fontPair);
  }, [draft, fontPair]);

  usePageActions([
    ...(canDelete
      ? [
          {
            id: "theme-custom-delete",
            label: "Delete",
            tone: "danger" as const,
            icon: <Trash2 size={18} strokeWidth={2.2} />,
            onSelect: () => live.current.onDelete(),
          },
        ]
      : []),
    {
      id: "theme-custom-reset",
      label: "Reset",
      icon: <RotateCcw size={18} strokeWidth={2.2} />,
      onSelect: () => setDraft(live.current.seed),
    },
    {
      id: "theme-custom-save",
      label: "Save",
      tone: "primary" as const,
      onSelect: () => live.current.onSave(live.current.draft),
    },
  ]);

  const groups = COLOR_FIELDS.reduce<Record<string, typeof COLOR_FIELDS>>((acc, f) => {
    (acc[f.group] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div className="flex flex-col gap-5">
        {Object.entries(groups).map(([groupName, fields]) => (
          <SettingGroup key={groupName} label={t(groupName)}>
            {fields.map((f) => (
              <ColorRow
                key={f.key}
                label={t(f.label)}
                hint={t(f.hint)}
                value={draft[f.key]}
                onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))}
              />
            ))}
          </SettingGroup>
        ))}
      </div>

      <p className={`max-w-[70ch] ${ROW_DESC}`}>
        {t("Live preview is on. Save keeps what you've picked as your Custom theme. Reset reverts the editor to the saved palette.")}
      </p>
    </div>
  );
}

function ColorRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <SettingRow label={label} desc={hint}>
      <ColorPopoverTrigger
        value={value}
        onChange={onChange}
        label={value.toUpperCase()}
        align="right"
        direction="down"
        portal
        highlighted
      />
    </SettingRow>
  );
}
