import { THEME_PRESETS, type ThemePreset } from "@/lib/theme";

export function IdentityRow({
  name,
  blurb,
  onChange,
  onSeed,
}: {
  name: string;
  blurb: string;
  onChange: (patch: { name?: string; blurb?: string }) => void;
  onSeed: (theme: ThemePreset) => void;
}) {
  return (
    <>
      <div className="flex flex-col gap-3">
        <FieldInput
          label="Name"
          value={name}
          onChange={(v) => onChange({ name: v })}
          placeholder="My Harbor"
          required
        />
        <FieldInput
          label="Tagline"
          value={blurb}
          onChange={(v) => onChange({ blurb: v })}
          placeholder="One short line shown in the picker"
        />
      </div>
      <div className="mt-1 flex flex-col gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">Or start from</span>
        <div className="flex flex-wrap gap-2">
          {Object.values(THEME_PRESETS).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSeed(p)}
              className="flex h-10 items-center gap-1.5 rounded-md border border-edge-soft bg-canvas/50 px-3 text-[13.5px] font-medium text-ink-muted transition-colors hover:border-edge hover:bg-white/[0.04] hover:text-ink"
            >
              <span className="flex h-3.5 w-6 overflow-hidden rounded-sm ring-1 ring-edge-soft">
                {p.swatch.map((c, i) => (
                  <span key={i} className="flex-1" style={{ background: c }} />
                ))}
              </span>
              {p.name}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
        {label}
        {required && <span className="text-accent">*</span>}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-lg border border-edge-soft bg-canvas/60 px-3.5 text-[15px] text-ink placeholder:text-ink-subtle transition-colors focus:border-accent/70 focus:bg-canvas/80 focus:outline-none"
      />
    </label>
  );
}
