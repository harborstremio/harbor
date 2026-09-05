import type { CustomColors } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { ColorPopover } from "./controls/color-popover";
import { SwatchField } from "./controls/swatch-field";

const SURFACES: Array<{ key: keyof CustomColors; label: string }> = [
  { key: "canvas", label: "Canvas" },
  { key: "surface", label: "Surface" },
  { key: "elevated", label: "Elevated" },
  { key: "raised", label: "Raised" },
];

const INK: Array<{ key: keyof CustomColors; sample: string; cls: string }> = [
  { key: "ink", sample: "Primary text you read", cls: "text-[16.5px] font-medium leading-[24px]" },
  { key: "inkMuted", sample: "Secondary copy sits here", cls: "text-[15.5px] leading-[22px]" },
  { key: "inkSubtle", sample: "Captions and quiet hints", cls: "text-[15.5px] leading-[22px]" },
];

export function ColorsGrid({
  colors,
  onChange,
}: {
  colors: CustomColors;
  onChange: (next: CustomColors) => void;
}) {
  const t = useT();
  const set = (key: keyof CustomColors, hex: string) => onChange({ ...colors, [key]: hex });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-24 w-full overflow-hidden rounded-md ring-1 ring-edge-soft">
        {SURFACES.map((s) => (
          <SwatchField
            key={s.key}
            value={colors[s.key]}
            onChange={(v) => set(s.key, v)}
            className="flex-1"
          >
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 px-2 py-1.5 text-[13px] font-extrabold uppercase leading-[18px] tracking-[0.72px]"
              style={{ color: "#ffffff", mixBlendMode: "difference" }}
            >
              {t(s.label)}
            </span>
          </SwatchField>
        ))}
      </div>

      <div
        className="flex flex-col gap-1 rounded-md p-3.5 ring-1 ring-edge-soft"
        style={{ background: colors.canvas }}
      >
        {INK.map((l) => (
          <ColorPopover key={l.key} value={colors[l.key]} onChange={(v) => set(l.key, v)}>
            {(open) => (
              <span
                className={`block truncate rounded-md px-1.5 py-2.5 transition-shadow ${l.cls} ${
                  open ? "ring-2 ring-accent" : "ring-1 ring-transparent hover:ring-edge/40"
                }`}
                style={{ color: colors[l.key] }}
              >
                {t(l.sample)}
              </span>
            )}
          </ColorPopover>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <div className="flex flex-col gap-1.5">
          <SwatchField
            value={colors.accent}
            onChange={(v) => set("accent", v)}
            className="h-14 rounded-md"
          />
          <span className="text-[15.5px] leading-[22px] text-ink-subtle">{t("Accent")}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <SwatchField
            value={colors.danger}
            onChange={(v) => set("danger", v)}
            className="h-14 rounded-md"
          />
          <span className="text-[15.5px] leading-[22px] text-ink-subtle">{t("Danger")}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <ColorPopover
            value={colors.edge}
            onChange={(v) => set("edge", v)}
            className="h-14 overflow-hidden rounded-md ring-1 ring-edge-soft"
          >
            {(open) => (
              <span
                className={`flex h-full w-full items-center justify-center gap-2 ${open ? "ring-2 ring-inset ring-accent" : ""}`}
                style={{ background: colors.canvas }}
              >
                <span className="h-8 w-px" style={{ background: colors.edge }} />
                <span className="h-px w-8" style={{ background: colors.edge }} />
              </span>
            )}
          </ColorPopover>
          <span className="text-[15.5px] leading-[22px] text-ink-subtle">{t("Border")}</span>
        </div>
      </div>
    </div>
  );
}
