import { ArrowLeft, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { applyCustomColorsPreview, CustomColors, type FontPairId } from "@/lib/theme";
import { useT } from "@/lib/i18n";
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

  useEffect(() => {
    applyCustomColorsPreview(draft, fontPair);
  }, [draft, fontPair]);

  const groups = COLOR_FIELDS.reduce<Record<string, typeof COLOR_FIELDS>>((acc, f) => {
    (acc[f.group] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => onSave(draft)}
 className="flex items-center gap-2 rounded-md bg-canvas px-4 py-2 text-[12.5px] font-semibold text-ink-muted transition-colors hover:bg-surface hover:text-ink"
        >
          <ArrowLeft size={14} strokeWidth={2.4} className="dir-icon" />
          {t("Done")}
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDraft(seed)}
 className="flex items-center gap-2 rounded-md bg-canvas px-4 py-2 text-[12.5px] font-semibold text-ink-muted transition-colors hover:bg-surface hover:text-ink"
          >
            <RotateCcw size={14} strokeWidth={2.2} />
            {t("Reset")}
          </button>
          {canDelete && (
            <button
              onClick={onDelete}
              className="flex items-center gap-2 rounded-full border border-danger/30 bg-danger/10 px-4 py-2 text-[12.5px] font-semibold text-danger transition-colors hover:bg-danger/15"
            >
              <Trash2 size={14} strokeWidth={2.2} />
              {t("Delete")}
            </button>
          )}
          <button
            onClick={() => onSave(draft)}
            className="rounded-full bg-ink px-5 py-2 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
          >
            {t("Save")}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {Object.entries(groups).map(([groupName, fields]) => (
          <div key={groupName} className="flex flex-col gap-3">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-ink-subtle">
              {t(groupName)}
            </span>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {fields.map((f) => (
                <ColorRow
                  key={f.key}
                  label={t(f.label)}
                  hint={t(f.hint)}
                  value={draft[f.key]}
                  onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11.5px] leading-relaxed text-ink-subtle">
        {t("Live preview is on. Done and Save both keep what you've picked as your Custom theme. Reset reverts the editor to the saved palette.")}
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
 <div className="flex items-center justify-between gap-3 rounded-md bg-elevated px-4 py-3 transition-colors hover:bg-raised">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[13px] font-semibold text-ink">{label}</span>
        <span className="text-[11.5px] text-ink-subtle">{hint}</span>
      </div>
      <ColorPopoverTrigger
        value={value}
        onChange={onChange}
        label={value.toUpperCase()}
        align="right"
        direction="down"
        highlighted
      />
    </div>
  );
}
