import { useT } from "@/lib/i18n";

function Frame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-md bg-elevated px-4 py-4">
      <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-ink-subtle">
        {label}
      </span>
      {children}
    </div>
  );
}

function Bar({ w, dim }: { w: number; dim?: number }) {
  return (
    <span
      className="block h-[5px] rounded-full bg-ink"
      style={{ width: `${w}%`, opacity: dim ?? 0.2 }}
    />
  );
}

function Row({ children }: { children?: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2.5 rounded-[4px] bg-canvas px-2.5 py-2">{children}</span>
  );
}

function Pill({ strong }: { strong?: boolean }) {
  return (
    <span
      className="block h-4 w-9 shrink-0 rounded-[3px] bg-ink"
      style={{ opacity: strong ? 0.55 : 0.18 }}
    />
  );
}

export function PickerLayoutPreview({ value }: { value: "condensed" | "stremio" }) {
  const t = useT();
  return (
    <Frame label={value === "condensed" ? t("Condensed") : t("Stremio")}>
      {value === "condensed" ? (
        <span className="flex flex-col gap-2">
          <span className="flex items-center gap-3 rounded-[4px] bg-canvas px-3 py-3">
            <Pill strong />
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Bar w={62} dim={0.42} />
              <Bar w={34} dim={0.16} />
            </span>
          </span>
          <span className="flex gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="h-8 flex-1 rounded-[4px] bg-canvas" />
            ))}
          </span>
          <span className="flex flex-col gap-1">
            {[0, 1].map((i) => (
              <Row key={i}>
                <Pill />
                <Bar w={46 - i * 10} />
              </Row>
            ))}
          </span>
        </span>
      ) : (
        <span className="flex flex-col gap-2">
          {[0, 1].map((g) => (
            <span key={g} className="flex flex-col gap-1">
              <Bar w={22} dim={0.3} />
              {[0, 1, 2].map((i) => (
                <Row key={i}>
                  <Pill />
                  <Bar w={58 - i * 9} />
                </Row>
              ))}
            </span>
          ))}
        </span>
      )}
    </Frame>
  );
}

export function TorrentNamePreview({ on }: { on: boolean }) {
  const t = useT();
  return (
    <Frame label={on ? t("Filename shown") : t("Filename hidden")}>
      <span className="flex flex-col gap-1">
        {[0, 1].map((i) => (
          <span key={i} className="flex items-center gap-2.5 rounded-[4px] bg-canvas px-2.5 py-2">
            <Pill />
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Bar w={54 - i * 8} dim={0.34} />
              {on && <Bar w={72 - i * 6} dim={0.12} />}
            </span>
          </span>
        ))}
      </span>
    </Frame>
  );
}

export function StreamDescriptionPreview({ full }: { full: boolean }) {
  const t = useT();
  const lines = full ? [76, 68, 52] : [76];
  return (
    <Frame label={full ? t("Full description") : t("Trimmed")}>
      <span className="flex flex-col gap-1">
        {[0, 1].map((i) => (
          <span key={i} className="flex items-start gap-2.5 rounded-[4px] bg-canvas px-2.5 py-2">
            <Pill />
            <span className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
              <Bar w={48} dim={0.34} />
              {lines.map((w, j) => (
                <Bar key={j} w={w - i * 5} dim={0.12} />
              ))}
            </span>
          </span>
        ))}
      </span>
    </Frame>
  );
}
