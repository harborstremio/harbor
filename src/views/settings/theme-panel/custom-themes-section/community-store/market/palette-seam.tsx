import { useT } from "@/lib/i18n";
export function PaletteSeam({ swatch, labeled = false }: { swatch: string[]; labeled?: boolean }) {
  const cols = Array.isArray(swatch)
    ? swatch.filter((c): c is string => typeof c === "string" && c.length > 0)
    : [];

  const t = useT();
  if (labeled) {
    const canvas = cols[0] ?? "var(--color-canvas)";
    const surface = cols[1] ?? canvas;
    const elevated = `color-mix(in srgb, ${surface} 84%, var(--color-elevated))`;
    const accent = cols[2] ?? cols[1] ?? canvas;
    const ramp: Array<{ name: string; color: string }> = [
      { name: "Canvas", color: canvas },
      { name: "Surface", color: surface },
      { name: "Elevated", color: elevated },
      { name: "Accent", color: accent },
    ];
    return (
      <div className="grid grid-cols-4 gap-2">
        {ramp.map((cell) => (
          <div key={cell.name} className="flex min-w-0 flex-col gap-1.5">
            <span
              className="h-11 w-full rounded-[8px] ring-1 ring-edge-soft"
              style={{ background: cell.color }}
            />
            <span className="harbor-settings-label truncate">
              {t(cell.name)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (cols.length === 0) return <div className="h-1.5 w-full bg-elevated" />;
  return (
    <div className="flex h-1.5 w-full">
      {cols.map((c, i) => (
        <span key={i} className="flex-1" style={{ background: c }} />
      ))}
    </div>
  );
}
