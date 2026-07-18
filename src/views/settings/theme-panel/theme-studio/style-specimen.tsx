import { customColorsToTokens, type CustomColors } from "@/lib/theme";

export function StyleSpecimen({ colors }: { colors: CustomColors }) {
  return (
    <div
      style={customColorsToTokens(colors) as React.CSSProperties}
      className="overflow-hidden rounded-2xl border border-edge-soft"
    >
      <div className="bg-canvas p-4">
        <div className="flex items-stretch gap-3">
          <button className="group flex w-24 shrink-0 flex-col gap-2 text-start">
            <div className="relative transition-transform duration-300 group-hover:-translate-y-1">
              <div className="flex aspect-[2/3] w-full items-end rounded-xl bg-elevated p-2 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.45)] transition-[box-shadow] duration-300 group-hover:shadow-[0_16px_32px_-12px_rgba(0,0,0,0.6),0_0_0_1.5px_var(--color-accent)]">
                <span className="text-[10px] font-semibold text-ink/80">Poster</span>
              </div>
            </div>
            <p className="truncate text-[11px] font-medium text-ink">Sample title</p>
          </button>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="rounded-xl bg-surface p-3">
              <p className="text-[11.5px] font-semibold text-ink">Panel surface</p>
              <p className="text-[10.5px] leading-snug text-ink-muted">Secondary copy sits here.</p>
            </div>
            <div className="flex gap-2">
              <button className="flex h-10 flex-1 items-center justify-center rounded-lg bg-accent text-[12px] font-semibold text-white">
                Primary
              </button>
              <button className="flex h-10 flex-1 items-center justify-center rounded-lg bg-ink text-[12px] font-semibold text-canvas">
                Secondary
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
