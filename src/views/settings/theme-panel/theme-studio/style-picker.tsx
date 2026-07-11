import { Check, Pencil } from "lucide-react";

const CARD_STYLES = [
  { id: "flat", name: "Flat", blurb: "Solid surfaces, clean edges." },
  { id: "glass", name: "Glass", blurb: "Backdrop blur, soft tint." },
  { id: "stremio", name: "Stremio", blurb: "Indigo accent rings." },
  { id: "minui", name: "Hairline", blurb: "Crisp thin borders." },
  { id: "custom", name: "Custom", blurb: "Click to edit your card CSS." },
];

const BUTTON_STYLES = [
  { id: "flat", name: "Flat", blurb: "Solid color, no gradient." },
  { id: "glossy", name: "Glossy", blurb: "Subtle highlight sheen." },
  { id: "minui", name: "Minimal", blurb: "Clean, no gloss." },
  { id: "custom", name: "Custom", blurb: "Style buttons via your CSS." },
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
  const list = kind === "card" ? CARD_STYLES : BUTTON_STYLES;
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {list.map((s) => {
        const active = value === s.id;
        const editable = kind === "card" && s.id === "custom" && !!onEditCustom;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              onChange(s.id);
              if (editable) onEditCustom?.();
            }}
            className={`relative flex flex-col gap-2 overflow-hidden rounded-lg border p-3 text-start transition-colors ${
              active
                ? "border-accent/80 bg-accent-soft"
                : "border-edge-soft bg-canvas/40 hover:border-edge hover:bg-white/[0.04]"
            }`}
          >
            <Swatch kind={kind} variant={s.id} active={active} />
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[13.5px] font-semibold text-ink">{s.name}</span>
                <span className="text-[11.5px] text-ink-subtle">{s.blurb}</span>
              </div>
              {active && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-canvas">
                  {editable ? <Pencil size={11} strokeWidth={2.6} /> : <Check size={12} strokeWidth={3} />}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Swatch({ kind, variant, active }: { kind: "card" | "button"; variant: string; active: boolean }) {
  if (variant === "custom") {
    return (
      <div
        className="flex aspect-[5/3] w-full items-center justify-center rounded-lg border-2 border-dashed"
        style={{
          borderColor: active ? "var(--color-accent)" : "var(--color-edge)",
          background: active ? "var(--color-accent-soft)" : "transparent",
        }}
      >
        <span
          className="font-mono text-[10.5px] font-semibold"
          style={{ color: active ? "var(--color-accent)" : "var(--color-ink-subtle)" }}
        >
          {kind === "card" ? "{ your-card }" : "{ your-button }"}
        </span>
      </div>
    );
  }
  if (kind === "card") {
    if (variant === "glass") {
      return (
        <div
          className="aspect-[5/3] w-full rounded-lg border"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.04))",
            borderColor: "rgba(255,255,255,0.18)",
            backdropFilter: "blur(8px)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)",
          }}
        />
      );
    }
    if (variant === "stremio") {
      return (
        <div
          className="aspect-[5/3] w-full rounded-lg ring-2"
          style={
            {
              background: "linear-gradient(135deg, #181434, #1f1b3f)",
              borderColor: "rgba(255,255,255,0.12)",
              "--tw-ring-color": active ? "var(--color-accent)" : "#7b5bf5",
            } as React.CSSProperties
          }
        />
      );
    }
    if (variant === "minui") {
      return (
        <div
          className="aspect-[5/3] w-full rounded-lg border"
          style={{
            background: "#ffffff",
            borderColor: "rgba(15,15,18,0.16)",
            boxShadow: "0 2px 6px -2px rgba(15,15,18,0.10), inset 0 1px 0 rgba(255,255,255,0.7)",
          }}
        />
      );
    }
    return (
      <div
        className="aspect-[5/3] w-full rounded-lg border border-edge-soft"
        style={{ background: "var(--color-elevated)" }}
      />
    );
  }
  if (variant === "glossy") {
    return (
      <div className="flex aspect-[5/3] w-full items-center justify-center">
        <div
          className="rounded-full px-4 py-2 text-[12px] font-semibold"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0) 55%), var(--color-accent)",
            color: "#fff",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5), 0 6px 18px -6px rgba(0,0,0,0.45)",
          }}
        >
          Button
        </div>
      </div>
    );
  }
  if (variant === "minui") {
    return (
      <div className="flex aspect-[5/3] w-full items-center justify-center">
        <div
          className="rounded-full border px-4 py-2 text-[12px] font-semibold"
          style={{
            background: "#ffffff",
            color: "#0a0a0c",
            borderColor: "rgba(15,15,18,0.16)",
            boxShadow: "0 2px 6px -2px rgba(15,15,18,0.10)",
          }}
        >
          Button
        </div>
      </div>
    );
  }
  return (
    <div className="flex aspect-[5/3] w-full items-center justify-center">
      <div
        className="rounded-full px-4 py-2 text-[12px] font-semibold"
        style={{ background: "var(--color-accent)", color: "#fff" }}
      >
        Button
      </div>
    </div>
  );
}
