import { Pencil } from "lucide-react";
import { useT } from "@/lib/i18n";
import { PickCard, PickGrid } from "./controls/pick-grid";

const CARD_STYLES = [
  { id: "flat", name: "Flat" },
  { id: "glass", name: "Glass" },
  { id: "stremio", name: "Stremio" },
  { id: "minui", name: "Hairline" },
  { id: "custom", name: "Custom" },
];

const BUTTON_STYLES = [
  { id: "flat", name: "Flat" },
  { id: "glossy", name: "Glossy" },
  { id: "minui", name: "Minimal" },
  { id: "custom", name: "Custom" },
];

export function StylePicker({
  kind,
  value,
  onChange,
  onEditCustom,
}: {
  kind: "card" | "button";
  value: string;
  onChange: (v: string) => void;
  onEditCustom?: () => void;
}) {
  const t = useT();
  const list = kind === "card" ? CARD_STYLES : BUTTON_STYLES;
  return (
    <PickGrid cols={2}>
      {list.map((s) => {
        const editable = kind === "card" && s.id === "custom" && !!onEditCustom;
        return (
          <PickCard
            key={s.id}
            selected={value === s.id}
            onSelect={() => {
              onChange(s.id);
              if (editable) onEditCustom?.();
            }}
            label={t(s.name)}
            badgeIcon={editable ? <Pencil size={12} strokeWidth={2.4} /> : undefined}
          >
            <div className="px-3 pt-3">
              <Swatch kind={kind} variant={s.id} />
            </div>
          </PickCard>
        );
      })}
    </PickGrid>
  );
}

function Swatch({ kind, variant }: { kind: "card" | "button"; variant: string }) {
  const t = useT();
  if (variant === "custom") {
    return (
      <div className="flex aspect-[5/3] w-full items-center justify-center rounded-md border-2 border-dashed border-edge">
        <span className="font-mono text-[10.5px] font-semibold text-ink-subtle">
          {kind === "card" ? "{ your-card }" : "{ your-button }"}
        </span>
      </div>
    );
  }
  if (kind === "card") {
    if (variant === "glass") {
      return (
        <div
          className="aspect-[5/3] w-full rounded-md"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.04))",
            boxShadow:
              "inset 0 0 0 1px rgba(255,255,255,0.18), inset 0 1px 0 rgba(255,255,255,0.2)",
            backdropFilter: "blur(8px)",
          }}
        />
      );
    }
    if (variant === "stremio") {
      return (
        <div
          className="aspect-[5/3] w-full rounded-md ring-2 ring-[#7b5bf5]"
          style={{ background: "linear-gradient(135deg, #181434, #1f1b3f)" }}
        />
      );
    }
    if (variant === "minui") {
      return (
        <div
          className="aspect-[5/3] w-full rounded-md"
          style={{
            background: "#ffffff",
            boxShadow:
              "inset 0 0 0 1px rgba(15,15,18,0.16), 0 2px 6px -2px rgba(15,15,18,0.10), inset 0 1px 0 rgba(255,255,255,0.7)",
          }}
        />
      );
    }
    return <div className="aspect-[5/3] w-full rounded-md bg-elevated ring-1 ring-edge-soft" />;
  }
  if (variant === "glossy") {
    return (
      <div className="flex aspect-[5/3] w-full items-center justify-center">
        <div
          className="rounded-full px-4 py-2 text-[12.5px] font-semibold text-white"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0) 55%), var(--color-accent)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5), 0 6px 18px -6px rgba(0,0,0,0.45)",
          }}
        >
          {t("Button")}
        </div>
      </div>
    );
  }
  if (variant === "minui") {
    return (
      <div className="flex aspect-[5/3] w-full items-center justify-center">
        <div
          className="rounded-full px-4 py-2 text-[12.5px] font-semibold"
          style={{
            background: "#ffffff",
            color: "#0a0a0c",
            boxShadow: "inset 0 0 0 1px rgba(15,15,18,0.16), 0 2px 6px -2px rgba(15,15,18,0.10)",
          }}
        >
          {t("Button")}
        </div>
      </div>
    );
  }
  return (
    <div className="flex aspect-[5/3] w-full items-center justify-center">
      <div
        className="rounded-full px-4 py-2 text-[12.5px] font-semibold text-white"
        style={{ background: "var(--color-accent)" }}
      >
        {t("Button")}
      </div>
    </div>
  );
}
