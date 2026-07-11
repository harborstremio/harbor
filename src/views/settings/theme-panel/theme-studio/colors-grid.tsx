import type { CustomColors } from "@/lib/theme";

import { ColorPopoverTrigger } from "../../color-picker";

const FIELDS: Array<{ key: keyof CustomColors; label: string; hint: string }> = [
  { key: "canvas", label: "Background", hint: "Page base." },
  { key: "surface", label: "Surface", hint: "Cards, panels." },
  { key: "elevated", label: "Elevated", hint: "Modals, dropdowns." },
  { key: "raised", label: "Raised", hint: "Hover state." },
  { key: "ink", label: "Text", hint: "Primary copy." },
  { key: "inkMuted", label: "Muted text", hint: "Secondary copy." },
  { key: "inkSubtle", label: "Subtle text", hint: "Captions, hints." },
  { key: "edge", label: "Border", hint: "Lines, dividers." },
  { key: "accent", label: "Accent", hint: "Highlights, links." },
  { key: "danger", label: "Danger", hint: "Errors, destructive." },
];

export function ColorsGrid({ colors, onChange }: { colors: CustomColors; onChange: (next: CustomColors) => void }) {
  return (
    <div className="-mx-1 flex flex-col">
      {FIELDS.map((f) => (
        <div
          key={f.key}
          className="flex items-center justify-between gap-3 rounded-lg px-1 py-2.5 transition-colors hover:bg-white/[0.03]"
        >
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[14px] font-medium text-ink">{f.label}</span>
            <span className="text-[12px] text-ink-subtle">{f.hint}</span>
          </div>
          <ColorPopoverTrigger
            value={colors[f.key]}
            onChange={(v) => onChange({ ...colors, [f.key]: v })}
            label={colors[f.key].toUpperCase()}
            align="right"
            direction="down"
            highlighted
          />
        </div>
      ))}
    </div>
  );
}
